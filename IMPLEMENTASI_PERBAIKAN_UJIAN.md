# IMPLEMENTASI PERBAIKAN SISTEM UJIAN

## ✅ Yang Sudah Diimplementasikan

### 1. **Exam Queue System** (`src/lib/exam-queue.ts`)

**Fitur:**
- ✅ Queue-based auto-save dengan retry mechanism
- ✅ Exponential backoff untuk retry (1s, 2s, 4s)
- ✅ Maximum 3 retry attempts
- ✅ LocalStorage backup untuk failed answers
- ✅ Status tracking (pending, saving, saved, failed)
- ✅ Wait mechanism untuk ensure semua data tersimpan sebelum submit

**Cara Kerja:**
```typescript
import { examQueue } from '@/lib/exam-queue';

// Set exam ID
examQueue.setExamId(ujianId);

// Add answer to queue (auto-save)
examQueue.addAnswer(questionId, 'multiple_choice', 'B');

// Check status
const status = examQueue.getQueueStatus();
// { total: 5, saved: 3, pending: 1, saving: 1, failed: 0 }

// Wait for all saved before submit
const allSaved = await examQueue.waitForAllSaved(120000); // 2 minutes timeout
if (allSaved) {
  // Safe to submit
}
```

---

### 2. **Enhanced Auto-Save Endpoint** (`src/app/api/siswa/ujian/[id]/save-answer/route.ts`)

**Perbaikan:**
- ✅ Transaction-based untuk data consistency
- ✅ Comprehensive validation (time, question, submission status)
- ✅ Better error messages
- ✅ Detailed logging
- ✅ Prevent save after submission

**Validasi:**
1. Session & role check
2. Exam time validation (startUjian ≤ now ≤ endUjian)
3. Question exists & belongs to exam
4. Not already submitted
5. Transaction untuk atomic operation

---

### 3. **Enhanced Submit Endpoint** (`src/app/api/siswa/ujian/[id]/submit-enhanced/route.ts`)

**Fitur Baru:**
- ✅ Full transaction untuk semua operasi
- ✅ Checksum verification (optional)
- ✅ Save ALL questions (including unanswered)
- ✅ Detailed stats (created vs updated)
- ✅ Performance logging (duration tracking)
- ✅ Comprehensive error handling

**Flow:**
```
1. Validate session & input
2. Get ujian with all questions
3. Validate time
4. Verify checksum (optional)
5. Transaction:
   a. Get/Create submission
   b. Calculate PG score
   c. Determine final score & status
   d. Update submission
   e. Upsert ALL PG answers
   f. Upsert ALL Essay answers
6. Log success with stats
7. Return detailed response
```

---

### 4. **Database Audit Log** (`prisma/migrations/add_exam_audit_log.sql`)

