import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

export const runtime = 'edge';

interface ParsedQuestion {
  questionNumber: string;
  questionText: string;
  image?: string;
  context?: string;
  options: string[];
  correctAnswer?: string; // Letter: 'A', 'B', 'C', or 'D'
}

// Helper to convert ArrayBuffer to base64 in Edge runtime
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse DOCX using JSZip (Edge-compatible)
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Extract document.xml (main content)
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      return NextResponse.json(
        { error: 'Invalid Word document - no document.xml found' },
        { status: 400 }
      );
    }

    // Extract images from word/media folder
    const images: Map<string, string> = new Map();
    const mediaFolder = zip.folder('word/media');
    if (mediaFolder) {
      const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('word/media/'));
      for (const mediaPath of mediaFiles) {
        const mediaFile = zip.file(mediaPath);
        if (mediaFile) {
          const imageData = await mediaFile.async('arraybuffer');
          const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                          ext === 'png' ? 'image/png' : 
                          ext === 'gif' ? 'image/gif' : 'image/png';
          const base64 = arrayBufferToBase64(imageData);
          const imageName = mediaPath.split('/').pop() || '';
          images.set(imageName, `data:${mimeType};base64,${base64}`);
        }
      }
    }

    // Extract relationships for image references
    const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
    const imageRels: Map<string, string> = new Map();
    if (relsXml) {
      const relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml');
      const relationships = relsDoc.getElementsByTagName('Relationship');
      for (let i = 0; i < relationships.length; i++) {
        const rel = relationships[i];
        const id = rel.getAttribute('Id') || '';
        const target = rel.getAttribute('Target') || '';
        if (target.startsWith('media/')) {
          const imageName = target.replace('media/', '');
          imageRels.set(id, imageName);
        }
      }
    }

    // Parse document XML to HTML-like structure
    const html = parseDocxToHtml(documentXml, images, imageRels);

    // Parse HTML into structured questions
    const questions = parseQuestionsFromHTML(html);

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error: any) {
    console.error('Error parsing Word document:', error);
    return NextResponse.json(
      { error: 'Failed to parse document', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Parse DOCX XML to HTML-like structure
 */
function parseDocxToHtml(xml: string, images: Map<string, string>, imageRels: Map<string, string>): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  let html = '';
  
  // Get all paragraphs
  const paragraphs = doc.getElementsByTagName('w:p');
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    let paraText = '';
    let isBold = false;
    
    // Get all runs in paragraph
    const runs = para.getElementsByTagName('w:r');
    for (let j = 0; j < runs.length; j++) {
      const run = runs[j];
      
      // Check for bold
      const rPr = run.getElementsByTagName('w:rPr')[0];
      if (rPr) {
        const bold = rPr.getElementsByTagName('w:b')[0];
        if (bold) isBold = true;
      }
      
      // Get text
      const texts = run.getElementsByTagName('w:t');
      for (let k = 0; k < texts.length; k++) {
        const textNode = texts[k];
        const text = textNode.textContent || '';
        if (isBold) {
          paraText += `<strong>${text}</strong>`;
        } else {
          paraText += text;
        }
      }
      
      // Check for images
      const drawings = run.getElementsByTagName('w:drawing');
      for (let k = 0; k < drawings.length; k++) {
        const drawing = drawings[k];
        const blips = drawing.getElementsByTagName('a:blip');
        for (let l = 0; l < blips.length; l++) {
          const blip = blips[l];
          const embedId = blip.getAttribute('r:embed') || '';
          if (embedId && imageRels.has(embedId)) {
            const imageName = imageRels.get(embedId)!;
            if (images.has(imageName)) {
              paraText += `<img src="${images.get(imageName)}">`;
            }
          }
        }
      }
    }
    
    if (paraText.trim()) {
      html += `<p>${paraText}</p>\n`;
    }
  }
  
  // Also check for tables
  const tables = doc.getElementsByTagName('w:tbl');
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    html += '<table>';
    
    const rows = table.getElementsByTagName('w:tr');
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      html += '<tr>';
      
      const cells = row.getElementsByTagName('w:tc');
      for (let k = 0; k < cells.length; k++) {
        const cell = cells[k];
        let cellText = '';
        
        const cellParas = cell.getElementsByTagName('w:p');
        for (let l = 0; l < cellParas.length; l++) {
          const cellPara = cellParas[l];
          const cellRuns = cellPara.getElementsByTagName('w:r');
          for (let m = 0; m < cellRuns.length; m++) {
            const cellRun = cellRuns[m];
            const cellTexts = cellRun.getElementsByTagName('w:t');
            for (let n = 0; n < cellTexts.length; n++) {
              cellText += cellTexts[n].textContent || '';
            }
          }
        }
        
        html += `<td>${cellText}</td>`;
      }
      
      html += '</tr>';
    }
    
    html += '</table>\n';
  }
  
  return html;
}

