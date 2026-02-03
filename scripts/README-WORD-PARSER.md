# 📝 Word Document Parser for Exam Questions

Sistem untuk mengekstrak soal ujian dari file Word (.docx) dengan dukungan gambar dan struktur soal yang kompleks.

## 🚀 Cara Penggunaan

### 1. Via Web Interface (Next.js App)

1. Buka halaman Create Ujian
2. Pilih tab **"Import"**
3. Pilih sub-tab **"📝 Word (.docx)"**
4. Upload file .docx Anda
5. Soal akan otomatis diparse dan ditambahkan ke daftar

### 2. Via Standalone Script (Test)

```bash
# Install dependency
npm install mammoth

# Jalankan script
node scripts/test-word-parser.js path/to/your/file.docx

# Output akan disimpan di: scripts/questions.json
```

## 📋 Format File Word

### Struktur Dasar

```
1. Look at the pictures!

[Gambar bisa ditempatkan di sini]

Fahri likes .....

A. orange juice
B. ice cream
C. coffee
D. tea

2. Pertanyaan kedua?
A. Pilihan A
B. Pilihan B
C. Pilihan C
D. Pilihan D

3. Soal essay (tanpa pilihan)
Jelaskan tentang...
```

### Rules Penting

1. **Nomor Soal**: Harus format `1. `, `2. `, `3. `, dst.
2. **Pilihan Ganda**: Gunakan `A.`, `B.`, `C.`, `D.`
3. **Gambar**: Placement "In Line with Text"
4. **Essay**: Soal tanpa pilihan A/B/C/D otomatis jadi Essay

## 🖼️ Cara Menambahkan Gambar

1. **Insert Image** di Word
2. Klik kanan pada gambar → **Wrap Text** → **In Line with Text**
3. Posisikan gambar di antara:
   - Text pertanyaan DAN
   - Pilihan jawaban (A, B, C, D)

### Contoh Posisi Gambar

```
1. Look at the picture!
   ↓
[GAMBAR DI SINI]
   ↓
Fahri likes .....
   ↓
A. orange juice
B. ice cream
```

## 📊 Output Structure

```json
{
  "questionNumber": "1",
  "questionText": "Look at the pictures!",
  "image": "data:image/png;base64,iVBORw0KG...",
  "context": "Fahri likes .....",
  "options": [
    "orange juice",
    "ice cream",
    "coffee",
    "tea"
  ]
}
```

## 🔧 Technical Details

### Library: Mammoth

- **Library**: [mammoth.js](https://github.com/mwilliamson/mammoth.js)
- **Fungsi**: Convert .docx → HTML
- **Image Handling**: Base64 embedding

### Parsing Logic

1. **Split by Question Numbers**
   - Regex: `/(\d+)\.\s+/g`
   - Deteksi: `1. `, `2. `, `3. `, etc.

2. **Extract Images**
   - Mammoth converts images → `<img>` tag with Base64 src
   - Image placement preserved

3. **Detect Options**
   - Regex: `/[A-Da-d]\.\s*([^\n]+)/g`
   - Match: `A. option text`

4. **Separate Components**
   - **Question Text**: Text sebelum gambar
   - **Image**: Base64 data URI
   - **Context**: Text antara gambar dan pilihan
   - **Options**: Array of options

## ⚙️ API Endpoint

### POST `/api/word/parse-mammoth`

**Request:**
```typescript
FormData {
  file: File (*.docx)
}
```

**Response:**
```typescript
{
  success: boolean;
  questions: Array<{
    questionNumber: string;
    questionText: string;
    image?: string;
    context?: string;
    options: string[];
  }>;
  messages?: string[]; // Warnings from Mammoth
}
```

## 🎯 Use Cases

### 1. Multiple Choice dengan Gambar

```
1. Look at the picture!

[Gambar buah-buahan]

What fruit is shown?

A. Apple
B. Banana
C. Orange
D. Grape
```

**Result:**
- ✅ Question: "Look at the picture!"
- ✅ Image: Base64 data
- ✅ Context: "What fruit is shown?"
- ✅ Options: ["Apple", "Banana", "Orange", "Grape"]

### 2. Essay Question

```
1. Explain the process of photosynthesis.

[Gambar diagram]

Include the following points:
- Sunlight absorption
- Carbon dioxide intake
```

**Result:**
- ✅ Question: "Explain the process of photosynthesis."
- ✅ Image: Base64 data
- ✅ Context: "Include the following points: ..."
- ✅ Options: [] (empty → Essay)

### 3. Text-Only Multiple Choice

```
1. What is 2 + 2?
A. 3
B. 4
C. 5
D. 6
```

**Result:**
- ✅ Question: "What is 2 + 2?"
- ✅ Image: undefined
- ✅ Context: undefined
- ✅ Options: ["3", "4", "5", "6"]

## 🔍 Troubleshooting

### Gambar Tidak Muncul

**Penyebab:**
- Image placement bukan "In Line with Text"
- Format gambar tidak didukung

**Solusi:**
1. Klik kanan gambar
2. Wrap Text → In Line with Text
3. Save dan re-upload

### Soal Tidak Terdeteksi

**Penyebab:**
- Nomor soal tidak format `1. `
- Ada spasi atau karakter aneh

**Solusi:**
- Gunakan format strict: `1. ` (angka, titik, spasi)
- Jangan ada bold/italic pada nomor

### Pilihan Tidak Terdeteksi

**Penyebab:**
- Format bukan `A. `, `B. `, dst.
- Ada karakter aneh setelah huruf

**Solusi:**
- Format strict: `A. ` (huruf kapital, titik, spasi)
- Pastikan setiap pilihan di baris baru

## 📝 Sample Document

Lihat contoh file Word di:
- `public/sample-exam-questions.docx` (akan dibuat)

Atau download template dari aplikasi:
- Create Ujian → Import → Download Template (Word)

## 🚧 Limitations

1. **Format File**: Hanya .docx (bukan .doc)
2. **Image Format**: PNG, JPEG, GIF
3. **Table Support**: Limited (akan di-flatten)
4. **Equation**: Word Equation akan jadi gambar

## 🔮 Future Improvements

- [ ] Support .doc (old format)
- [ ] Better equation handling (LaTeX conversion)
- [ ] Table parsing for tabular questions
- [ ] Automatic answer key detection
- [ ] Multi-column layout support

## 📞 Support

Jika ada masalah:
1. Check format file sesuai panduan
2. Test dengan standalone script dulu
3. Lihat output `questions.json`
4. Debug dari console browser/terminal

---

**Happy Teaching! 🎓**