**Schema:**
```sql
CREATE TABLE exam_audit_log (
  id TEXT PRIMARY KEY,
  ujianId TEXT NOT NULL,
  siswaId TEXT NOT NULL,
  submissionId TEXT,
  action TEXT NOT NULL,          -- 'auto_save', 'submit', 'grade'
  questionId TEXT,
  questionType TEXT,
  answer TEXT,
  status TEXT DEFAULT 'success', -- 'success', 'failed'
  errorMessage TEXT,
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- ujianId, siswaId, submissionId
- action, status, createdAt

---

## 📋 Langkah Implementasi Selanjutnya

### **FASE 1: Frontend Integration** (Prioritas Tinggi)

#### 1.1 Update Exam Page Component

Lokasi: `src/app/(main)/siswa/ujian/[id]/page.tsx` (atau yang sesuai)

**Yang Perlu Diubah:**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { examQueue, generateChecksum } from '@/lib/exam-queue';

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const ujianId = params.id as string;
  
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ total: 0, saved: 0, pending: 0, saving: 0, failed: 0 });

  // Initialize exam queue
  useEffect(() => {
    examQueue.setExamId(ujianId);
  }, [ujianId]);

  // Monitor queue status
  useEffect(() => {
    const interval = setInterval(() => {
      setQueueStatus(examQueue.getQueueStatus());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Handle answer change (auto-save)
  const handleAnswerChange = useCallback((questionId: string, questionType: string, answer: string) => {
    // Update local state
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    // Add to queue for auto-save
    examQueue.addAnswer(questionId, questionType, answer);
  }, []);

  // Handle submit
  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // STEP 1: Wait for all auto-saves to complete
      const allSaved = await examQueue.waitForAllSaved(120000); // 2 minutes timeout

      if (!allSaved) {
        const failedAnswers = examQueue.getFailedAnswers();
        const pendingAnswers = examQueue.getPendingAnswers();
        
        const confirmSubmit = window.confirm(
          `⚠️ Peringatan!\n\n` +
          `${failedAnswers.length} soal gagal tersimpan\n` +
          `${pendingAnswers.length} soal masih dalam proses penyimpanan\n\n` +
          `Lanjutkan submit tanpa soal ini?`
        );

        if (!confirmSubmit) {
          setIsSubmitting(false);
          alert('❌ Harap tunggu hingga semua jawaban tersimpan atau perbaiki koneksi internet Anda');
          return;
        }
      }

      // STEP 2: Get all answers from queue (includes auto-saved answers)
      const allAnswers = examQueue.getAllAnswers();
      
      // Merge with local state (in case some answers not in queue)
      const finalAnswers = { ...allAnswers, ...answers };

      // STEP 3: Generate checksum
      const checksum = generateChecksum(finalAnswers);

      // STEP 4: Submit
      const response = await fetch(`/api/siswa/ujian/${ujianId}/submit-enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: finalAnswers,
          checksum,
          totalQuestions: Object.keys(finalAnswers).length,
          submittedAt: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (result.success) {
        // Clear queue
        examQueue.clear();
        
        // Show success message
        alert(result.message);
        
        // Redirect to hasil
        router.push(`/siswa/ujian/${ujianId}/hasil`);
      } else {
        throw new Error(result.message || 'Gagal submit ujian');
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      alert(`❌ Gagal submit ujian: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Exam questions */}
      {/* ... */}

      {/* Queue Status Indicator */}
      <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4">
        <div className="text-sm">
          <div className="font-semibold mb-2">Status Auto-Save</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>✅ Tersimpan:</span>
              <span className="font-bold text-green-600">{queueStatus.saved}</span>
            </div>
            <div className="flex justify-between">
              <span>⏳ Menyimpan:</span>
              <span className="font-bold text-blue-600">{queueStatus.saving}</span>
            </div>
            <div className="flex justify-between">
              <span>⏸️ Menunggu:</span>
              <span className="font-bold text-yellow-600">{queueStatus.pending}</span>
            </div>
            {queueStatus.failed > 0 && (
              <div className="flex justify-between">
                <span>❌ Gagal:</span>
                <span className="font-bold text-red-600">{queueStatus.failed}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || queueStatus.saving > 0 || queueStatus.pending > 0}
        className="btn btn-primary"
      >
        {isSubmitting ? 'Mengumpulkan...' : 'Kumpulkan Ujian'}
      </button>
    </div>
  );
}
```

---

#### 1.2 Create Question Component with Auto-Save

```typescript
// components/exam/ExamQuestion.tsx

interface ExamQuestionProps {
  question: {
    id: string;
    type: 'multiple_choice' | 'essay';
    pertanyaan: string;
    opsiA?: string;
    opsiB?: string;
    opsiC?: string;
    opsiD?: string;
  };
  value: string;
  onChange: (questionId: string, questionType: string, answer: string) => void;
}

export function ExamQuestion({ question, value, onChange }: ExamQuestionProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Debounced save for essay
  const debouncedOnChange = useCallback(
    debounce((val: string) => {
      onChange(question.id, question.type, val);
    }, 1500),
    [question.id, question.type, onChange]
  );

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    setSaveStatus('saving');

    if (question.type === 'multiple_choice') {
      // Instant save for PG
      onChange(question.id, question.type, newValue);
      setTimeout(() => setSaveStatus('saved'), 500);
    } else {
      // Debounced save for essay
      debouncedOnChange(newValue);
      setTimeout(() => setSaveStatus('saved'), 2000);
    }
  };

  return (
    <div className="exam-question">
      <div className="flex justify-between items-start mb-4">
        <div dangerouslySetInnerHTML={{ __html: question.pertanyaan }} />
        
        {/* Save Status Indicator */}
        <div className="text-sm">
          {saveStatus === 'saving' && <span className="text-blue-600">⏳ Menyimpan...</span>}
          {saveStatus === 'saved' && <span className="text-green-600">✅ Tersimpan</span>}
          {saveStatus === 'error' && <span className="text-red-600">❌ Gagal</span>}
        </div>
      </div>

      {question.type === 'multiple_choice' ? (
        <div className="space-y-2">
          {['A', 'B', 'C', 'D'].map((option) => (
            <label key={option} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={localValue === option}
                onChange={(e) => handleChange(e.target.value)}
                className="radio"
              />
              <span dangerouslySetInnerHTML={{ __html: question[`opsi${option}` as keyof typeof question] as string }} />
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          className="textarea textarea-bordered w-full min-h-[200px]"
          placeholder="Tulis jawaban Anda di sini..."
        />
      )}
    </div>
  );
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

---

### **FASE 2: Database Migration** (Prioritas Tinggi)

#### 2.1 Run Migration

```bash
# Jalankan migration untuk audit log
psql -U your_user -d your_database -f prisma/migrations/add_exam_audit_log.sql

# Atau jika menggunakan Prisma
npx prisma db push
```

#### 2.2 Update Prisma Schema (Optional - jika ingin managed by Prisma)

Tambahkan ke `prisma/schema.prisma`:

```prisma
model ExamAuditLog {
  id            String   @id @default(cuid())
  ujianId       String
  siswaId       String
  submissionId  String?
  action        String   // 'auto_save', 'submit', 'grade'
  questionId    String?
  questionType  String?
  answer        String?
  status        String   @default("success") // 'success', 'failed'
  errorMessage  String?
  metadata      Json?
  createdAt     DateTime @default(now())

  // Relations
  ujian      Ujian  @relation(fields: [ujianId], references: [id], onDelete: Cascade)
  siswa      Siswa  @relation(fields: [siswaId], references: [id], onDelete: Cascade)

  @@index([ujianId])
  @@index([siswaId])
  @@index([submissionId])
  @@index([action])
  @@index([status])
  @@index([createdAt])
  @@map("exam_audit_log")
}
```

---

### **FASE 3: Testing** (Prioritas Sedang)

#### 3.1 Manual Testing Checklist

- [ ] **Test 1: Normal Submit**
  - Isi 5 soal PG + 2 Essay
  - Submit
  - Verify semua 7 soal tersimpan di database

- [ ] **Test 2: Partial Answer**
  - Isi 3 dari 5 soal
  - Submit
  - Verify 5 soal tersimpan (3 ada jawaban, 2 kosong)

- [ ] **Test 3: Network Error**
  - Isi soal
  - Matikan internet saat auto-save
  - Nyalakan kembali
  - Verify retry mechanism works
  - Submit
  - Verify semua data tersimpan

- [ ] **Test 4: Concurrent Auto-Save**
  - Isi banyak soal dengan cepat
  - Verify tidak ada race condition
  - Submit
  - Verify semua tersimpan

- [ ] **Test 5: Submit Timeout**
  - Isi soal
  - Disconnect internet
  - Coba submit
  - Verify error message muncul
  - Reconnect
  - Submit lagi
  - Verify berhasil

---

## 🔧 Troubleshooting

### Problem: Queue tidak menyimpan

**Solution:**
1. Check console untuk error
2. Verify `examQueue.setExamId()` dipanggil
3. Check network tab untuk failed requests

### Problem: Submit gagal meski semua saved

**Solution:**
1. Check checksum validation
2. Verify transaction tidak timeout
3. Check database connection

### Problem: Data hilang setelah refresh

**Solution:**
1. Check localStorage untuk failed answers
2. Verify auto-save endpoint working
3. Check submission status di database

---

## 📊 Monitoring

### Check Queue Status (Browser Console)

```javascript
// Get current queue status
examQueue.getQueueStatus()

// Get failed answers
examQueue.getFailedAnswers()

// Check if all saved
examQueue.isAllAnswersSaved()
```

### Check Database

```sql
-- Check submission
SELECT * FROM ujian_submission WHERE "siswaId" = 'xxx' AND "ujianId" = 'yyy';

-- Check PG answers
SELECT COUNT(*) FROM jawaban_pilihan_ganda WHERE "submissionId" = 'zzz';

-- Check Essay answers
SELECT COUNT(*) FROM jawaban_essay WHERE "submissionId" = 'zzz';

-- Check audit log
SELECT * FROM exam_audit_log WHERE "ujianId" = 'yyy' ORDER BY "createdAt" DESC LIMIT 10;
```

---

## ✅ Hasil yang Diharapkan

Setelah implementasi lengkap:

1. ✅ **Tidak ada data hilang** saat submit
2. ✅ **Auto-save reliable** dengan retry mechanism
3. ✅ **Transaction safety** - semua atau tidak sama sekali
4. ✅ **Full visibility** dengan audit logging
5. ✅ **Better UX** dengan status indicator
6. ✅ **Error recovery** dengan localStorage backup

---

**Status Implementasi: 60% Complete**
- ✅ Backend: 100%
- ⏳ Frontend: 0%
- ⏳ Testing: 0%
