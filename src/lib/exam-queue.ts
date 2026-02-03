/**
 * Exam Answer Queue System
 * Handles auto-save with retry mechanism to prevent data loss
 */

interface QueuedAnswer {
  id: string;
  questionId: string;
  questionType: 'multiple_choice' | 'essay';
  answer: string;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'saving' | 'saved' | 'failed';
  error?: string;
}

interface QueueStatus {
  total: number;
  saved: number;
  pending: number;
  saving: number;
  failed: number;
}

class ExamAnswerQueue {
  private queue: Map<string, QueuedAnswer> = new Map();
  private isProcessing = false;
  private examId: string = '';
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  setExamId(examId: string) {
    this.examId = examId;
  }

  /**
   * Add answer to queue
   */
  addAnswer(questionId: string, questionType: 'multiple_choice' | 'essay', answer: string) {
    // Use questionId as key to prevent duplicates
    const existing = this.queue.get(questionId);
    
    if (existing && existing.status === 'saving') {
      // Don't override if currently saving
      return;
    }

    this.queue.set(questionId, {
      id: questionId,
      questionId,
      questionType,
      answer,
      timestamp: Date.now(),
      retryCount: existing?.retryCount || 0,
      status: 'pending',
      error: undefined
    });

    // Trigger processing
    this.processQueue();
  }

  /**
   * Process queue with retry logic
   */
  async processQueue() {
    if (this.isProcessing || this.queue.size === 0 || !this.examId) {
      return;
    }
    
    this.isProcessing = true;

    for (const [questionId, item] of this.queue.entries()) {
      if (item.status === 'saved' || item.status === 'saving') {
        continue;
      }

      // Mark as saving
      item.status = 'saving';

      try {
        const response = await fetch(`/api/siswa/ujian/${this.examId}/save-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: item.questionId,
            questionType: item.questionType,
            answer: item.answer,
            timestamp: item.timestamp
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          item.status = 'saved';
          item.error = undefined;
          console.log(`✅ Jawaban soal ${item.questionId} tersimpan`);
        } else {
          throw new Error(result.message || `HTTP ${response.status}`);
        }
      } catch (error: any) {
        item.retryCount++;
        item.error = error.message;

        console.warn(`⚠️ Gagal simpan soal ${item.questionId} (attempt ${item.retryCount}/${this.maxRetries}):`, error.message);

        // Retry with exponential backoff
        if (item.retryCount < this.maxRetries) {
          item.status = 'pending';
          
          // Wait before retry
          const delay = this.retryDelay * Math.pow(2, item.retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          item.status = 'failed';
          console.error(`❌ Gagal simpan soal ${item.questionId} setelah ${this.maxRetries} percobaan`);
          
          // Save to localStorage for recovery
          this.saveFailedAnswerToLocalStorage(item);
        }
      }
    }

    this.isProcessing = false;

    // Check if there are still pending items
    const hasPending = Array.from(this.queue.values()).some(
      item => item.status === 'pending'
    );

    if (hasPending) {
      // Process again after a short delay
      setTimeout(() => this.processQueue(), 500);
    }
  }

  /**
   * Save failed answer to localStorage for manual recovery
   */
  private saveFailedAnswerToLocalStorage(item: QueuedAnswer) {
    try {
      const key = `failedAnswers_${this.examId}`;
      const existing = localStorage.getItem(key);
      const failedAnswers = existing ? JSON.parse(existing) : [];
      
      failedAnswers.push({
        questionId: item.questionId,
        questionType: item.questionType,
        answer: item.answer,
        timestamp: item.timestamp,
        error: item.error
      });
      
      localStorage.setItem(key, JSON.stringify(failedAnswers));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): QueueStatus {
    const statuses: QueueStatus = {
      total: this.queue.size,
      saved: 0,
      pending: 0,
      saving: 0,
      failed: 0
    };

    for (const item of this.queue.values()) {
      statuses[item.status]++;
    }

    return statuses;
  }

  /**
   * Check if all answers are saved
   */
  isAllAnswersSaved(): boolean {
    if (this.queue.size === 0) return true;

    for (const item of this.queue.values()) {
      if (item.status !== 'saved') {
        return false;
      }
    }
    return true;
  }

  /**
   * Get failed answers
   */
  getFailedAnswers(): QueuedAnswer[] {
    return Array.from(this.queue.values()).filter(
      item => item.status === 'failed'
    );
  }

  /**
   * Get pending/saving answers
   */
  getPendingAnswers(): QueuedAnswer[] {
    return Array.from(this.queue.values()).filter(
      item => item.status === 'pending' || item.status === 'saving'
    );
  }

  /**
   * Get all answers (for submit)
   */
  getAllAnswers(): Record<string, string> {
    const answers: Record<string, string> = {};
    
    for (const item of this.queue.values()) {
      answers[item.questionId] = item.answer;
    }
    
    return answers;
  }

  /**
   * Clear queue (after successful submit)
   */
  clear() {
    this.queue.clear();
  }

  /**
   * Wait for all answers to be saved (with timeout)
   */
  async waitForAllSaved(timeoutMs: number = 120000): Promise<boolean> {
    const startTime = Date.now();
    
    while (!this.isAllAnswersSaved()) {
      if (Date.now() - startTime > timeoutMs) {
        console.error('⏱️ Timeout waiting for answers to save');
        return false;
      }

      // Trigger processing if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }

      // Wait 200ms before checking again
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return true;
  }
}

// Singleton instance
export const examQueue = new ExamAnswerQueue();

// Helper function to generate checksum
export function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(36);
}