/**
 * Parse table-based format
 */
function parseTableFormat(html: string, numbers: string[], parts: string[]): void {
  // Look for section markers anywhere in HTML (in <p>, <li>, <h1>, etc.)
  // Support formats:
  // - "A. Pilihan Ganda"
  // - "Pilihan Ganda / Multiple Choice" (without letter prefix)
  // - Inside any HTML tag
  
  let currentSection: 'multiple-choice' | 'essay' = 'multiple-choice';
  let sectionCount = 0;
  let questionNum = 1;
  
  // Find all tables in the document
  const tableMatches = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi));
  
  if (tableMatches.length === 0) {
    console.log('  No tables found in document');
    return;
  }
  
  // Check for section markers before each table
  let lastSectionEnd = 0;
  
  for (const tableMatch of tableMatches) {
    const tableStart = tableMatch.index || 0;
    const tableContent = tableMatch[1];
    
    // Check text between last table and this table for section markers
    const betweenText = html.substring(lastSectionEnd, tableStart);
    
    // Debug: log betweenText
    console.log(`\n--- Between text (${betweenText.length} chars): ---`);
    console.log(betweenText.substring(0, 300));
    console.log('--- End between text ---');
    
    // Extract text from <li>, <p>, <h1>, <strong>, etc.
    // Remove all HTML tags to get clean text for detection
    const betweenClean = betweenText.replace(/<[^>]*>/g, ' ').toLowerCase().trim();
    
    console.log(`Clean between text: "${betweenClean}"`);
    
    if (betweenClean.includes('pilihan ganda') || betweenClean.includes('multiple choice')) {
      currentSection = 'multiple-choice';
      sectionCount++;
      questionNum = 1; // Reset numbering for new section
      console.log(`\n=== SECTION ${sectionCount}: Multiple Choice ===`);
    } else if (betweenClean.includes('essay') && !betweenClean.includes('pilihan')) {
      currentSection = 'essay';
      sectionCount++;
      questionNum = 1; // Reset numbering for new section
      console.log(`\n=== SECTION ${sectionCount}: Essay ===`);
    }
    
    // Parse this table's rows
    const rowMatches = [...tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    
    let currentQuestion: any = null;
    
    for (const rowMatch of rowMatches) {
      const rowContent = rowMatch[1];
      
      // Extract cells
      const cellMatches = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      
      // Handle rows with "Kunci Jawaban" - can be in any cell or row format
      let foundKunciJawaban = false;
      if (currentQuestion) {
        // Check all cells for "Kunci Jawaban" pattern
        for (const cellMatch of cellMatches) {
          const cellContent = cleanHTML(cellMatch[1]).trim();
          const kunciJawabanPattern = /Kunci\s+Jawaban\s*[:=]?\s*([A-Da-d])\b/i;
          const kunciMatch = cellContent.match(kunciJawabanPattern);
          
          if (kunciMatch) {
            const answerLetter = kunciMatch[1].toUpperCase();
            currentQuestion.correctAnswer = answerLetter;
            console.log(`  [TABLE] Found Kunci Jawaban = ${answerLetter} in cell for question ${currentQuestion.number}`);
            foundKunciJawaban = true;
            break; // Found it, no need to check other cells
          }
        }
      }
      
      // Skip this row if it only contains "Kunci Jawaban"
      if (foundKunciJawaban && cellMatches.length <= 2) {
        continue;
      }
      
      // Handle rows with only 1 cell that might contain "Kunci Jawaban"
      if (cellMatches.length === 1 && currentQuestion) {
        const singleCellContent = cleanHTML(cellMatches[0][1]).trim();
        const kunciJawabanPattern = /Kunci\s+Jawaban\s*[:=]?\s*([A-Da-d])\b/i;
        const kunciMatch = singleCellContent.match(kunciJawabanPattern);
        
        if (kunciMatch) {
          const answerLetter = kunciMatch[1].toUpperCase();
          currentQuestion.correctAnswer = answerLetter;
          console.log(`  [TABLE] Found Kunci Jawaban = ${answerLetter} in single-cell row for question ${currentQuestion.number}`);
          continue; // Skip this row, it's just metadata
        }
      }
      
      if (cellMatches.length >= 2) {
        const firstCellRaw = cellMatches[0][1];
        const secondCellRaw = cellMatches[1][1];
        
        // Clean cell content
        const firstCell = cleanHTML(firstCellRaw).trim();
        const secondCell = secondCellRaw.trim(); // Keep HTML for images
        
        // Check if first cell is a question number (1., 2., 3., etc.)
        const questionNumMatch = firstCell.match(/^(\d+)\.$/);
        
        if (questionNumMatch) {
          // This is a new question
          if (currentQuestion) {
            // Before saving, check if we missed "Kunci Jawaban" in previous rows
            // This handles case where "Kunci Jawaban" might be in a row after options but before next question
            if (!currentQuestion.correctAnswer) {
              console.log(`  [TABLE] Warning: Question ${currentQuestion.number} has no correctAnswer yet`);
            }
            
            // Save previous question
            numbers.push(currentQuestion.number);
            parts.push(currentQuestion.content);
          }
          
          // Check if question cell contains "Kunci Jawaban"
          const secondCellClean = cleanHTML(secondCell).trim();
          const kunciJawabanPattern = /Kunci\s+Jawaban\s*[:=]?\s*([A-Da-d])\b/i;
          const kunciMatch = secondCellClean.match(kunciJawabanPattern);
          let correctAnswerFromQuestion: string | null = null;
          
          if (kunciMatch) {
            correctAnswerFromQuestion = kunciMatch[1].toUpperCase();
            console.log(`  [TABLE] Found Kunci Jawaban = ${correctAnswerFromQuestion} in question ${questionNumMatch[1]} cell`);
            // Remove "Kunci Jawaban" from question content
            const cleanedQuestionContent = secondCell.replace(kunciJawabanPattern, '').trim();
            currentQuestion = {
              number: questionNumMatch[1],
              content: `<!--SECTION:${currentSection}-->${cleanedQuestionContent}`,
              options: [],
              correctAnswer: correctAnswerFromQuestion
            };
          } else {
            // Start new question
            currentQuestion = {
              number: questionNumMatch[1],
              content: `<!--SECTION:${currentSection}-->${secondCell}`,
              options: []
            };
          }
          
          console.log(`  [${currentSection.toUpperCase()}] Question ${questionNumMatch[1]}`);
          questionNum++;
          
        } else if (currentQuestion && firstCell.match(/^[A-Da-d]\.$/)) {
          // This is an option row
          const optionLetter = firstCell.match(/^([A-Da-d])\.$/)?.[1];
          if (optionLetter) {
            const secondCellClean = cleanHTML(secondCell).trim();
            
            // Check if this option cell contains "Kunci Jawaban"
            const kunciJawabanPattern = /Kunci\s+Jawaban\s*[:=]?\s*([A-Da-d])\b/i;
            const kunciMatch = secondCellClean.match(kunciJawabanPattern);
            
            if (kunciMatch) {
              const answerLetter = kunciMatch[1].toUpperCase();
              currentQuestion.correctAnswer = answerLetter;
              console.log(`  [TABLE] Found Kunci Jawaban = ${answerLetter} in option ${optionLetter} for question ${currentQuestion.number}`);
              // Remove "Kunci Jawaban" from option text
              const cleanedOptionText = secondCellClean.replace(kunciJawabanPattern, '').trim();
              currentQuestion.options.push({ 
                letter: optionLetter.toUpperCase(), 
                text: cleanedOptionText
              });
            } else {
              currentQuestion.options.push({ 
                letter: optionLetter.toUpperCase(), 
                text: secondCellClean
              });
            }
          }
        } else if (currentQuestion) {
          // Check if this row contains "Kunci Jawaban"
          const secondCellClean = cleanHTML(secondCell).trim();
          const firstCellClean = cleanHTML(firstCellRaw).trim();
          const kunciJawabanPattern = /Kunci\s+Jawaban\s*[:=]?\s*([A-Da-d])\b/i;
          
          // Check both cells
          let kunciMatch = secondCellClean.match(kunciJawabanPattern);
          if (!kunciMatch) {
            kunciMatch = firstCellClean.match(kunciJawabanPattern);
          }
          
          if (kunciMatch) {
            const answerLetter = kunciMatch[1].toUpperCase();
            currentQuestion.correctAnswer = answerLetter;
            console.log(`  [TABLE] Found Kunci Jawaban = ${answerLetter} for question ${currentQuestion.number} (firstCell: "${firstCellClean.substring(0, 50)}", secondCell: "${secondCellClean.substring(0, 50)}")`);
            // Don't add this to content, it's just metadata
          } else {
            // Debug: log rows that don't match any pattern
            if (firstCellClean || secondCellClean) {
              console.log(`  [TABLE DEBUG] Unmatched row for question ${currentQuestion.number}: firstCell="${firstCellClean.substring(0, 50)}", secondCell="${secondCellClean.substring(0, 50)}"`);
            }
          }
        }
      }
    }
    
    // Save last question from this table
    if (currentQuestion) {
      // Append options to content if any
      if (currentQuestion.options.length > 0) {
        const optionsHtml = currentQuestion.options
          .map((opt: any) => `${opt.letter}. ${opt.text}`)
          .join(' ');
        currentQuestion.content += ` ${optionsHtml}`;
      }
      
      // Final check: look for "Kunci Jawaban" in the entire content (might be embedded in question text)
      if (!currentQuestion.correctAnswer) {
        const fullContent = currentQuestion.content;
        const kunciJawabanPattern = /Kunci\s+Jawaban\s*[:=]?\s*([A-Da-d])\b/i;
        const kunciMatch = fullContent.match(kunciJawabanPattern);
        
        if (kunciMatch) {
          const answerLetter = kunciMatch[1].toUpperCase();
          currentQuestion.correctAnswer = answerLetter;
          console.log(`  [TABLE] Found Kunci Jawaban = ${answerLetter} in full content for question ${currentQuestion.number}`);
          // Remove from content
          currentQuestion.content = currentQuestion.content.replace(kunciJawabanPattern, '').trim();
        }
      }
      
      // Add correctAnswer as HTML comment if found (from any source: question cell, option cell, or separate row)
      if (currentQuestion.correctAnswer) {
        currentQuestion.content += `<!--CORRECT_ANSWER:${currentQuestion.correctAnswer}-->`;
        console.log(`  [TABLE] Saving correctAnswer ${currentQuestion.correctAnswer} for question ${currentQuestion.number}`);
      } else {
        console.log(`  [TABLE] Warning: Question ${currentQuestion.number} has no correctAnswer after all checks`);
      }
      
      numbers.push(currentQuestion.number);
      parts.push(currentQuestion.content);
    }
    
    lastSectionEnd = (tableMatch.index || 0) + tableMatch[0].length;
  }
  
  console.log(`\nFound ${numbers.length} total questions from tables`);
}

