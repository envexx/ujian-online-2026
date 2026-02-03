# DOKUMENTASI SISTEM UJIAN - LENGKAP
## Learning Management System (LMS)

---

## 📋 DAFTAR ISI

1. [Database Schema](#database-schema)
2. [Alur Lengkap Sistem Ujian](#alur-lengkap-sistem-ujian)
3. [API Endpoints Detail](#api-endpoints-detail)
4. [Proses CRUD Ujian](#proses-crud-ujian)
5. [Proses Pengerjaan Ujian](#proses-pengerjaan-ujian)
6. [Sistem Penilaian](#sistem-penilaian)
7. [Access Control System](#access-control-system)
8. [Flow Diagram](#flow-diagram)

---

## 1. DATABASE SCHEMA

### 1.1 Tabel Ujian
```prisma
model Ujian {
  id                String   @id @default(cuid())
  judul             String
  deskripsi         String?
  mapelId           String
  guruId            String
  kelas             String[]              // Array kelas yang bisa mengakses
  startUjian        DateTime              // Waktu mulai ujian
  endUjian          DateTime              // Waktu akhir ujian
  shuffleQuestions  Boolean  @default(false)
  showScore         Boolean  @default(true)
  status            String   @default("draft") // draft, aktif, selesai
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  mapel            MataPelajaran
  guru             Guru
  soalPilihanGanda SoalPilihanGanda[]
  soalEssay        SoalEssay[]
  submissions      UjianSubmission[]
}
```

### 1.2 Tabel Soal Pilihan Ganda
```prisma
model SoalPilihanGanda {
  id            String   @id @default(cuid())
  ujianId       String
  pertanyaan    String
  opsiA         String
  opsiB         String
  opsiC         String
  opsiD         String
  jawabanBenar  String   // A, B, C, D
  urutan        Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  ujian   Ujian
  jawaban JawabanPilihanGanda[]
}
```

### 1.3 Tabel Soal Essay
```prisma
model SoalEssay {
  id           String   @id @default(cuid())
  ujianId      String
  pertanyaan   String
  kunciJawaban String
  urutan       Int
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  ujian   Ujian
  jawaban JawabanEssay[]
}
```

### 1.4 Tabel Submission Ujian
```prisma
model UjianSubmission {
  id          String    @id @default(cuid())
  ujianId     String
  siswaId     String
  startedAt   DateTime  @default(now())    // Waktu mulai mengerjakan
  submittedAt DateTime?                     // Waktu submit (null = draft)
  nilai       Int?                          // Nilai akhir
  status      String    @default("in_progress") // in_progress, draft, pending, submitted, graded, completed
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  ujian              Ujian
  siswa              Siswa
  jawabanPilihanGanda JawabanPilihanGanda[]
  jawabanEssay       JawabanEssay[]

  @@unique([ujianId, siswaId])
}
```

### 1.5 Tabel Jawaban Pilihan Ganda
```prisma
model JawabanPilihanGanda {
  id           String   @id @default(cuid())
  submissionId String
  soalId       String
  jawaban      String   // A, B, C, D (atau empty string jika tidak dijawab)
  isCorrect    Boolean  @default(false)
  createdAt    DateTime @default(now())

  // Relations
  submission UjianSubmission
  soal       SoalPilihanGanda

  @@unique([submissionId, soalId])
}
```

### 1.6 Tabel Jawaban Essay
```prisma
model JawabanEssay {
  id           String    @id @default(cuid())
  submissionId String
  soalId       String
  jawaban      String
  nilai        Int?                          // Nilai dari guru (0-100)
  feedback     String?                       // Feedback dari guru
  gradedAt     DateTime?                     // Waktu dinilai
  createdAt    DateTime  @default(now())

  // Relations
  submission UjianSubmission
  soal       SoalEssay

  @@unique([submissionId, soalId])
}
```

### 1.7 Tabel Access Control (Admin Only)
```prisma
model UjianAccessControl {
  id              String    @id @default(cuid())
  isActive        Boolean   @default(false)   // Status global akses ujian
  currentToken    String?                     // Token 6 digit aktif
  tokenGeneratedAt DateTime?                  // Waktu generate token
  tokenExpiresAt  DateTime?                   // Token expired setelah 30 menit
  generatedBy     String?                     // Admin user ID
  description     String?                     // Deskripsi sesi
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

## 2. ALUR LENGKAP SISTEM UJIAN

### 2.1 FASE 1: PEMBUATAN UJIAN (GURU)

#### Step 1: Guru Membuat Ujian Baru
**Endpoint:** `POST /api/guru/ujian`

**Request Body:**
```json
{
  "judul": "Ujian Matematika Bab 1",
  "deskripsi": "Ujian tentang aljabar",
  "mapelId": "clxxx123",
  "kelas": ["7A", "7B"],
  "startUjian": "2024-02-05T08:00:00.000Z",
  "endUjian": "2024-02-05T10:00:00.000Z",
  "shuffleQuestions": false,
  "showScore": true,
  "status": "draft",
  "soalPG": [
    {
      "pertanyaan": "<p>Berapa hasil 2 + 2?</p>",
      "opsiA": "3",
      "opsiB": "4",
      "opsiC": "5",
      "opsiD": "6",
      "kunciJawaban": "B"
    }
  ],
  "soalEssay": [
    {
      "pertanyaan": "<p>Jelaskan konsep aljabar</p>",
      "kunciJawaban": "Aljabar adalah..."
    }
  ]
}
```

**Proses Backend:**
1. Validasi session (harus GURU)
2. Get data guru dari userId
3. Validasi waktu ujian:
   - `startUjian` dan `endUjian` harus valid
   - `endUjian` > `startUjian`
4. Validasi soal berdasarkan status:
   - **Jika status = "draft"**: Minimal 1 opsi terisi per soal PG
   - **Jika status = "aktif"**: SEMUA opsi (A, B, C, D) harus terisi
5. Filter soal yang valid
6. Create ujian dengan transaction:
   - Insert ke tabel `Ujian`
   - Insert semua soal PG ke `SoalPilihanGanda`
   - Insert semua soal Essay ke `SoalEssay`

**Response:**
```json
{
  "success": true,
  "data": {
    "ujian": { /* data ujian */ },
    "totalSoalPG": 10,
    "totalSoalEssay": 5
  },
  "message": "Ujian berhasil ditambahkan"
}
```

---

#### Step 2: Guru Mengupdate Ujian
**Endpoint:** `PUT /api/guru/ujian/[id]`

**Request Body:** (sama seperti POST)

**Proses Backend:**
1. Validasi session dan kepemilikan ujian
2. Validasi waktu dan soal (sama seperti POST)
3. Update dengan transaction:
   - Update data ujian
   - **DELETE semua soal lama** (cascade)
   - **INSERT soal baru**
4. Memastikan konsistensi data

---

#### Step 3: Guru Mengubah Status Ujian
**Endpoint:** `PUT /api/guru/ujian` (update status)

**Request Body:**
```json
{
  "id": "ujian123",
  "status": "aktif"
}
```

**Proses Backend:**
1. Validasi kepemilikan ujian
2. **Jika status = "aktif"**:
   - Cek minimal 1 soal PG
   - Cek SEMUA opsi (A-D) terisi untuk semua soal
3. Update status ujian

**Status Ujian:**
- `draft`: Ujian masih dalam tahap pembuatan
- `aktif`: Ujian dipublikasikan dan bisa diakses siswa
- `selesai`: Ujian sudah berakhir

---

### 2.2 FASE 2: AKSES UJIAN (SISWA)

#### Step 1: Siswa Melihat Daftar Ujian
**Endpoint:** `GET /api/siswa/ujian`

**Proses Backend:**
1. Validasi session (harus SISWA)
2. Get data siswa dan kelas
3. Query ujian dengan filter:
   - `kelas` contains nama kelas siswa
   - `status` = "aktif"
4. Untuk setiap ujian, tentukan:
   - **examStatus**: 
     - `belum_dimulai`: now < startUjian
     - `berlangsung`: startUjian ≤ now ≤ endUjian
     - `berakhir`: now > endUjian
     - `selesai`: sudah ada submission
   - **canStart**: true jika status = "berlangsung" dan belum submit

**Response:**
```json
{
  "success": true,
  "data": {
    "ujian": [
      {
        "id": "ujian123",
        "judul": "Ujian Matematika",
        "mapel": "Matematika",
        "startUjian": "2024-02-05T08:00:00.000Z",
        "endUjian": "2024-02-05T10:00:00.000Z",
        "totalSoal": 15,
        "examStatus": "berlangsung",
        "canStart": true,
        "submission": null
      }
    ]
  }
}
```

---

#### Step 2: Siswa Membuka Detail Ujian
**Endpoint:** `GET /api/siswa/ujian/[id]`

**Proses Backend:**
1. Validasi session dan kelas siswa
2. Get ujian dengan soal (tanpa kunci jawaban untuk PG)
3. Validasi waktu:
   - Cek apakah ujian sudah dimulai
   - Cek apakah ujian belum berakhir
4. Hitung waktu tersisa:
   - `timeRemaining = (endUjian - now) / 1000` (dalam detik)
   - Waktu tersisa dihitung dari `endUjian`, bukan dari durasi
5. Tentukan `canStart`:
   - true jika: now ≥ startUjian AND now ≤ endUjian AND belum submit

**Response:**
```json
{
  "success": true,
  "data": {
    "ujian": {
      "id": "ujian123",
      "judul": "Ujian Matematika",
      "startUjian": "2024-02-05T08:00:00.000Z",
      "endUjian": "2024-02-05T10:00:00.000Z",
      "shuffleQuestions": false,
      "totalSoal": 15
    },
    "soalPG": [
      {
        "id": "soal1",
        "nomor": 1,
        "pertanyaan": "<p>Berapa 2+2?</p>",
        "opsiA": "3",
        "opsiB": "4",
        "opsiC": "5",
        "opsiD": "6"
      }
    ],
    "soalEssay": [
      {
        "id": "soal2",
        "nomor": 1,
        "pertanyaan": "<p>Jelaskan aljabar</p>"
      }
    ],
    "submission": null,
    "canStart": true,
    "timeRemaining": 7200,
    "examStartTime": "2024-02-05T08:00:00.000Z",
    "examEndTime": "2024-02-05T10:00:00.000Z",
    "accessMessage": "Ujian dapat diakses"
  }
}
```

---

### 2.3 FASE 3: PENGERJAAN UJIAN (AUTO-SAVE)

#### Step 1: Siswa Mulai Mengerjakan (Auto-Save Pertama)
**Endpoint:** `POST /api/siswa/ujian/[id]/save-answer`

**Request Body:**
```json
{
  "questionId": "soal1",
  "questionType": "multiple_choice",
  "answer": "B"
}
```

**Proses Backend:**
1. Validasi session dan waktu ujian
2. Cek apakah ujian sudah di-submit (prevent save after submit)
3. **Get or Create Submission:**
   - Cari submission dengan `ujianId` dan `siswaId`
   - Jika tidak ada, CREATE dengan:
     - `startedAt`: now
     - `status`: "draft"
     - `submittedAt`: null
4. **Save Answer:**
   - Cari jawaban existing dengan `submissionId` dan `soalId`
   - Jika ada: UPDATE jawaban
   - Jika tidak: CREATE jawaban baru
5. Untuk PG: hitung `isCorrect` langsung

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Jawaban berhasil disimpan",
    "savedAt": "2024-02-05T08:15:30.000Z"
  }
}
```

**Catatan Penting:**
- Auto-save terjadi setiap kali siswa menjawab
- Untuk PG: instant save
- Untuk Essay: debounced save (delay 1-2 detik)
- Submission dibuat dengan status "draft"
- `startedAt` dicatat saat submission pertama kali dibuat

---

#### Step 2: Batch Save (Opsional)
**Endpoint:** `PUT /api/siswa/ujian/[id]/save-answer`

**Request Body:**
```json
{
  "answers": [
    { "questionId": "soal1", "answer": "B" },
    { "questionId": "soal2", "answer": "C" }
  ]
}
```

**Proses Backend:**
- Sama seperti single save, tapi batch processing
- Menggunakan `Promise.all()` untuk parallel save

---

### 2.4 FASE 4: SUBMIT UJIAN

#### Step 1: Siswa Submit Ujian
**Endpoint:** `POST /api/siswa/ujian/[id]/submit`

**Request Body:**
```json
{
  "answers": {
    "soal1": "B",
    "soal2": "C",
    "soal3": "Jawaban essay panjang..."
  }
}
```

**Proses Backend:**

**1. Validasi Awal:**
- Cek session siswa
- Cek waktu ujian (now ≤ endUjian)
- Cek apakah sudah pernah submit

**2. Hitung Nilai PG:**
```javascript
let correctPG = 0;
const totalPG = ujian.soalPilihanGanda.length;

ujian.soalPilihanGanda.forEach((soal) => {
  const userAnswer = answers[soal.id];
  if (userAnswer && userAnswer === soal.jawabanBenar) {
    correctPG++;
  }
});

// Nilai PG = (benar / total) * 100
const nilaiPG = Math.round((correctPG / totalPG) * 100);
```

**3. Tentukan Nilai Akhir:**
```javascript
const totalEssay = ujian.soalEssay.length;
const hasEssay = totalEssay > 0;

let finalScore = null;
if (!hasEssay && totalPG > 0) {
  // Hanya PG, langsung hitung nilai
  finalScore = Math.round((correctPG / totalPG) * 100);
} else {
  // Ada essay, nilai akan dihitung setelah guru mengoreksi
  finalScore = null;
}
```

**4. Update atau Create Submission:**
```javascript
if (existingSubmission && !existingSubmission.submittedAt) {
  // Update draft submission
  submission = await prisma.ujianSubmission.update({
    where: { id: existingSubmission.id },
    data: {
      submittedAt: new Date(),
      nilai: finalScore,
      status: hasEssay ? 'pending' : 'completed'
    }
  });
} else {
  // Create new submission
  submission = await prisma.ujianSubmission.create({
    data: {
      ujianId: id,
      siswaId: siswa.id,
      startedAt: new Date(),
      submittedAt: new Date(),
      nilai: finalScore,
      status: hasEssay ? 'pending' : 'completed'
    }
  });
}
```

**5. Save Semua Jawaban:**

**Untuk PG:**
```javascript
for (const soal of ujian.soalPilihanGanda) {
  const userAnswer = answers[soal.id] || '';
  const isCorrect = userAnswer ? userAnswer === soal.jawabanBenar : false;
  
  // Cek existing answer dari auto-save
  const existingAnswer = existingSubmission?.jawabanPilihanGanda?.find(
    j => j.soalId === soal.id
  );
  
  if (existingAnswer) {
    // Update existing
    await prisma.jawabanPilihanGanda.update({
      where: { id: existingAnswer.id },
      data: { jawaban: userAnswer, isCorrect }
    });
  } else {
    // Create new
    await prisma.jawabanPilihanGanda.create({
      data: {
        submissionId: submission.id,
        soalId: soal.id,
        jawaban: userAnswer,
        isCorrect
      }
    });
  }
}
```

**Untuk Essay:**
```javascript
for (const soal of ujian.soalEssay) {
  const userAnswer = answers[soal.id] || '';
  
  const existingAnswer = existingSubmission?.jawabanEssay?.find(
    j => j.soalId === soal.id
  );
  
  if (existingAnswer) {
    await prisma.jawabanEssay.update({
      where: { id: existingAnswer.id },
      data: { jawaban: userAnswer }
    });
  } else {
    await prisma.jawabanEssay.create({
      data: {
        submissionId: submission.id,
        soalId: soal.id,
        jawaban: userAnswer
      }
    });
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "submission": { /* data submission */ },
    "score": 85,
    "correctPG": 17,
    "totalPG": 20,
    "pgSaved": 20,
    "essaySaved": 5,
    "message": "Ujian berhasil dikumpulkan. Nilai Anda: 85"
  }
}
```

**Status Submission:**
- `draft`: Sedang auto-save, belum submit
- `pending`: Sudah submit, menunggu koreksi essay
- `completed`: Sudah submit dan sudah dinilai

---

### 2.5 FASE 5: PENILAIAN GURU

#### Step 1: Guru Melihat Daftar Submission
**Endpoint:** `GET /api/guru/ujian/[id]/nilai`

**Proses Backend:**
1. Get ujian dengan semua submission
2. Get semua siswa di kelas yang ditargetkan
3. Untuk setiap siswa:
   - Cari submission-nya
   - Hitung nilai PG: `(benar / total) * 100`
   - Hitung nilai Essay: `sum(nilai) / total`
   - Status: "sudah" atau "belum"

**Response:**
```json
{
  "success": true,
  "data": {
    "ujian": {
      "id": "ujian123",
      "judul": "Ujian Matematika",
      "totalSoalPG": 20,
      "totalSoalEssay": 5
    },
    "soalPG": [ /* daftar soal dengan kunci jawaban */ ],
    "soalEssay": [ /* daftar soal dengan kunci jawaban */ ],
    "submissions": [
      {
        "id": "sub123",
        "siswaId": "siswa1",
        "siswa": "Ahmad",
        "nisn": "123456",
        "submittedAt": "2024-02-05T09:30:00.000Z",
        "nilaiPG": 85,
        "nilaiEssay": null,
        "nilaiTotal": null,
        "status": "sudah",
        "jawabanPG": [ /* jawaban PG */ ],
        "jawabanEssay": [ /* jawaban essay */ ]
      }
    ]
  }
}
```

---

#### Step 2: Guru Menilai Essay
**Endpoint:** `PUT /api/guru/ujian/[id]/nilai`

**Request Body:**
```json
{
  "submissionId": "sub123",
  "jawabanEssay": [
    {
      "id": "jawaban1",
      "nilai": 85,
      "feedback": "Jawaban bagus, lengkap"
    },
    {
      "id": "jawaban2",
      "nilai": 90,
      "feedback": "Sempurna"
    }
  ]
}
```

**Proses Backend:**

**1. Update Jawaban Essay:**
```javascript
for (const jawaban of jawabanEssay) {
  await prisma.jawabanEssay.update({
    where: { id: jawaban.id },
    data: {
      nilai: jawaban.nilai,
      feedback: jawaban.feedback || '',
      gradedAt: new Date()
    }
  });
}
```

**2. Hitung Nilai Akhir:**
```javascript
// Get submission dengan semua jawaban
const submission = await prisma.ujianSubmission.findUnique({
  where: { id: submissionId },
  include: {
    ujian: { include: { soalPilihanGanda: true, soalEssay: true } },
    jawabanPilihanGanda: true,
    jawabanEssay: true
  }
});

const totalSoalPG = submission.ujian.soalPilihanGanda.length;
const totalSoalEssay = submission.ujian.soalEssay.length;
const totalSoal = totalSoalPG + totalSoalEssay;

// Nilai PG
const correctPG = submission.jawabanPilihanGanda.filter(j => j.isCorrect).length;
const nilaiPG = totalSoalPG > 0 ? Math.round((correctPG / totalSoalPG) * 100) : 0;

// Nilai Essay
const totalNilaiEssay = submission.jawabanEssay.reduce((sum, j) => sum + (j.nilai || 0), 0);
const nilaiEssay = totalSoalEssay > 0 ? totalNilaiEssay / totalSoalEssay : 0;

// Nilai Akhir (weighted)
const bobotPG = totalSoalPG / totalSoal;
const bobotEssay = totalSoalEssay / totalSoal;
const nilaiAkhir = Math.round((nilaiPG * bobotPG) + (nilaiEssay * bobotEssay));
```

**3. Update Submission:**
```javascript
await prisma.ujianSubmission.update({
  where: { id: submissionId },
  data: {
    nilai: nilaiAkhir,
    status: 'completed'
  }
});
```

**Response:**
```json
{
  "success": true,
  "message": "Nilai essay berhasil disimpan",
  "data": {
    "nilai": 87
  }
}
```

---

### 2.6 FASE 6: MELIHAT HASIL

#### Siswa Melihat Hasil Ujian
**Endpoint:** `GET /api/siswa/ujian/[id]/hasil`

**Proses Backend:**
1. Get ujian dengan submission siswa
2. Get semua jawaban (PG dan Essay)
3. Convert jawaban ke format object map

**Response:**
```json
{
  "success": true,
  "data": {
    "ujian": {
      "id": "ujian123",
      "judul": "Ujian Matematika",
      "mapel": "Matematika",
      "startUjian": "2024-02-05T08:00:00.000Z",
      "endUjian": "2024-02-05T10:00:00.000Z"
    },
    "submission": {
      "id": "sub123",
      "nilai": 87,
      "status": "completed",
      "submittedAt": "2024-02-05T09:30:00.000Z",
      "startedAt": "2024-02-05T08:05:00.000Z"
    },
    "soalPG": [ /* soal dengan kunci jawaban */ ],
    "soalEssay": [ /* soal dengan kunci jawaban */ ],
    "answers": {
      "soal1": "B",
      "soal2": "C",
      "soal3": "Jawaban essay..."
    }
  }
}
```

---

## 3. API ENDPOINTS DETAIL

### 3.1 GURU ENDPOINTS

| Method | Endpoint | Fungsi | Auth |
|--------|----------|--------|------|
| GET | `/api/guru/ujian` | List semua ujian guru | GURU |
| POST | `/api/guru/ujian` | Buat ujian baru | GURU |
| PUT | `/api/guru/ujian` | Update status ujian | GURU |
| DELETE | `/api/guru/ujian?id=xxx` | Hapus ujian | GURU |
| GET | `/api/guru/ujian/[id]` | Detail ujian dengan soal | GURU |
| PUT | `/api/guru/ujian/[id]` | Update ujian lengkap | GURU |
| GET | `/api/guru/ujian/[id]/nilai` | List submission & nilai | GURU |
| PUT | `/api/guru/ujian/[id]/nilai` | Nilai essay | GURU |

### 3.2 SISWA ENDPOINTS

| Method | Endpoint | Fungsi | Auth |
|--------|----------|--------|------|
| GET | `/api/siswa/ujian` | List ujian untuk siswa | SISWA |
| GET | `/api/siswa/ujian/[id]` | Detail ujian (soal tanpa kunci) | SISWA |
| POST | `/api/siswa/ujian/[id]/save-answer` | Auto-save jawaban | SISWA |
| PUT | `/api/siswa/ujian/[id]/save-answer` | Batch save jawaban | SISWA |
| POST | `/api/siswa/ujian/[id]/submit` | Submit ujian final | SISWA |
| GET | `/api/siswa/ujian/[id]/hasil` | Lihat hasil ujian | SISWA |
| POST | `/api/siswa/ujian/validate-token` | Validasi token akses | SISWA |

### 3.3 ADMIN ENDPOINTS

| Method | Endpoint | Fungsi | Auth |
|--------|----------|--------|------|
| GET | `/api/admin/ujian-access` | Status token akses | ADMIN |
| POST | `/api/admin/ujian-access` | Generate token baru | ADMIN |
| PUT | `/api/admin/ujian-access` | Nonaktifkan token | ADMIN |

---

## 4. PROSES CRUD UJIAN

### 4.1 CREATE (POST)
```
POST /api/guru/ujian
  ↓
Validasi Session (GURU)
  ↓
Get Guru Data
  ↓
Validasi Waktu Ujian
  ↓
Validasi Soal (berdasarkan status)
  ↓
Filter Soal Valid
  ↓
Transaction:
  - INSERT Ujian
  - INSERT SoalPilihanGanda (batch)
  - INSERT SoalEssay (batch)
  ↓
Return Success
```

### 4.2 READ (GET)
```
GET /api/guru/ujian
  ↓
Validasi Session (GURU)
  ↓
Get Guru Data
  ↓
Query Ujian dengan filter status
  ↓
Include: mapel, _count (soal & submission)
  ↓
Return List Ujian
```

### 4.3 UPDATE (PUT)
```
PUT /api/guru/ujian/[id]
  ↓
Validasi Session & Kepemilikan
  ↓
Validasi Data (sama seperti CREATE)
  ↓
Transaction:
  - UPDATE Ujian
  - DELETE Semua Soal Lama
  - INSERT Soal Baru
  ↓
Return Success
```

### 4.4 DELETE (DELETE)
```
DELETE /api/guru/ujian?id=xxx
  ↓
Validasi Session & Kepemilikan
  ↓
DELETE Ujian (cascade ke soal & submission)
  ↓
Return Success
```

---

## 5. PROSES PENGERJAAN UJIAN

### 5.1 Flow Lengkap Pengerjaan

```
Siswa Login
  ↓
GET /api/siswa/ujian (List ujian)
  ↓
Pilih Ujian
  ↓
GET /api/siswa/ujian/[id] (Detail & Soal)
  ↓
Validasi Waktu & Akses
  ↓
Mulai Mengerjakan
  ↓
┌─────────────────────────────┐
│   AUTO-SAVE (Real-time)     │
├─────────────────────────────┤
│ Setiap jawab soal:          │
│ POST /save-answer           │
│   ↓                         │
│ Get/Create Submission       │
│   ↓                         │
│ Upsert Jawaban              │
│   ↓                         │
│ Return Success              │
└─────────────────────────────┘
  ↓
Siswa Klik Submit
  ↓
POST /api/siswa/ujian/[id]/submit
  ↓
Validasi Waktu
  ↓
Hitung Nilai PG
  ↓
Update/Create Submission
  - submittedAt = now
  - status = pending/completed
  - nilai = calculated
  ↓
Upsert Semua Jawaban
  ↓
Return Hasil
```

### 5.2 Auto-Save Mechanism

**Untuk Pilihan Ganda:**
- Trigger: onChange event
- Delay: Instant (0ms)
- Method: POST /save-answer

**Untuk Essay:**
- Trigger: onBlur atau onChange
- Delay: Debounced 1-2 detik
- Method: POST /save-answer

**Submission Status:**
1. **Belum mulai**: Tidak ada submission
2. **Draft**: Ada submission, `submittedAt` = null
3. **Pending**: Sudah submit, ada essay belum dinilai
4. **Completed**: Sudah submit dan dinilai

---

## 6. SISTEM PENILAIAN

### 6.1 Penilaian Pilihan Ganda (Otomatis)

**Saat Auto-Save:**
```javascript
const isCorrect = userAnswer === soal.jawabanBenar;
// Simpan isCorrect ke database
```

**Saat Submit:**
```javascript
let correctPG = 0;
ujian.soalPilihanGanda.forEach(soal => {
  if (answers[soal.id] === soal.jawabanBenar) {
    correctPG++;
  }
});

const nilaiPG = Math.round((correctPG / totalPG) * 100);
```

### 6.2 Penilaian Essay (Manual oleh Guru)

**Guru Input Nilai:**
```javascript
PUT /api/guru/ujian/[id]/nilai
Body: {
  submissionId: "xxx",
  jawabanEssay: [
    { id: "jawaban1", nilai: 85, feedback: "Bagus" },
    { id: "jawaban2", nilai: 90, feedback: "Sempurna" }
  ]
}
```

**Hitung Rata-rata Essay:**
```javascript
const totalNilaiEssay = jawabanEssay.reduce((sum, j) => sum + j.nilai, 0);
const nilaiEssay = totalNilaiEssay / totalSoalEssay;
```

### 6.3 Nilai Akhir (Weighted Average)

```javascript
const totalSoal = totalSoalPG + totalSoalEssay;
const bobotPG = totalSoalPG / totalSoal;
const bobotEssay = totalSoalEssay / totalSoal;

const nilaiAkhir = Math.round(
  (nilaiPG * bobotPG) + (nilaiEssay * bobotEssay)
);
```

**Contoh:**
- Total Soal PG: 20 (nilai 85)
- Total Soal Essay: 5 (nilai 90)
- Total Soal: 25
- Bobot PG: 20/25 = 0.8
- Bobot Essay: 5/25 = 0.2
- Nilai Akhir: (85 × 0.8) + (90 × 0.2) = 68 + 18 = **86**

---

## 7. ACCESS CONTROL SYSTEM

### 7.1 Konsep
- Admin dapat generate token 6 digit
- Token berlaku 30 menit
- Siswa harus input token untuk akses ujian (opsional)
- Token bersifat global (semua ujian)

### 7.2 Flow Admin

```
Admin Login
  ↓
POST /api/admin/ujian-access
Body: { description: "Ujian Semester 1" }
  ↓
Generate Token (6 digit alphanumeric)
  ↓
Set Expiry (now + 30 menit)
  ↓
Update/Create UjianAccessControl
  - isActive: true
  - currentToken: "ABC123"
  - tokenExpiresAt: now + 30min
  ↓
Return Token ke Admin
```

### 7.3 Flow Siswa (dengan Token)

```
Siswa Input Token
  ↓
POST /api/siswa/ujian/validate-token
Body: { token: "ABC123" }
  ↓
Get UjianAccessControl
  ↓
Validasi:
  - isActive = true?
  - tokenExpiresAt > now?
  - token === currentToken?
  ↓
Return Success/Error
```

### 7.4 Deaktivasi Token

```
PUT /api/admin/ujian-access
  ↓
Update UjianAccessControl:
  - isActive: false
  - currentToken: null
  - tokenExpiresAt: null
  ↓
Return Success
```

---

## 8. FLOW DIAGRAM

### 8.1 Diagram Alur Lengkap

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEM UJIAN LMS                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│   GURU       │
└──────┬───────┘
       │
       ├─► POST /api/guru/ujian
       │   └─► Create Ujian + Soal
       │
       ├─► PUT /api/guru/ujian/[id]
       │   └─► Update Ujian + Soal
       │
       ├─► PUT /api/guru/ujian
       │   └─► Update Status (draft → aktif)
       │
       ├─► GET /api/guru/ujian/[id]/nilai
       │   └─► Lihat Submission & Nilai
       │
       └─► PUT /api/guru/ujian/[id]/nilai
           └─► Nilai Essay → Hitung Nilai Akhir

┌──────────────┐
│   ADMIN      │
└──────┬───────┘
       │
       ├─► POST /api/admin/ujian-access
       │   └─► Generate Token (30 menit)
       │
       └─► PUT /api/admin/ujian-access
           └─► Deaktivasi Token

┌──────────────┐
│   SISWA      │
└──────┬───────┘
       │
       ├─► GET /api/siswa/ujian
       │   └─► List Ujian (filter kelas & status)
       │
       ├─► POST /api/siswa/ujian/validate-token (opsional)
       │   └─► Validasi Token Akses
       │
       ├─► GET /api/siswa/ujian/[id]
       │   └─► Detail Ujian + Soal (tanpa kunci)
       │
       ├─► POST /api/siswa/ujian/[id]/save-answer
       │   └─► Auto-Save Jawaban (real-time)
       │   └─► Create/Update Submission (draft)
       │
       ├─► POST /api/siswa/ujian/[id]/submit
       │   └─► Submit Final
       │   └─► Hitung Nilai PG
       │   └─► Update Submission (pending/completed)
       │
       └─► GET /api/siswa/ujian/[id]/hasil
           └─► Lihat Hasil & Pembahasan

┌─────────────────────────────────────────────────────────────┐
│                    DATABASE FLOW                            │
└─────────────────────────────────────────────────────────────┘

Ujian
  ├─► SoalPilihanGanda (1:N)
  ├─► SoalEssay (1:N)
  └─► UjianSubmission (1:N)
        ├─► JawabanPilihanGanda (1:N)
        └─► JawabanEssay (1:N)
```

### 8.2 State Diagram Submission

```
┌─────────────┐
│  No Submit  │
└──────┬──────┘
       │ Siswa mulai mengerjakan
       │ POST /save-answer
       ▼
┌─────────────┐
│    DRAFT    │ ◄─┐
│ (Auto-save) │   │ Setiap jawab soal
└──────┬──────┘   │ POST /save-answer
       │          │
       └──────────┘
       │
       │ Siswa klik Submit
       │ POST /submit
       ▼
┌─────────────────┐
│  PENDING/       │
│  COMPLETED      │
│ (Sudah Submit)  │
└─────────┬───────┘
          │
          │ Guru nilai essay (jika ada)
          │ PUT /nilai
          ▼
    ┌─────────────┐
    │  COMPLETED  │
    │ (Ada Nilai) │
    └─────────────┘
```

### 8.3 Timeline Ujian

```
Timeline:
├─────────────┼─────────────┼─────────────┼─────────────┤
│             │             │             │             │
│  Belum      │ Berlangsung │  Berakhir   │   Selesai   │
│  Dimulai    │             │             │  (Submit)   │
│             │             │             │             │
now < start   start ≤ now   now > end     submission    
              ≤ end                        exists        

Status:
- belum_dimulai: Ujian belum bisa diakses
- berlangsung: Ujian bisa dikerjakan
- berakhir: Waktu habis, tidak bisa submit
- selesai: Sudah submit
```

---

## 9. CATATAN PENTING

### 9.1 Validasi Waktu
- Semua validasi waktu menggunakan `startUjian` dan `endUjian` dari database
- Waktu tersisa dihitung dari `endUjian - now`, bukan dari durasi
- Siswa tidak bisa save/submit jika `now > endUjian`

### 9.2 Auto-Save vs Submit
- **Auto-Save**: Menyimpan progress, status = "draft"
- **Submit**: Finalisasi, status = "pending"/"completed"
- Auto-save tidak menghitung nilai, submit menghitung nilai

### 9.3 Handling Soal Tidak Dijawab
- Saat submit, SEMUA soal disimpan (termasuk yang tidak dijawab)
- Jawaban kosong disimpan sebagai empty string `""`
- Nilai PG tetap dihitung berdasarkan total soal, bukan jawaban tersimpan

### 9.4 Transaction Safety
- Create/Update ujian menggunakan transaction
- Hapus soal lama → Insert soal baru (atomic)
- Mencegah data inconsistency

### 9.5 Cascade Delete
- Hapus ujian → otomatis hapus soal & submission
- Hapus submission → otomatis hapus jawaban
- Defined di Prisma schema dengan `onDelete: Cascade`

---

## 10. TROUBLESHOOTING

### 10.1 Siswa Tidak Bisa Akses Ujian
**Cek:**
1. Status ujian = "aktif"?
2. Kelas siswa ada di array `ujian.kelas`?
3. Waktu sekarang antara `startUjian` dan `endUjian`?
4. Token valid (jika menggunakan access control)?

### 10.2 Nilai Tidak Muncul
**Cek:**
1. Submission status = "completed"?
2. Jika ada essay, sudah dinilai guru?
3. Field `nilai` di submission tidak null?

### 10.3 Auto-Save Gagal
**Cek:**
1. Waktu ujian belum berakhir?
2. Belum pernah submit?
3. Soal ID valid dan belongs to ujian?

---

**Dokumentasi ini mencakup seluruh flow sistem ujian dari database hingga API endpoints dengan detail lengkap.**
