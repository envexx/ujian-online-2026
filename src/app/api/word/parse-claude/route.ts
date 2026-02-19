import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ParsedSoalPG {
  pertanyaan: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  kunciJawaban: string;
}

interface ParsedSoalEssay {
  pertanyaan: string;
  kunciJawaban: string;
}

interface ParsedSoal {
  soalPG: ParsedSoalPG[];
  soalEssay: ParsedSoalEssay[];
}

/**
 * Membaca file PDF dan mengkonversi ke format base64 (Server-side)
 */
async function readPdfToBase64(file: File): Promise<{ data: string }> {
  // Convert file to base64 using Buffer (Node.js way)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  return { data: base64 };
}

/**
 * Konversi delimiter LaTeX ke format MathJax
 * Mengkonversi \[...\] ke $$...$$ dan \(...\) ke $...$
 */
function convertLatexDelimitersToMathJax(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  
  // Konversi \[ \] ke $$ (display math)
  // Pattern: \[...\] -> $$...$$
  result = result.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  
  // Konversi \( \) ke $ (inline math)
  // Pattern: \(...\) -> $...$
  result = result.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
  
  return result;
}

/**
 * Post-process parsed soal untuk mengkonversi delimiter LaTeX ke MathJax
 */
function postProcessParsedSoal(parsed: ParsedSoal): ParsedSoal {
  // Process soal PG
  const processedSoalPG = parsed.soalPG.map(soal => ({
    ...soal,
    pertanyaan: convertLatexDelimitersToMathJax(soal.pertanyaan),
    opsiA: convertLatexDelimitersToMathJax(soal.opsiA),
    opsiB: convertLatexDelimitersToMathJax(soal.opsiB),
    opsiC: convertLatexDelimitersToMathJax(soal.opsiC),
    opsiD: convertLatexDelimitersToMathJax(soal.opsiD),
  }));
  
  // Process soal Essay
  const processedSoalEssay = parsed.soalEssay.map(soal => ({
    ...soal,
    pertanyaan: convertLatexDelimitersToMathJax(soal.pertanyaan),
    kunciJawaban: convertLatexDelimitersToMathJax(soal.kunciJawaban),
  }));
  
  return {
    soalPG: processedSoalPG,
    soalEssay: processedSoalEssay,
  };
}

/**
 * Parse JSON dengan handling untuk LaTeX backslash yang tidak di-escape
 * Lebih robust dengan handling untuk string multi-line dan JSON yang terpotong
 */
function parseJsonWithLatex(jsonText: string): ParsedSoal {
  // Bersihkan JSON text terlebih dahulu
  let cleaned = jsonText.trim();
  
  // Hapus markdown code blocks jika ada
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  
  // Cek apakah JSON terpotong (tidak berakhir dengan } atau ])
  const lastChar = cleaned.trim().slice(-1);
  if (lastChar !== '}' && lastChar !== ']') {
    // Coba perbaiki JSON yang terpotong
    // Cari posisi terakhir dari struktur yang valid
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    let lastValidPos = -1;
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
        
        // Jika semua brace dan bracket seimbang, ini posisi valid
        if (braceCount === 0 && bracketCount === 0) {
          lastValidPos = i;
        }
      }
    }
    
    // Jika ditemukan posisi valid, potong sampai di sana
    if (lastValidPos > 0) {
      cleaned = cleaned.substring(0, lastValidPos + 1);
    } else {
      // Jika tidak ditemukan, coba tutup struktur yang terbuka
      let closeChars = '';
      if (braceCount > 0) closeChars += '}'.repeat(braceCount);
      if (bracketCount > 0) closeChars += ']'.repeat(bracketCount);
      cleaned = cleaned + closeChars;
    }
  }
  
  try {
    // Coba parse langsung dulu
    return JSON.parse(cleaned);
  } catch (error) {
    // Jika gagal, perbaiki JSON dengan escape backslash di dalam string values
    // Gunakan pendekatan yang lebih robust untuk menangani string multi-line
    let fixed = cleaned;
    
    // Escape backslash yang tidak valid di dalam string JSON
    // Gunakan regex yang lebih sederhana tapi robust
    // Pattern: "key": "value" dimana value bisa mengandung escaped characters
    fixed = fixed.replace(/"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g, (match, key, value) => {
      // Escape backslash yang bukan escape sequence valid JSON
      const escapedValue = value.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
      return `"${key}": "${escapedValue}"`;
    });
    
    try {
      return JSON.parse(fixed);
    } catch (secondError) {
      // Jika masih gagal, coba pendekatan lebih agresif
      // Escape semua backslash di dalam string (kecuali yang sudah di-escape)
      fixed = cleaned.replace(/"([^"]*)":\s*"([^"]*(?:\\.[^"]*)*)"/g, (match, key, value) => {
        // Escape semua backslash yang tidak diikuti oleh karakter escape valid
        const escapedValue = value.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
        return `"${key}": "${escapedValue}"`;
      });
      
      try {
        return JSON.parse(fixed);
      } catch (thirdError) {
        // Jika masih gagal, throw error dengan informasi lebih detail
        throw new Error(`Failed to parse JSON after multiple attempts. Last error: ${thirdError instanceof Error ? thirdError.message : String(thirdError)}`);
      }
    }
  }
}