/**
 * Parse HTML content into structured questions
 */
function parseQuestionsFromHTML(html: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  console.log('=== RAW HTML START ===');
  console.log('Total HTML length:', html.length);
  
  // Print first 3000 chars to see structure
  console.log(html.substring(0, 3000));
  console.log('=== RAW HTML END ===');
  
  // Also print a sample from middle
  if (html.length > 5000) {
    console.log('=== MIDDLE SAMPLE (chars 2000-4000) ===');
    console.log(html.substring(2000, 4000));
    console.log('=== END MIDDLE SAMPLE ===');
  }
  
  // Remove header/instructions (everything before section A/B/etc or first question)
  // Look for section markers like "A.", "B.", or direct question numbers
  let cleanHtml = html;
  
  // Find where actual questions start (after "PETUNJUK KHUSUS" or section markers)
  const sectionMatch = html.match(/<p[^>]*>.*?[A-Z]\.\s*Choose.*?<\/p>/i);
  if (sectionMatch && sectionMatch.index !== undefined) {
    // Start from section marker
    cleanHtml = html.substring(sectionMatch.index);
    console.log('Found section marker, starting from:', cleanHtml.substring(0, 200));
  }
  
  // Alternative: look for first occurrence of "1. " pattern
  const firstQuestionMatch = cleanHtml.match(/(?:<p[^>]*>|\n)\s*1\.\s+/);
  if (firstQuestionMatch && firstQuestionMatch.index !== undefined) {
    cleanHtml = cleanHtml.substring(firstQuestionMatch.index);
    console.log('Found first question at position:', firstQuestionMatch.index);
  }
  
  // Check format type
  const hasOrderedList = cleanHtml.includes('<ol>') && cleanHtml.includes('<li>');
  const hasTable = cleanHtml.includes('<table>') && cleanHtml.includes('<tr>');
  
  const parts: string[] = [];
  const numbers: string[] = [];
  
  if (hasTable) {
    console.log('Detected <table> structure (Word table format)');
    
    // Parse table-based format
    parseTableFormat(cleanHtml, numbers, parts);
    
  } else if (hasOrderedList) {
    console.log('Detected <ol><li> structure (Word numbered list)');
    
    // Split by section markers: "Multiple Choice", "Pilihan Ganda", "Essay", "Essay Question"
    const sectionPattern = /(Multiple\s*Choice|Pilihan\s*Ganda|Essay\s*Question|Essay)/gi;
    const sections = cleanHtml.split(sectionPattern);
    
    console.log(`  Found ${sections.length} sections`);
    
    let currentSection = 'multiple-choice'; // Default
    let questionNum = 1;
    
    for (let i = 0; i < sections.length; i++) {
      const sectionContent = sections[i];
      const sectionLower = sectionContent.toLowerCase().trim();
      
      // Detect section type
      if (sectionLower.includes('multiple') || sectionLower.includes('pilihan ganda')) {
        console.log(`\n=== SECTION: Multiple Choice / Pilihan Ganda ===`);
        currentSection = 'multiple-choice';
        continue;
      } else if (sectionLower.includes('essay')) {
        console.log(`\n=== SECTION: Essay ===`);
        currentSection = 'essay';
        questionNum = 1; // Reset numbering for essay section
        continue;
      }
      
      // Extract <ol> from this section
      const olMatches = sectionContent.matchAll(/<ol[^>]*>([\s\S]*?)<\/ol>/gi);
      
      for (const olMatch of olMatches) {
        const olContent = olMatch[1];
        
        // Extract all <li> items from this <ol>
        const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch;
        
        while ((liMatch = liPattern.exec(olContent)) !== null) {
          const content = liMatch[1];
          
          // Skip instruction
          if (content.toLowerCase().includes('choose the right answer') || 
              content.toLowerCase().includes('pilihlah jawaban') ||
              content.toLowerCase().includes('jawablah pertanyaan')) {
            console.log(`  Skipping instruction <li>`);
            continue;
          }
          
          // Skip short content
          if (content.trim().length < 10) {
            continue;
          }
          
          // Store with section info
          numbers.push(String(questionNum));
          parts.push(content);
          
          // Mark section type in content for later processing
          parts[parts.length - 1] = `<!--SECTION:${currentSection}-->${content}`;
          
          console.log(`  [${currentSection.toUpperCase()}] Question ${questionNum}`);
          questionNum++;
        }
      }
    }
    
    console.log(`\nFound ${numbers.length} total questions`);
  } else {
    console.log('Trying manual numbering patterns...');
    
    // Try pattern for manual numbers like "1. ", "2. "
    const questionPattern = /(?:^|<p[^>]*>|<\/p>|\n)\s*(?:<[^>]*>)*\s*(\d+)\.\s*/g;
    const positions: number[] = [];
    
    let match;
    while ((match = questionPattern.exec(cleanHtml)) !== null) {
      numbers.push(match[1]);
      positions.push(match.index);
      console.log(`  Found question ${match[1]} at position ${match.index}`);
    }
    
    // If still no questions, try simple pattern
    if (numbers.length === 0) {
      console.log('Trying simple pattern...');
      const altPattern = /(\d+)\.\s+/g;
      while ((match = altPattern.exec(cleanHtml)) !== null) {
        const num = parseInt(match[1]);
        if (num >= 1 && num <= 100) {
          numbers.push(match[1]);
          positions.push(match.index);
          console.log(`  Alternative: Found ${match[1]} at ${match.index}`);
        }
      }
    }
    
    console.log(`Found ${numbers.length} question numbers:`, numbers);
    
    // Build content parts based on positions
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i];
      const end = positions[i + 1] || cleanHtml.length;
      
      let content = cleanHtml.substring(start, end);
      // Remove number from beginning
      content = content.replace(/(?:^|<p[^>]*>|<\/p>|\n)\s*(?:<[^>]*>)*\s*\d+\.\s*/, '');
      parts.push(content);
    }
  }
  
  // Now pair numbers with their content
  for (let i = 0; i < numbers.length; i++) {
    const questionNumber = numbers[i];
    const questionContent = parts[i] || '';
    
    if (!questionContent || questionContent.trim().length === 0) {
      console.log(`Skipping question ${questionNumber} - no content`);
      continue;
    }
    
    console.log(`\nParsing question ${questionNumber}...`);
    console.log('Content preview:', questionContent.substring(0, 300).replace(/\n/g, ' '));
    
    const question = parseQuestionContent(questionNumber, questionContent);
    if (question) {
      questions.push(question);
      console.log(`✓ Successfully parsed question ${questionNumber}`);
    } else {
      console.log(`✗ Failed to parse question ${questionNumber}`);
    }
  }
  
  console.log(`\nTotal questions parsed: ${questions.length}`);
  
  // Check if document is just a scanned image
  if (questions.length === 0 && html.length > 100000) {
    const imageCount = (html.match(/<img/g) || []).length;
    const textLength = html.replace(/<img[^>]*>/g, '').replace(/<[^>]*>/g, '').trim().length;
    
    console.log(`Image count: ${imageCount}, Text length: ${textLength}`);
    
    if (imageCount > 0 && textLength < 500) {
      console.warn('⚠️ Document appears to be a scanned image, not editable text!');
      throw new Error('Document appears to be a scanned image. Mammoth can only extract editable text. Please use the PDF import option (which supports AI vision) or re-create the document with editable text.');
    }
  }
  
  return questions;
}

