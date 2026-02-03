# Analisis Lengkap: Logika Ujian untuk Siswa

## 📋 Daftar Isi
1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Flow Diagram Ujian](#flow-diagram-ujian)
4. [Tahap 1: Akses Ujian](#tahap-1-akses-ujian)
5. [Tahap 2: Validasi Token](#tahap-2-validasi-token)
6. [Tahap 3: Mengerjakan Ujian](#tahap-3-mengerjakan-ujian)
7. [Tahap 4: Auto-Save](#tahap-4-auto-save)
8. [Tahap 5: Submit Ujian](#tahap-5-submit-ujian)
9. [Tahap 6: Hasil Ujian](#tahap-6-hasil-ujian)
10. [Indikator dan Sumber Data](#indikator-dan-sumber-data)
11. [Time Management](#time-management)
12. [Validasi dan Keamanan](#validasi-dan-keamanan)

---

## Overview

Sistem ujian untuk siswa dirancang dengan flow yang ketat untuk memastikan:
- ✅ Akses ujian hanya pada waktu yang ditentukan
- ✅ Validasi token sebelum mulai mengerjakan
- ✅ Auto-save jawaban secara real-time
- ✅ Time management yang akurat
- ✅ Auto-submit saat waktu habis
- ✅ Scoring otomatis untuk Pilihan Ganda
- ✅ Manual grading untuk Essay

---

## Database Schema

### Tabel Utama

#### 1. `ujian` (Tabel Ujian)
**Lokasi:** `prisma/schema.prisma` - Model `Ujian`

| Field | Type | Deskripsi | Indikator |
|-------|------|-----------|-----------|
| `id` | String | ID unik ujian | Primary Key |
| `judul` | String | Judul ujian | Informasi ujian |
| `deskripsi` | String? | Deskripsi ujian | Informasi ujian |
| `mapelId` | String | ID mata pelajaran | Relasi ke `MataPelajaran` |
| `guruId` | String | ID guru pembuat | Relasi ke `Guru` |
| `kelas` | String[] | Array nama kelas | Filter akses siswa |
| `tanggal` | DateTime | Tanggal ujian | **Indikator waktu mulai** |
| `waktuMulai` | String | Waktu mulai (format: "HH:mm") | **Indikator waktu mulai** |
| `durasi` | Int | Durasi dalam menit | **Indikator waktu akhir** |
| `status` | String | Status: "draft", "aktif", "selesai" | **Indikator akses** |
| `shuffleQuestions` | Boolean | Acak urutan soal | Konfigurasi |
| `showScore` | Boolean | Tampilkan nilai | Konfigurasi |

**Indikator Kunci:**
- `tanggal` + `waktuMulai` → Menentukan waktu mulai ujian
- `durasi` → Menentukan waktu akhir ujian (waktu mulai + durasi)
- `status = 'aktif'` → Ujian harus aktif untuk bisa diakses
- `kelas` → Siswa harus dalam kelas yang sesuai

#### 2. `ujian_submission` (Tabel Submission)
**Lokasi:** `prisma/schema.prisma` - Model `UjianSubmission`

| Field | Type | Deskripsi | Indikator |
|-------|------|-----------|-----------|
| `id` | String | ID unik submission | Primary Key |
| `ujianId` | String | ID ujian | Relasi ke `Ujian` |
| `siswaId` | String | ID siswa | Relasi ke `Siswa` |
| `startedAt` | DateTime | Waktu mulai mengerjakan | **Indikator waktu mulai siswa** |
| `submittedAt` | DateTime? | Waktu submit (null jika belum) | **Indikator status submit** |
| `nilai` | Int? | Nilai akhir (null jika belum) | **Indikator nilai** |
| `status` | String | Status: "draft", "in_progress", "submitted", "graded" | **Indikator status** |

**Indikator Kunci:**
- `startedAt` → Digunakan untuk menghitung waktu tersisa siswa
- `submittedAt` → Jika tidak null, berarti sudah submit
- `status` → Status progress submission

#### 3. `soal_pilihan_ganda` (Tabel Soal PG)
**Lokasi:** `prisma/schema.prisma` - Model `SoalPilihanGanda`

| Field | Type | Deskripsi | Indikator |
|-------|------|-----------|-----------|
| `id` | String | ID unik soal | Primary Key |
| `ujianId` | String | ID ujian | Relasi |
| `pertanyaan` | String | Pertanyaan | Konten soal |
| `opsiA`, `opsiB`, `opsiC`, `opsiD` | String | Opsi jawaban | Konten soal |
| `jawabanBenar` | String | Jawaban benar (A/B/C/D) | **Indikator scoring** |
| `urutan` | Int | Urutan soal | Sorting |

#### 4. `soal_essay` (Tabel Soal Essay)
**Lokasi:** `prisma/schema.prisma` - Model `SoalEssay`

| Field | Type | Deskripsi | Indikator |
|-------|------|-----------|-----------|
| `id` | String | ID unik soal | Primary Key |
| `ujianId` | String | ID ujian | Relasi |
| `pertanyaan` | String | Pertanyaan | Konten soal |
| `kunciJawaban` | String | Kunci jawaban (untuk guru) | Referensi |
| `urutan` | Int | Urutan soal | Sorting |

#### 5. `jawaban_pilihan_ganda` (Tabel Jawaban PG)
**Lokasi:** `prisma/schema.prisma` - Model `JawabanPilihanGanda`

| Field | Type | Deskripsi | Indikator |
|-------|------|-----------|-----------|
| `id` | String | ID unik jawaban | Primary Key |
| `submissionId` | String | ID submission | Relasi |
| `soalId` | String | ID soal | Relasi |
| `jawaban` | String | Jawaban siswa (A/B/C/D) | **Indikator jawaban** |
| `isCorrect` | Boolean | Benar/salah | **Indikator scoring** |

#### 6. `jawaban_essay` (Tabel Jawaban Essay)
**Lokasi:** `prisma/schema.prisma` - Model `JawabanEssay`

| Field | Type | Deskripsi | Indikator |
|-------|------|-----------|-----------|
| `id` | String | ID unik jawaban | Primary Key |
| `submissionId` | String | ID submission | Relasi |
| `soalId` | String | ID soal | Relasi |
| `jawaban` | String | Jawaban siswa | **Indikator jawaban** |
| `nilai` | Int? | Nilai dari guru | **Indikator nilai** |
| `feedback` | String? | Feedback dari guru | Informasi |
| `gradedAt` | DateTime? | Waktu dinilai | Informasi |

#### 7. `ujian_access_control` (Tabel Access Control)
**Lokasi:** `prisma/schema.prisma` - Model `UjianAccessControl`

| Field | Type | Deskripsi | Indikator |
|-------|------|-----------|-----------|
| `id` | String | ID unik | Primary Key |
| `isActive` | Boolean | Status aktif token | **Indikator validasi token** |
| `currentToken` | String? | Token aktif (6 digit) | **Indikator validasi token** |
| `tokenExpiresAt` | DateTime? | Waktu kadaluarsa token | **Indikator validasi token** |

**Catatan:** Token digunakan sebagai lapisan keamanan tambahan, tetapi **logika utama akses ujian berdasarkan waktu ujian itu sendiri**.

---

## Flow Diagram Ujian

```
┌─────────────────────────────────────────────────────────────┐
│                    SISWA MENGKLIK UJIAN                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  TAHAP 1: CEK AKSES UJIAN                                   │
│  API: GET /api/siswa/ujian/[id]                             │
│  File: src/app/api/siswa/ujian/[id]/route.ts                │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                      │
        ▼                                      ▼
┌───────────────┐                    ┌───────────────┐
│ Ujian tidak   │                    │ Ujian valid   │
│ ditemukan     │                    │ & dapat       │
│ atau tidak    │                    │ diakses       │
│ aktif         │                    │               │
└───────┬───────┘                    └───────┬───────┘
        │                                      │
        │                                      ▼
        │                    ┌──────────────────────────────┐
        │                    │ TAHAP 2: VALIDASI TOKEN     │
        │                    │ API: POST /api/siswa/ujian/  │
        │                    │       validate-token         │
        │                    │ File: src/app/api/siswa/      │
        │                    │       ujian/validate-token/   │
        │                    │       route.ts               │
        │                    └──────────────┬───────────────┘
        │                                   │
        │              ┌────────────────────┴────────────────────┐
        │              │                                        │
        │              ▼                                        ▼
        │    ┌──────────────────┐                    ┌──────────────────┐
        │    │ Token tidak      │                    │ Token valid      │
        │    │ valid/kadaluarsa │                    │                  │
        │    └────────┬──────────┘                    └────────┬──────────┘
        │             │                                       │
        │             │                                       ▼
        │             │                    ┌──────────────────────────────┐
        │             │                    │ TAHAP 3: MULAI MENGERJAKAN   │
        │             │                    │ - Tampilkan soal             │
        │             │                    │ - Auto-save aktif            │
        │             │                    │ - Timer countdown aktif      │
        │             │                    │ File: src/app/(main)/siswa/   │
        │             │                    │       ujian/[id]/page.tsx    │
        │             │                    └──────────────┬───────────────┘
        │             │                                   │
        │             │                                   ▼
        │             │                    ┌──────────────────────────────┐
        │             │                    │ TAHAP 4: AUTO-SAVE JAWABAN     │
        │             │                    │ API: POST /api/siswa/ujian/    │
        │             │                    │       [id]/save-answer         │
        │             │                    │ File: src/app/api/siswa/ujian/  │
        │             │                    │       [id]/save-answer/        │
        │             │                    │       route.ts                 │
        │             │                    └──────────────┬───────────────┘
        │             │                                   │
        │             │                                   ▼
        │             │                    ┌──────────────────────────────┐
        │             │                    │ TAHAP 5: SUBMIT UJIAN         │
        │             │                    │ API: POST /api/siswa/ujian/  │
        │             │                    │       [id]/submit             │
        │             │                    │ File: src/app/api/siswa/ujian/│
        │             │                    │       [id]/submit/route.ts   │
        │             │                    └──────────────┬───────────────┘
        │             │                                   │
        │             │                                   ▼
        │             │                    ┌──────────────────────────────┐
        │             │                    │ TAHAP 6: HASIL UJIAN          │
        │             │                    │ API: GET /api/siswa/ujian/     │
        │             │                    │       [id]/hasil               │
        │             │                    │ File: src/app/api/siswa/ujian/│
        │             │                    │       [id]/hasil/route.ts      │
        │             │                    └──────────────────────────────┘
        │             │
        └─────────────┴──────────────────────────────────────┘
```

---

## Tahap 1: Akses Ujian

### Endpoint
- **URL:** `GET /api/siswa/ujian/[id]`
- **File:** `src/app/api/siswa/ujian/[id]/route.ts`

### Proses Validasi

#### 1.1 Autentikasi
```typescript
// Cek session dan role
if (!session.isLoggedIn || session.role !== 'SISWA') {
  return 401 Unauthorized
}
```

**Indikator:**
- Sumber: Session dari `getSession()`
- Validasi: User harus login dan role = 'SISWA'

#### 1.2 Validasi Siswa
```typescript
// Cek apakah siswa ada di database
const siswa = await prisma.siswa.findFirst({
  where: { userId: session.userId },
  include: { kelas: true }
})
```

**Indikator:**
- Sumber: Tabel `siswa` (relasi dengan `User`)
- Field: `userId`, `kelas.nama`
- Validasi: Siswa harus ada di database

#### 1.3 Validasi Ujian
```typescript
// Cek apakah ujian ada, aktif, dan sesuai kelas
const ujian = await prisma.ujian.findFirst({
  where: {
    id,
    kelas: { has: siswa.kelas.nama },  // ✅ Indikator: kelas siswa
    status: 'aktif',                    // ✅ Indikator: status ujian
  }
})
```

**Indikator dari Database:**
- **Tabel:** `ujian`
- **Field `kelas`:** Array string nama kelas → Filter akses berdasarkan kelas siswa
- **Field `status`:** String → Harus = 'aktif' untuk bisa diakses
- **Field `tanggal`:** DateTime → Tanggal ujian
- **Field `waktuMulai`:** String (format "HH:mm") → Waktu mulai ujian
- **Field `durasi`:** Int (menit) → Durasi ujian

#### 1.4 Validasi Waktu Akses

**Perhitungan Waktu:**
```typescript
// Parse tanggal dan waktu mulai
const examDateObj = new Date(ujian.tanggal);
const year = examDateObj.getFullYear();
const month = examDateObj.getMonth();
const day = examDateObj.getDate();
const [hours, minutes] = ujian.waktuMulai.split(':').map(Number);

// Buat waktu mulai ujian (timezone lokal)
const examDate = new Date(year, month, day, hours, minutes, 0, 0);

// Hitung waktu akhir (waktu mulai + durasi)
const examEndTime = new Date(examDate.getTime() + ujian.durasi * 60000);
```

**Indikator Waktu:**
- **Waktu Mulai:** `ujian.tanggal` + `ujian.waktuMulai`
- **Waktu Akhir:** `examDate + (ujian.durasi * 60000)` (dalam milliseconds)
- **Waktu Sekarang:** `new Date()` (timezone lokal server)

**Kondisi Akses:**
```typescript
const canStart = 
  now >= examDate &&           // ✅ Waktu sekarang >= waktu mulai
  now <= examEndTime &&        // ✅ Waktu sekarang <= waktu akhir
  !ujian.submissions[0]?.submittedAt  // ✅ Belum ada submission yang di-submit
```

**Indikator dari Database:**
- **Tabel:** `ujian_submission`
- **Field `submittedAt`:** DateTime? → Jika tidak null, berarti sudah submit
- **Query:** `ujian.submissions[0]?.submittedAt` → Cek submission siswa untuk ujian ini

#### 1.5 Perhitungan Waktu Tersisa

**Logika:**
```typescript
if (ujian.submissions[0] && ujian.submissions[0].startedAt) {
  // Jika siswa sudah mulai, hitung dari startedAt
  const studentStartTime = new Date(ujian.submissions[0].startedAt);
  const studentEndTime = new Date(studentStartTime.getTime() + ujian.durasi * 60000);
  timeRemaining = (studentEndTime - now) / 1000; // dalam detik
} else {
  // Jika belum mulai, hitung dari waktu mulai ujian
  timeRemaining = (examEndTime - now) / 1000; // dalam detik
}
```

**Indikator dari Database:**
- **Tabel:** `ujian_submission`
- **Field `startedAt`:** DateTime → Waktu siswa mulai mengerjakan
- **Field `ujian.durasi`:** Int → Durasi ujian dalam menit

**Catatan Penting:**
- Jika siswa sudah mulai (`startedAt` ada), waktu tersisa dihitung dari `startedAt + durasi`
- Jika siswa belum mulai, waktu tersisa dihitung dari `waktuMulaiUjian + durasi`

#### 1.6 Pesan Status Akses

**Kondisi dan Pesan:**
```typescript
if (ujian.submissions[0]?.submittedAt) {
  accessMessage = 'Ujian sudah dikumpulkan';
} else if (now < examDate) {
  accessMessage = `Ujian belum dimulai. Ujian dapat diakses mulai ${tanggal} pukul ${waktuMulai}`;
} else if (now > examEndTime) {
  accessMessage = `Waktu ujian telah berakhir. Ujian berakhir pada ${tanggalAkhir} pukul ${waktuAkhir}`;
} else {
  accessMessage = 'Ujian dapat diakses';
}
```

**Indikator:**
- `submittedAt` → Status sudah submit
- `now < examDate` → Belum waktunya
- `now > examEndTime` → Sudah lewat waktu
- `now >= examDate && now <= examEndTime` → Bisa diakses

### Response Data

```json
{
  "success": true,
  "data": {
    "ujian": { /* info ujian */ },
    "soalPG": [ /* array soal PG */ ],
    "soalEssay": [ /* array soal Essay */ ],
    "submission": null | { /* submission jika ada */ },
    "canStart": boolean,        // ✅ Indikator: boleh mulai atau tidak
    "timeRemaining": number,    // ✅ Indikator: waktu tersisa (detik)
    "examStartTime": string,    // ✅ Indikator: waktu mulai (ISO)
    "examEndTime": string,      // ✅ Indikator: waktu akhir (ISO)
    "accessMessage": string     // ✅ Indikator: pesan status
  }
}
```

---

## Tahap 2: Validasi Token

### Endpoint
- **URL:** `POST /api/siswa/ujian/validate-token`
- **File:** `src/app/api/siswa/ujian/validate-token/route.ts`

### Proses Validasi

#### 2.1 Validasi Input
```typescript
if (!token || token.trim().length === 0) {
  return { error: 'Token harus diisi' }
}
```

#### 2.2 Cek Access Control
```typescript
const accessControl = await prisma.ujianAccessControl.findFirst();
```

**Indikator dari Database:**
- **Tabel:** `ujian_access_control`
- **Field `isActive`:** Boolean → Status aktif token
- **Field `currentToken`:** String? → Token aktif (6 digit)
- **Field `tokenExpiresAt`:** DateTime? → Waktu kadaluarsa token

#### 2.3 Validasi Token
```typescript
// Cek apakah access control aktif
if (!accessControl.isActive) {
  return { error: 'Akses ujian sedang tidak aktif' }
}

// Cek apakah token kadaluarsa
if (!accessControl.tokenExpiresAt || accessControl.tokenExpiresAt < now) {
  return { error: 'Token sudah kadaluarsa' }
}

// Cek apakah token cocok
if (token.trim() !== accessControl.currentToken) {
  return { error: 'Token tidak valid' }
}
```

**Indikator:**
- `isActive = true` → Token system aktif
- `tokenExpiresAt > now` → Token belum kadaluarsa
- `currentToken === token` → Token yang diinput cocok

**Catatan:** Token adalah lapisan keamanan tambahan. **Logika utama akses tetap berdasarkan waktu ujian**.

### Response
```json
{
  "success": true,
  "message": "Token valid. Anda dapat mengakses ujian.",
  "data": {
    "expiresAt": "2026-02-02T15:00:00.000Z"
  }
}
```

---

## Tahap 3: Mengerjakan Ujian

### Frontend Component
- **File:** `src/app/(main)/siswa/ujian/[id]/page.tsx`

### State Management

#### State Utama
```typescript
const [isStarted, setIsStarted] = useState(false);        // ✅ Indikator: ujian sudah mulai
const [timeRemaining, setTimeRemaining] = useState(0);    // ✅ Indikator: waktu tersisa (detik)
const [answers, setAnswers] = useState({});              // ✅ Indikator: jawaban siswa
const [saveStatus, setSaveStatus] = useState({});         // ✅ Indikator: status save per soal
```

#### State Auto-Save
```typescript
const [saveStatus, setSaveStatus] = useState<{
  [key: string]: 'saved' | 'saving' | 'typing' | 'error'
}>({});
const [lastSaved, setLastSaved] = useState<{
  [key: string]: Date
}>({});
```

**Indikator Status Save:**
- `'saved'` → Sudah tersimpan
- `'saving'` → Sedang menyimpan
- `'typing'` → Sedang mengetik (untuk essay)
- `'error'` → Gagal menyimpan

### Timer Countdown

#### Setup Timer
```typescript
useEffect(() => {
  if (!isStarted) return;
  
  const timer = setInterval(() => {
    setTimeRemaining((prev) => {
      if (prev <= 0) {
        clearInterval(timer);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  return () => clearInterval(timer);
}, [isStarted, timeRemaining]);
```

**Indikator:**
- `isStarted = true` → Timer aktif
- `timeRemaining` → Countdown setiap detik
- `timeRemaining <= 0` → Waktu habis, trigger auto-submit

### Auto-Submit saat Waktu Habis

#### Logic Auto-Submit
```typescript
useEffect(() => {
  // Guard: Jangan auto-submit saat initial load
  if (isInitialLoadRef.current) return;
  
  // Guard: Jangan auto-submit jika belum mulai
  if (!isStarted) return;
  
  // Guard: Jangan auto-submit jika waktu masih ada
  if (timeRemaining > 0) return;
  
  // Guard: Jangan auto-submit jika sudah submit
  if (hasAutoSubmittedRef.current || isSubmitting) return;
  
  // Guard: Cek apakah sudah di-submit
  if (ujianData?.submission?.submittedAt) return;
  
  // Cek minimal ada 1 soal terjawab
  const answeredCount = Object.keys(answers).filter(key => {
    const answer = answers[key];
    return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
  }).length;
  
  if (answeredCount > 0) {
    handleAutoSubmit(); // Auto-submit
  }
}, [timeRemaining, isStarted, answers, isSubmitting]);
```

**Indikator:**
- `timeRemaining <= 0` → Waktu habis
- `answeredCount > 0` → Minimal ada 1 soal terjawab
- `hasAutoSubmittedRef.current = false` → Belum pernah auto-submit
- `ujianData?.submission?.submittedAt` → Belum ada submission yang di-submit

---

## Tahap 4: Auto-Save

### Endpoint
- **URL:** `POST /api/siswa/ujian/[id]/save-answer`
- **File:** `src/app/api/siswa/ujian/[id]/save-answer/route.ts`

### Proses Auto-Save

#### 4.1 Validasi
```typescript
// Cek apakah sudah submit
const existingSubmission = await prisma.ujianSubmission.findFirst({
  where: {
    ujianId: id,
    siswaId: siswa.id,
    submittedAt: { not: null }
  }
});

if (existingSubmission) {
  return { error: 'Ujian sudah dikumpulkan' }
}
```

**Indikator dari Database:**
- **Tabel:** `ujian_submission`
- **Field `submittedAt`:** DateTime? → Jika tidak null, berarti sudah submit

#### 4.2 Get atau Create Submission
```typescript
let submission = await prisma.ujianSubmission.findFirst({
  where: {
    ujianId: id,
    siswaId: siswa.id
  }
});

if (!submission) {
  // Create draft submission dengan startedAt = waktu sekarang
  submission = await prisma.ujianSubmission.create({
    data: {
      ujianId: id,
      siswaId: siswa.id,
      startedAt: new Date(),  // ✅ Indikator: waktu mulai siswa
      status: 'draft'
    }
  });
}
```

**Indikator dari Database:**
- **Tabel:** `ujian_submission`
- **Field `startedAt`:** DateTime → Waktu siswa mulai mengerjakan (dibuat saat pertama kali save)
- **Field `status`:** String → 'draft' untuk auto-save

#### 4.3 Save Jawaban PG
```typescript
if (questionType === 'multiple_choice') {
  const existingAnswer = await prisma.jawabanPilihanGanda.findUnique({
    where: {
      submissionId_soalId: {
        submissionId: submission.id,
        soalId: questionId
      }
    }
  });
  
  if (existingAnswer) {
    // Update
    await prisma.jawabanPilihanGanda.update({
      where: { id: existingAnswer.id },
      data: {
        jawaban: answer,
        isCorrect: answer === soal.jawabanBenar  // ✅ Indikator: benar/salah
      }
    });
  } else {
    // Create
    await prisma.jawabanPilihanGanda.create({
      data: {
        submissionId: submission.id,
        soalId: questionId,
        jawaban: answer,
        isCorrect: answer === soal.jawabanBenar
      }
    });
  }
}
```

**Indikator dari Database:**
- **Tabel:** `jawaban_pilihan_ganda`
- **Field `jawaban`:** String → Jawaban siswa (A/B/C/D)
- **Field `isCorrect`:** Boolean → Benar/salah (dibandingkan dengan `soal.jawabanBenar`)

#### 4.4 Save Jawaban Essay
```typescript
if (questionType === 'essay') {
  const existingAnswer = await prisma.jawabanEssay.findUnique({
    where: {
      submissionId_soalId: {
        submissionId: submission.id,
        soalId: questionId
      }
    }
  });
  
  if (existingAnswer) {
    // Update
    await prisma.jawabanEssay.update({
      where: { id: existingAnswer.id },
      data: { jawaban: answer }
    });
  } else {
    // Create
    await prisma.jawabanEssay.create({
      data: {
        submissionId: submission.id,
        soalId: questionId,
        jawaban: answer
      }
    });
  }
}
```

**Indikator dari Database:**
- **Tabel:** `jawaban_essay`
- **Field `jawaban`:** String → Jawaban siswa (text)

### Frontend Auto-Save Strategy

#### Pilihan Ganda (Instant Save)
```typescript
// Instant save untuk PG (setelah 500ms debounce untuk batch)
setTimeout(() => {
  savePgBatch(); // Batch save multiple PG answers
}, 500);
```

#### Essay (Debounced Save)
```typescript
// Debounced save untuk Essay (3 detik setelah berhenti mengetik)
const timer = setTimeout(() => {
  saveAnswerToServer(questionId, 'essay', answer);
}, 3000);
```

#### Auto-Save Interval (Essay)
```typescript
// Auto-save setiap 15 detik untuk Essay
useEffect(() => {
  if (!isStarted || !ujianData) return;
  
  const interval = setInterval(() => {
    soalEssay.forEach((soal) => {
      const answer = answers[soal.id];
      if (answer && answer.trim() !== '') {
        saveAnswerToServer(soal.id, 'essay', answer);
      }
    });
  }, 15000); // 15 seconds
  
  return () => clearInterval(interval);
}, [isStarted, ujianData, answers]);
```

**Indikator:**
- PG: Save instant (500ms batch)
- Essay: Save debounced (3 detik) + auto-save setiap 15 detik

---

## Tahap 5: Submit Ujian

### Endpoint
- **URL:** `POST /api/siswa/ujian/[id]/submit`
- **File:** `src/app/api/siswa/ujian/[id]/submit/route.ts`

### Proses Submit

#### 5.1 Validasi
```typescript
// Cek apakah sudah submit
const existingSubmission = await prisma.ujianSubmission.findFirst({
  where: {
    ujianId: id,
    siswaId: siswa.id
  }
});

if (existingSubmission) {
  return { error: 'Ujian sudah dikumpulkan' }
}
```

**Indikator dari Database:**
- **Tabel:** `ujian_submission`
- **Field `submittedAt`:** DateTime? → Jika sudah ada, berarti sudah submit

#### 5.2 Hitung Nilai PG
```typescript
let correctPG = 0;
const totalPG = ujian.soalPilihanGanda.length;

ujian.soalPilihanGanda.forEach((soal) => {
  if (answers[soal.id] === soal.jawabanBenar) {
    correctPG++;
  }
});
```

**Indikator dari Database:**
- **Tabel:** `soal_pilihan_ganda`
- **Field `jawabanBenar`:** String → Jawaban benar (A/B/C/D)
- **Perhitungan:** `correctPG / totalPG * 100`

#### 5.3 Tentukan Final Score
```typescript
const totalEssay = ujian.soalEssay.length;
const hasEssay = totalEssay > 0;

let finalScore = null;
if (!hasEssay && totalPG > 0) {
  // Hanya PG, hitung score langsung
  finalScore = Math.round((correctPG / totalPG) * 100);
}
```

**Indikator:**
- Jika ada Essay → `finalScore = null` (tunggu grading guru)
- Jika hanya PG → `finalScore = (correctPG / totalPG) * 100`

#### 5.4 Create Submission
```typescript
const submission = await prisma.ujianSubmission.create({
  data: {
    ujianId: id,
    siswaId: siswa.id,
    startedAt: new Date(),      // ✅ Indikator: waktu mulai
    submittedAt: new Date(),    // ✅ Indikator: waktu submit
    nilai: finalScore,          // ✅ Indikator: nilai (null jika ada essay)
    status: hasEssay ? 'pending' : 'completed'  // ✅ Indikator: status
  }
});
```

**Indikator dari Database:**
- **Tabel:** `ujian_submission`
- **Field `startedAt`:** DateTime → Waktu mulai (bisa dari auto-save sebelumnya)
- **Field `submittedAt`:** DateTime → Waktu submit (tidak null = sudah submit)
- **Field `nilai`:** Int? → Nilai akhir (null jika ada essay)
- **Field `status`:** String → 'pending' (ada essay) atau 'completed' (hanya PG)

#### 5.5 Simpan Jawaban
```typescript
// Simpan jawaban PG
for (const soal of ujian.soalPilihanGanda) {
  await prisma.jawabanPilihanGanda.create({
    data: {
      submissionId: submission.id,
      soalId: soal.id,
      jawaban: answers[soal.id],
      isCorrect: answers[soal.id] === soal.jawabanBenar
    }
  });
}

// Simpan jawaban Essay
for (const soal of ujian.soalEssay) {
  await prisma.jawabanEssay.create({
    data: {
      submissionId: submission.id,
      soalId: soal.id,
      jawaban: answers[soal.id]
    }
  });
}
```

**Indikator dari Database:**
- **Tabel:** `jawaban_pilihan_ganda` → Jawaban PG dengan `isCorrect`
- **Tabel:** `jawaban_essay` → Jawaban Essay (belum ada nilai)

### Frontend Validation

#### Validasi Sebelum Submit
```typescript
const validateAllAnswers = () => {
  const allQuestions = [...soalPG, ...soalEssay];
  const unansweredQuestions = [];
  
  allQuestions.forEach((q, idx) => {
    const answer = answers[q.id];
    if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
      unansweredQuestions.push(idx + 1);
    }
  });
  
  if (unansweredQuestions.length > 0) {
    return {
      valid: false,
      message: `Masih ada ${unansweredQuestions.length} soal yang belum dijawab`
    };
  }
  
  return { valid: true };
};
```

**Indikator:**
- Semua soal harus terjawab sebelum submit manual
- Auto-submit (waktu habis) tidak perlu validasi lengkap

---

## Tahap 6: Hasil Ujian

### Endpoint
- **URL:** `GET /api/siswa/ujian/[id]/hasil`
- **File:** `src/app/api/siswa/ujian/[id]/hasil/route.ts`

### Proses Fetch Hasil

#### 6.1 Get Ujian dan Submission
```typescript
const ujian = await prisma.ujian.findFirst({
  where: { id },
  include: {
    mapel: true,
    soalPilihanGanda: { orderBy: { urutan: 'asc' } },
    soalEssay: { orderBy: { urutan: 'asc' } }
  }
});

const submission = await prisma.ujianSubmission.findFirst({
  where: {
    ujianId: id,
    siswaId: siswa.id
  },
  include: {
    jawabanPilihanGanda: true,
    jawabanEssay: true
  }
});
```

**Indikator dari Database:**
- **Tabel:** `ujian` → Info ujian
- **Tabel:** `ujian_submission` → Submission siswa
- **Tabel:** `jawaban_pilihan_ganda` → Jawaban PG siswa
- **Tabel:** `jawaban_essay` → Jawaban Essay siswa

#### 6.2 Map Answers
```typescript
const answersMap = {};

// Map PG answers
submission.jawabanPilihanGanda.forEach((answer) => {
  answersMap[answer.soalId] = answer.jawaban;
});

// Map Essay answers
submission.jawabanEssay.forEach((answer) => {
  answersMap[answer.soalId] = answer.jawaban;
});
```

### Response Data
```json
{
  "success": true,
  "data": {
    "ujian": {
      "id": "...",
      "judul": "...",
      "mapel": "...",
      "durasi": 60,
      "tanggal": "2026-02-02T00:00:00.000Z"
    },
    "submission": {
      "id": "...",
      "nilai": 85,              // ✅ Indikator: nilai akhir
      "status": "completed",    // ✅ Indikator: status
      "submittedAt": "2026-02-02T03:00:00.000Z"  // ✅ Indikator: waktu submit
    },
    "soalPG": [ /* array soal PG */ ],
    "soalEssay": [ /* array soal Essay */ ],
    "answers": { /* map jawaban siswa */ }
  }
}
```

---

## Indikator dan Sumber Data

### Ringkasan Indikator

| Indikator | Sumber Database | Tabel | Field | Keterangan |
|-----------|----------------|-------|-------|------------|
| **Akses Ujian** | | | | |
| Status ujian aktif | `ujian` | `status` | `status = 'aktif'` | Ujian harus aktif |
| Kelas siswa sesuai | `ujian` | `kelas` | Array string | Filter kelas |
| Waktu mulai ujian | `ujian` | `tanggal` + `waktuMulai` | DateTime + String | Kombinasi tanggal dan waktu |
| Waktu akhir ujian | `ujian` | `tanggal` + `waktuMulai` + `durasi` | Calculated | Waktu mulai + durasi |
| Sudah submit | `ujian_submission` | `submittedAt` | DateTime? | Tidak null = sudah submit |
| **Waktu Tersisa** | | | | |
| Waktu mulai siswa | `ujian_submission` | `startedAt` | DateTime | Waktu siswa mulai |
| Durasi ujian | `ujian` | `durasi` | Int (menit) | Durasi dalam menit |
| Waktu tersisa | Calculated | - | - | `(startedAt + durasi) - now` |
| **Jawaban** | | | | |
| Jawaban PG | `jawaban_pilihan_ganda` | `jawaban` | String (A/B/C/D) | Jawaban siswa |
| Benar/salah PG | `jawaban_pilihan_ganda` | `isCorrect` | Boolean | Dibandingkan dengan `soal.jawabanBenar` |
| Jawaban Essay | `jawaban_essay` | `jawaban` | String | Jawaban siswa |
| **Nilai** | | | | |
| Nilai akhir | `ujian_submission` | `nilai` | Int? | Nilai akhir (null jika ada essay) |
| Status submission | `ujian_submission` | `status` | String | 'draft', 'pending', 'completed' |
| **Token** | | | | |
| Token aktif | `ujian_access_control` | `isActive` | Boolean | Status aktif token |
| Token valid | `ujian_access_control` | `currentToken` | String? | Token aktif (6 digit) |
| Token kadaluarsa | `ujian_access_control` | `tokenExpiresAt` | DateTime? | Waktu kadaluarsa |

---

## Time Management

### Perhitungan Waktu

#### 1. Waktu Mulai Ujian
```typescript
// Dari database
const examDateObj = new Date(ujian.tanggal);  // DateTime
const [hours, minutes] = ujian.waktuMulai.split(':');  // String "HH:mm"

// Kombinasi menjadi waktu mulai
const examDate = new Date(
  examDateObj.getFullYear(),
  examDateObj.getMonth(),
  examDateObj.getDate(),
  hours,
  minutes,
  0,
  0
);
```

**Sumber Data:**
- `ujian.tanggal` → DateTime dari database
- `ujian.waktuMulai` → String format "HH:mm"

#### 2. Waktu Akhir Ujian
```typescript
const examEndTime = new Date(
  examDate.getTime() + ujian.durasi * 60000  // durasi dalam milliseconds
);
```

**Sumber Data:**
- `ujian.durasi` → Int (menit)
- Perhitungan: `waktuMulai + (durasi * 60000)` milliseconds

#### 3. Waktu Tersisa (Jika Belum Mulai)
```typescript
if (!submission || !submission.startedAt) {
  timeRemaining = Math.max(0, (examEndTime.getTime() - now.getTime()) / 1000);
}
```

**Sumber Data:**
- `examEndTime` → Waktu akhir ujian
- `now` → Waktu sekarang
- Hasil: Detik tersisa

#### 4. Waktu Tersisa (Jika Sudah Mulai)
```typescript
if (submission && submission.startedAt) {
  const studentStartTime = new Date(submission.startedAt);
  const studentEndTime = new Date(
    studentStartTime.getTime() + ujian.durasi * 60000
  );
  timeRemaining = Math.max(0, (studentEndTime.getTime() - now.getTime()) / 1000);
}
```

**Sumber Data:**
- `submission.startedAt` → Waktu siswa mulai mengerjakan
- `ujian.durasi` → Durasi ujian
- Perhitungan: `(startedAt + durasi) - now`

**Catatan Penting:**
- Jika siswa sudah mulai, waktu tersisa dihitung dari `startedAt` (bukan dari waktu mulai ujian)
- Ini memungkinkan siswa yang mulai terlambat tetap mendapat durasi penuh

---

## Validasi dan Keamanan

### 1. Validasi Akses
- ✅ Session dan role harus valid
- ✅ Siswa harus ada di database
- ✅ Ujian harus aktif (`status = 'aktif'`)
- ✅ Kelas siswa harus sesuai dengan ujian
- ✅ Waktu harus dalam range (waktu mulai ≤ now ≤ waktu akhir)
- ✅ Belum ada submission yang di-submit

### 2. Validasi Token
- ✅ Token harus diisi
- ✅ Access control harus aktif (`isActive = true`)
- ✅ Token belum kadaluarsa (`tokenExpiresAt > now`)
- ✅ Token cocok dengan database (`currentToken === token`)

### 3. Validasi Submit
- ✅ Belum ada submission yang di-submit (`submittedAt = null`)
- ✅ Minimal ada 1 soal terjawab (untuk auto-submit)
- ✅ Semua soal terjawab (untuk manual submit)

### 4. Validasi Save
- ✅ Belum ada submission yang di-submit
- ✅ Soal harus ada dan sesuai dengan ujian
- ✅ Question type harus valid ('multiple_choice' atau 'essay')

---

## Kesimpulan

### Flow Lengkap
1. **Akses Ujian** → Validasi waktu, status, kelas
2. **Validasi Token** → Token harus valid dan aktif
3. **Mengerjakan** → Auto-save, timer countdown
4. **Auto-Save** → PG instant, Essay debounced + interval
5. **Submit** → Hitung nilai, simpan jawaban
6. **Hasil** → Tampilkan nilai dan jawaban

### Indikator Kunci
- **Waktu:** `ujian.tanggal`, `ujian.waktuMulai`, `ujian.durasi`
- **Status:** `ujian.status`, `ujian_submission.status`
- **Akses:** `ujian.kelas`, `ujian_submission.submittedAt`
- **Jawaban:** `jawaban_pilihan_ganda`, `jawaban_essay`
- **Nilai:** `ujian_submission.nilai`

### Database Tables
1. `ujian` → Info ujian
2. `ujian_submission` → Submission siswa
3. `soal_pilihan_ganda` → Soal PG
4. `soal_essay` → Soal Essay
5. `jawaban_pilihan_ganda` → Jawaban PG
6. `jawaban_essay` → Jawaban Essay
7. `ujian_access_control` → Token access control

---

**Dokumen ini dibuat untuk analisis lengkap logika ujian siswa dari awal hingga selesai.**