/**
 * Prompt untuk ekstraksi soal dari dokumen
 */
const EXTRACTION_PROMPT = `Anda adalah asisten yang ahli dalam mengekstrak soal ujian dari dokumen. 

PERINGATAN PENTING: HANYA ekstrak soal yang BENAR-BENAR ADA di dokumen. JANGAN menambahkan, membuat-buat, mengarang, atau mengimprovisasi soal baru. Jika dokumen hanya berisi 5 soal, ekstrak hanya 5 soal tersebut. JANGAN menambahkan soal ke-6, ke-7, dst yang tidak ada di dokumen.

PENTING UNTUK MATEMATIKA:
- SEMUA ekspresi matematika HARUS dibungkus dengan $ (inline math)
- Untuk pecahan, gunakan $$...$$ (display math)
- Gunakan ^ untuk superscript: $x^2$, $3a^2$
- Gunakan _ untuk subscript: $x_1$
- Contoh BENAR: "$2y^2-8y+y-2$" 
- Contoh BENAR: "Koefisien untuk variabel $a^2$ dan $b^2$ dari bentuk aljabar $3a^2-2a+4b-5b^2+11$ adalah …."
- Contoh BENAR: "$$\frac{1}{2}$$" atau "$$\\frac{1}{2}$$"
- Contoh SALAH: "2y^2-8y+y-2" (harus ada $)
- Contoh SALAH: "2y2-8y+y-2" (harus pakai ^)

FORMAT OUTPUT JSON:
{
  "soalPG": [
    {
      "pertanyaan": "Pertanyaan lengkap persis seperti di dokumen. Jika ada ekspresi matematika, gunakan format LaTeX dengan delimiter MathJax: $...$ untuk inline math dan $$...$$ untuk display math. Dalam JSON, backslash harus di-escape (contoh: $x^2$ menjadi $x^2$, $$\\frac{1}{12}$$ menjadi $$\\\\frac{1}{12}$$)",
      "opsiA": "Opsi A persis seperti di dokumen. Jika ada LaTeX, gunakan delimiter MathJax $...$ atau $$...$$ dengan backslash di-escape",
      "opsiB": "Opsi B persis seperti di dokumen. Jika ada LaTeX, gunakan delimiter MathJax $...$ atau $$...$$ dengan backslash di-escape",
      "opsiC": "Opsi C persis seperti di dokumen. Jika ada LaTeX, gunakan delimiter MathJax $...$ atau $$...$$ dengan backslash di-escape",
      "opsiD": "Opsi D persis seperti di dokumen. Jika ada LaTeX, gunakan delimiter MathJax $...$ atau $$...$$ dengan backslash di-escape",
      "kunciJawaban": "A"
    }
  ],
  "soalEssay": [
    {
      "pertanyaan": "Pertanyaan essay persis seperti di dokumen. Jika ada ekspresi matematika, gunakan delimiter MathJax: $...$ untuk inline math dan $$...$$ untuk display math",
      "kunciJawaban": "Kunci jawaban persis seperti di dokumen. Jika ada ekspresi matematika, gunakan delimiter MathJax: $...$ untuk inline math dan $$...$$ untuk display math"
    }
  ]
}

ATURAN EKSTRAKSI:
1. HANYA ekstrak soal yang BENAR-BENAR TERTULIS di dokumen. JANGAN menambahkan soal yang tidak ada
2. Ekstrak teks PERSIS seperti yang tertulis, jangan mengubah, menambahkan, atau mengimprovisasi
3. KRITIS - FORMAT MATEMATIKA: Bungkus SEMUA ekspresi matematika dengan $:
   - Inline math: Wrap dengan $...$
     * Contoh BENAR: "$x^2 + y^2 = r^2$"
     * Contoh BENAR: "$2y^2-8y+y-2$"
     * Contoh BENAR: "Koefisien $a^2$ dan $b^2$ dari $3a^2-2a+4b-5b^2+11$"
     * Contoh SALAH: "x^2 + y^2 = r^2" (tidak ada $)
   - Display math: Wrap dengan $$...$$
     * Contoh BENAR: "$$\\frac{1}{12}$$"
     * Contoh BENAR: "$$\\frac{a}{b} = \\frac{c}{d}$$"
   - Dalam JSON, backslash di-escape menjadi double backslash:
     * "$x^2$" → di JSON: "$x^2$"
     * "$$\\frac{1}{12}$$" → di JSON: "$$\\\\frac{1}{12}$$"
4. Untuk soal PILIHAN GANDA:
   - Identifikasi soal yang memiliki opsi A, B, C, D
   - Ekstrak semua opsi (A, B, C, D) yang ada di dokumen
   - Ekstrak kunci jawaban (A, B, C, atau D)
5. Untuk soal ESSAY:
   - Identifikasi soal yang TIDAK memiliki opsi A, B, C, D
   - Soal essay biasanya dimulai dengan nomor dan pertanyaan, diikuti dengan "Kunci Jawaban:" atau "Jawaban:"
   - Soal essay bisa juga ditandai dengan kata "Essay", "Uraian", atau bagian "B. ESSAY"
   - Ekstrak pertanyaan lengkap
   - Ekstrak kunci jawaban lengkap (semua teks setelah "Kunci Jawaban:" atau "Jawaban:"). Jika tidak ada kunci jawaban, biarkan kosong ""
6. Jika dokumen tidak berisi soal PG, kembalikan "soalPG": []
7. Jika dokumen tidak berisi soal Essay, kembalikan "soalEssay": []
8. PASTIKAN untuk memeriksa seluruh dokumen, termasuk bagian akhir yang mungkin berisi soal essay
9. Pastikan JSON valid dan bisa di-parse
10. Hanya kembalikan JSON saja, tanpa penjelasan, tanpa markdown, tanpa komentar

Contoh format output yang benar:
{
  "soalPG": [
    {
      "pertanyaan": "Hasil dari $3^{-2} + 2^{-3}$ adalah..",
      "opsiA": "$$\\\\frac{1}{12}$$",
      "opsiB": "$$\\\\frac{2}{17}$$",
      "opsiC": "$$\\\\frac{4}{11}$$",
      "opsiD": "$$\\\\frac{5}{17}$$",
      "kunciJawaban": "A"
    },
    {
      "pertanyaan": "Sederhanakan $(2y-1)(y-2)$",
      "opsiA": "$2y^2-8y+y-2$",
      "opsiB": "$2y^2-5y+2$",
      "opsiC": "$2y^2-4y+2$",
      "opsiD": "$y^2-3y+2$",
      "kunciJawaban": "B"
    },
    {
      "pertanyaan": "Koefisien untuk variabel $a^2$ dan $b^2$ dari bentuk aljabar $3a^2-2a+4b-5b^2+11$ adalah ….",
      "opsiA": "3 dan -5",
      "opsiB": "3 dan 5",
      "opsiC": "-2 dan 4",
      "opsiD": "-2 dan -5",
      "kunciJawaban": "A"
    }
  ],
  "soalEssay": [
    {
      "pertanyaan": "Jelaskan tentang konsep limit dalam matematika dengan rumus $\\\\lim_{x \\\\to a} f(x) = L$",
      "kunciJawaban": "Limit adalah nilai yang didekati oleh suatu fungsi ketika variabelnya mendekati suatu nilai tertentu. Rumusnya adalah $\\\\lim_{x \\\\to a} f(x) = L$"
    }
  ]
}

PENTING: 
- Periksa SELURUH dokumen termasuk bagian akhir untuk menemukan soal essay
- Soal essay bisa berada di bagian terpisah dengan judul "B. ESSAY", "ESSAY", atau "Uraian"
- Jika ada soal yang tidak memiliki opsi A, B, C, D, kemungkinan besar itu adalah soal essay
- Pastikan untuk mengekstrak SEMUA soal essay yang ada di dokumen
- GUNAKAN DELIMITER MATHJAX ($...$ dan $$...$$) untuk semua ekspresi matematika, JANGAN gunakan \\[...\\] atau \\(...\\)

Sekarang, ekstrak HANYA soal yang benar-benar ada di dokumen ini. JANGAN menambahkan soal yang tidak ada di dokumen. Pastikan untuk mengekstrak SEMUA soal PG dan SEMUA soal Essay yang ada.`;