/**
 * Parse individual question content
 */
function parseQuestionContent(questionNumber: string, content: string): ParsedQuestion | null {
  try {
    console.log(`  Parsing content for question ${questionNumber}...`);
    
    // Check if content has section marker
    const sectionMatch = content.match(/<!--SECTION:(.*?)-->/);
    const sectionType = sectionMatch ? sectionMatch[1] : null;
    
    if (sectionType) {
      console.log(`  Section type: ${sectionType}`);
      // Remove section marker from content
      content = content.replace(/<!--SECTION:.*?-->/, '');
    }
    
    // Check if content has correctAnswer from table format
    const correctAnswerMatch = content.match(/<!--CORRECT_ANSWER:(.*?)-->/);
    const tableCorrectAnswer = correctAnswerMatch ? correctAnswerMatch[1] : null;
    
    if (tableCorrectAnswer) {
      console.log(`  Found correctAnswer from table: ${tableCorrectAnswer}`);
      // Remove correctAnswer marker from content
      content = content.replace(/<!--CORRECT_ANSWER:.*?-->/, '');
    }
    
    // Extract ALL images (could be multiple)
    const imgMatches = content.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi);
    const images: string[] = [];
    for (const match of imgMatches) {
      images.push(match[1]);
      console.log(`  Found image (${(match[1].length / 1024).toFixed(2)} KB)`);
    }
    const image = images[0]; // Use first image
    
    // Split content by image if exists
    let textBeforeImage = '';
    let textAfterImage = '';
    
    if (image) {
      const parts = content.split(/<img[^>]*>/i);
      textBeforeImage = parts[0] || '';
      textAfterImage = parts.slice(1).join(''); // Join rest if multiple images
    } else {
      textAfterImage = content;
    }
    
    // Remove ALL images from content for text processing
    let textContent = content.replace(/<img[^>]*>/gi, '');
    
    // Check for "Kunci Jawaban = X" or "Kunci Jawaban: X" pattern and extract it before processing options
    // This prevents it from being detected as part of option text
    // Support formats: "Kunci Jawaban = A", "Kunci Jawaban: A", "Kunci Jawaban A"
    // Search in both original content (with HTML) and cleaned textContent
    const kunciJawabanPattern = /Kunci\s+Jawaban\s*[:=]?\s*([A-Da-d])\b/i;
    let kunciJawabanMatch = textContent.match(kunciJawabanPattern);
    let detectedAnswerLetter: string | null = null;
    
    // If not found in textContent, try searching in original content (might be in HTML tags)
    if (!kunciJawabanMatch) {
      kunciJawabanMatch = content.match(kunciJawabanPattern);
    }
    
    if (kunciJawabanMatch) {
      detectedAnswerLetter = kunciJawabanMatch[1].toUpperCase();
      // Remove "Kunci Jawaban = X" from both textContent and content
      textContent = textContent.replace(kunciJawabanPattern, '').trim();
      content = content.replace(kunciJawabanPattern, '').trim();
      console.log(`  ✓ Found Kunci Jawaban = ${detectedAnswerLetter}`);
    } else {
      // Try alternative pattern without equals/colon
      const altPattern = /Kunci\s+Jawaban\s+([A-Da-d])\b/i;
      let altMatch = textContent.match(altPattern);
      if (!altMatch) {
        altMatch = content.match(altPattern);
      }
      if (altMatch) {
        detectedAnswerLetter = altMatch[1].toUpperCase();
        textContent = textContent.replace(altPattern, '').trim();
        content = content.replace(altPattern, '').trim();
        console.log(`  ✓ Found Kunci Jawaban (alt format) = ${detectedAnswerLetter}`);
      } else {
        // Debug: log a sample of textContent to see what we're searching in
        const sampleText = textContent.substring(Math.max(0, textContent.length - 200));
        console.log(`  [DEBUG] No Kunci Jawaban found. Last 200 chars of textContent: "${sampleText}"`);
      }
    }
    
    // Extract options - support both inline and newline formats
    // Format 1: "a. Tea b. coffee c. milk" (inline)
    // Format 2: "A. Tea\nB. coffee" (with newlines)
    // Also detect <strong> tags for correct answer
    const optionPattern = /([A-Da-d])\.\s*([\s\S]+?)(?=\s+[A-Da-d]\.|<\/|<br|$)/gi;
    const options: string[] = [];
    let match;
    
    const optionMap = new Map<string, string>();
    const correctAnswerMap = new Map<string, boolean>(); // Track which options are bold
    
    while ((match = optionPattern.exec(textContent)) !== null) {
      const optionLetter = match[1].toUpperCase();
      let optionTextRaw = match[2]; // Keep HTML for bold detection
      
      // Check if option has <strong> or <b> tag (indicates correct answer)
      const isBold = optionTextRaw.includes('<strong>') || optionTextRaw.includes('<b>');
      
      // Clean HTML tags, newlines, and extra whitespace
      let optionText = optionTextRaw
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Remove trailing punctuation/garbage
      optionText = optionText.replace(/[,;.]*$/, '').trim();
      
      if (optionText && optionText.length > 0) {
        optionMap.set(optionLetter, optionText);
        if (isBold) {
          correctAnswerMap.set(optionLetter, true);
          console.log(`  ✓ Option ${optionLetter} is marked as correct (bold): ${optionText.substring(0, 50)}...`);
        } else {
          console.log(`  Option ${optionLetter}: ${optionText.substring(0, 50)}...`);
        }
      }
    }
    
    // Convert map to ordered array (A, B, C, D) and track correct answer letter
    let correctAnswerLetter: string | undefined = undefined;
    ['A', 'B', 'C', 'D'].forEach((letter) => {
      if (optionMap.has(letter)) {
        options.push(optionMap.get(letter)!);
        if (correctAnswerMap.has(letter)) {
          correctAnswerLetter = letter; // Store as letter directly
        }
      }
    });
    
    // Find where options start (if any)
    let optionsStartIndex = -1;
    if (options.length > 0) {
      // More aggressive regex that finds options even without <p> tags
      const firstOptionMatch = textContent.match(/\s*[A-Da-d]\.\s*/i);
      if (firstOptionMatch && firstOptionMatch.index !== undefined) {
        optionsStartIndex = firstOptionMatch.index;
      }
    }
    
    // Get question text (everything before options)
    let questionText = textContent;
    if (optionsStartIndex >= 0) {
      questionText = textContent.substring(0, optionsStartIndex);
    }
    
    // Apply detected answer from "Kunci Jawaban = X" if found
    // Priority: tableCorrectAnswer > detectedAnswerLetter > bold detection
    let finalAnswerLetter: string | null = null;
    
    if (tableCorrectAnswer) {
      finalAnswerLetter = tableCorrectAnswer.toUpperCase();
      console.log(`  Using correctAnswer from table: ${finalAnswerLetter}`);
    } else if (detectedAnswerLetter) {
      finalAnswerLetter = detectedAnswerLetter;
      console.log(`  Using detectedAnswerLetter from text: ${finalAnswerLetter}`);
    }
    
    if (finalAnswerLetter) {
      console.log(`  [DEBUG] finalAnswerLetter: ${finalAnswerLetter}, options.length: ${options.length}, optionMap.has: ${optionMap.has(finalAnswerLetter)}`);
      
      // Check if this letter exists in optionMap
      if (optionMap.has(finalAnswerLetter)) {
        correctAnswerLetter = finalAnswerLetter.toUpperCase(); // Override any previous value (from bold detection)
        console.log(`  ✓ Applied Kunci Jawaban = ${finalAnswerLetter}`);
      } else {
        console.log(`  ⚠️ Kunci Jawaban = ${finalAnswerLetter} found but option ${finalAnswerLetter} not available`);
      }
    }
    
    // Log final correctAnswerLetter value
    if (options.length > 0) {
      console.log(`  [FINAL] correctAnswerLetter: ${correctAnswerLetter}, options count: ${options.length}`);
    }
    
    // Clean HTML tags from question text
    questionText = cleanHTML(questionText);
    
    // Extract context (text after image but before options)
    let context = '';
    if (image && textAfterImage) {
      // Remove all images from text after image
      const contextText = textAfterImage.replace(/<img[^>]*>/gi, '');
      
      // Find where options start in context text
      let finalContextText = contextText;
      if (options.length > 0) {
        // Find "A." directly in the HTML text
        const firstOptionMatch = contextText.match(/[^>]\s*[A-Da-d]\.\s*/i);
        if (firstOptionMatch && firstOptionMatch.index !== undefined) {
          // Cut at the position where option starts
          finalContextText = contextText.substring(0, firstOptionMatch.index + 1);
        }
      }
      
      context = cleanHTML(finalContextText);
      if (context && context.trim()) {
        console.log(`  Context: ${context.substring(0, 50)}...`);
      }
    }
    
    // Validate - must have at least question text
    if (!questionText || questionText.trim().length === 0) {
      console.log(`  ✗ No question text found`);
      return null;
    }
    
    console.log(`  Question text: ${questionText.substring(0, 50)}...`);
    
    // Apply section-based classification
    let finalOptions = options;
    
    if (sectionType === 'essay') {
      // Force essay (no options) even if we detected some
      finalOptions = [];
      correctAnswerLetter = undefined;
      console.log(`  [ESSAY SECTION] Forcing no options`);
    } else if (sectionType === 'multiple-choice') {
      // Warn if no options found in MC section
      if (options.length === 0) {
        console.log(`  ⚠️ Warning: No options found in Multiple Choice section`);
      } else {
        console.log(`  [MC SECTION] Options found: ${options.length}`);
        if (correctAnswerLetter) {
          console.log(`  ✓ Correct answer: ${correctAnswerLetter}`);
        }
      }
    } else {
      // No section marker - classify by options presence
      console.log(`  Options found: ${options.length} (auto-classify)`);
    }
    
    // Return correctAnswer as letter (A, B, C, D) or undefined
    const finalCorrectAnswer = (finalOptions.length > 0 && correctAnswerLetter) 
      ? correctAnswerLetter 
      : undefined;
    
    console.log(`  [RETURN] Question ${questionNumber}: correctAnswer = ${finalCorrectAnswer}, options = ${finalOptions.length}`);
    
    return {
      questionNumber,
      questionText: questionText.trim(),
      image,
      context: (context && context.trim()) || undefined,
      options: finalOptions,
      correctAnswer: finalCorrectAnswer,
    };
  } catch (error) {
    console.error(`Error parsing question ${questionNumber}:`, error);
    return null;
  }
}

/**
 * Clean HTML tags but preserve important formatting
 */
function cleanHTML(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newline
    .replace(/<\/p>/gi, '\n') // Convert </p> to newline
    .replace(/<p[^>]*>/gi, '') // Remove <p> tags
    .replace(/<[^>]*>/g, '') // Remove other HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
    .trim();
}

