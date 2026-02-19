import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export const runtime = 'edge';

// Helper function to extract text from OMML element recursively
function extractTextFromElement(element: Element | null): string {
  if (!element) return '';
  
  let text = '';
  
  // Get direct text from m:t elements
  const textElements = element.getElementsByTagName('m:t');
  for (let i = 0; i < textElements.length; i++) {
    text += textElements[i].textContent || '';
  }
  
  // If no text found, try to get textContent directly
  if (!text && element.textContent) {
    text = element.textContent;
  }
  
  return text.trim();
}

// Convert OMML directly to LaTeX (recursive approach)
function ommlToLatex(ommlXml: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ommlXml, 'application/xml');
    const oMath = doc.documentElement || doc.getElementsByTagName('m:oMath')[0];
    
    if (!oMath) return '';
    
    return convertOmmlElementToLatex(oMath);
  } catch (error) {
    console.warn('Failed to convert OMML to LaTeX:', error);
    return '';
  }
}

// Recursively convert OMML element to LaTeX
function convertOmmlElementToLatex(element: Element): string {
  let result = '';
  
  // Handle fractions (m:f)
  const fractions = element.getElementsByTagName('m:f');
  if (fractions.length > 0) {
    for (let i = 0; i < fractions.length; i++) {
      const frac = fractions[i];
      const num = frac.getElementsByTagName('m:num')[0];
      const den = frac.getElementsByTagName('m:den')[0];
      
      if (num && den) {
        const numText = convertOmmlElementToLatex(num);
        const denText = convertOmmlElementToLatex(den);
        if (numText && denText) {
          result += `\\frac{${numText}}{${denText}}`;
        }
      }
    }
    return result;
  }
  
  // Handle superscripts (m:sSup)
  const sups = element.getElementsByTagName('m:sSup');
  if (sups.length > 0) {
    for (let i = 0; i < sups.length; i++) {
      const sup = sups[i];
      const base = sup.getElementsByTagName('m:e')[0];
      const exp = sup.getElementsByTagName('m:sup')[0];
      
      if (base && exp) {
        const baseText = convertOmmlElementToLatex(base);
        const expText = convertOmmlElementToLatex(exp);
        if (baseText && expText) {
          result += `${baseText}^{${expText}}`;
        }
      }
    }
    return result;
  }
  
  // Handle subscripts (m:sSub)
  const subs = element.getElementsByTagName('m:sSub');
  if (subs.length > 0) {
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      const base = sub.getElementsByTagName('m:e')[0];
      const subText = sub.getElementsByTagName('m:sub')[0];
      
      if (base && subText) {
        const baseText = convertOmmlElementToLatex(base);
        const subVal = convertOmmlElementToLatex(subText);
        if (baseText && subVal) {
          result += `${baseText}_{${subVal}}`;
        }
      }
    }
    return result;
  }
  
  // Handle regular expressions (m:e)
  const expressions = element.getElementsByTagName('m:e');
  if (expressions.length > 0) {
    for (let i = 0; i < expressions.length; i++) {
      result += convertOmmlElementToLatex(expressions[i]);
    }
    return result;
  }
  
  // Extract plain text from m:t elements
  const textElements = element.getElementsByTagName('m:t');
  if (textElements.length > 0) {
    for (let i = 0; i < textElements.length; i++) {
      result += textElements[i].textContent || '';
    }
    return result;
  }
  
  // Fallback: get text content
  if (element.textContent) {
    return element.textContent.trim();
  }
  
  return result;
}



export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    
    if (!documentXml) {
      return NextResponse.json({ mathExpressions: [] });
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(documentXml, 'application/xml');
    
    // Find all m:oMath elements
    // Try with namespace first
    let mathElements = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/officeDocument/2006/math', 'oMath');
    
    // Fallback to tag name with prefix if namespace search fails
    if (mathElements.length === 0) {
      mathElements = doc.getElementsByTagName('m:oMath');
    }
    
    // If still no results, try without prefix
    if (mathElements.length === 0) {
      const allElements = doc.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el.localName === 'oMath' || el.nodeName === 'm:oMath') {
          mathElements = doc.getElementsByTagName(el.nodeName);
          break;
        }
      }
    }
    const mathExpressions: Array<{ index: number; svg: string }> = [];
    
    for (let i = 0; i < mathElements.length; i++) {
      const mathElement = mathElements[i];
      const serializer = new XMLSerializer();
      const ommlXml = serializer.serializeToString(mathElement);
      
      // Wrap in proper namespace for parsing
      const wrappedOmml = `<?xml version="1.0" encoding="UTF-8"?><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${ommlXml}</m:oMath>`;
      
      try {
        // Convert OMML directly to LaTeX
        const latex = ommlToLatex(wrappedOmml);
        
        if (latex && latex.trim()) {
          // Return LaTeX - client will render it using KaTeX
          mathExpressions.push({
            index: i,
            svg: latex, // Actually LaTeX, will be rendered on client
          });
        }
      } catch (err) {
        console.warn(`Failed to convert math expression ${i}:`, err);
      }
    }
    
    return NextResponse.json({ mathExpressions });
  } catch (error) {
    console.error('Error extracting math from Word:', error);
    return NextResponse.json(
      { error: 'Failed to extract math from Word file' },
      { status: 500 }
    );
  }
}