export async function POST(request: NextRequest) {
  try {
    // Validasi API Key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY tidak dikonfigurasi' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'Tidak ada file yang diunggah' },
        { status: 400 }
      );
    }

    // Validasi format file - hanya PDF yang didukung
    const ext = file.name.toLowerCase().split('.').pop();
    
    if (ext !== 'pdf') {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Hanya file .pdf yang didukung.' },
        { status: 400 }
      );
    }

    // Validasi ukuran file (max 32MB untuk PDF)
    const fileSizeInMB = file.size / (1024 * 1024);
    const maxSize = 32;
    
    if (fileSizeInMB > maxSize) {
      return NextResponse.json(
        { error: `Ukuran file terlalu besar: ${fileSizeInMB.toFixed(2)}MB. Maksimal ${maxSize}MB.` },
        { status: 400 }
      );
    }

    // Convert PDF to base64 dan kirim langsung ke Claude sebagai document
    const { data: base64Data } = await readPdfToBase64(file);
    
    // Send PDF directly to Claude as document
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000, // Dinaikkan untuk memastikan response lengkap
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });
    
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';
    
    // Parse JSON from response
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      // Parse JSON dengan handling untuk LaTeX backslash
      const parsed: ParsedSoal = parseJsonWithLatex(jsonText);
      
      // Validate structure
      if (!parsed.soalPG || !parsed.soalEssay) {
        throw new Error('Format JSON tidak valid: missing soalPG or soalEssay');
      }
      
      // Post-process untuk konversi delimiter LaTeX ke MathJax
      const processed = postProcessParsedSoal(parsed);
      
      return NextResponse.json(processed);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      console.error('Response text:', responseText);
      return NextResponse.json(
        { 
          error: 'Gagal memparse respons dari Claude',
          rawResponse: responseText 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error processing file with Claude:', error);
    
    // Handle specific Anthropic API errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'API Key tidak valid. Periksa kembali ANTHROPIC_API_KEY Anda.' },
        { status: 401 }
      );
    } else if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit terlampaui. Tunggu beberapa saat sebelum mencoba lagi.' },
        { status: 429 }
      );
    } else if (error.status === 400) {
      return NextResponse.json(
        { error: 'Request tidak valid. Periksa format dokumen atau parameter.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan yang tidak diketahui' },
      { status: 500 }
    );
  }
}

