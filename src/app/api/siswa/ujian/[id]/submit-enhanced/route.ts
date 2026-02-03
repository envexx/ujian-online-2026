import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * Enhanced Submit Endpoint
 * Features:
 * - Transaction-based for data consistency
 * - Comprehensive validation
 * - Checksum verification
 * - Detailed logging
 * - All questions saved (including unanswered)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: ujianId } = await params;
    const session = await getSession();

    // Validate session
    if (!session.isLoggedIn || session.role !== 'SISWA') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get siswa
    const siswa = await prisma.siswa.findFirst({
      where: { userId: session.userId },
    });

    if (!siswa) {
      return NextResponse.json(
        { success: false, message: 'Siswa not found' },
        { status: 404 }
      );
    }

    // Parse body
    const body = await request.json();
    const { answers, checksum, totalQuestions, submittedAt } = body;

    // Validate input
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { success: false, message: '❌ Tidak ada jawaban yang dikirim' },
        { status: 400 }
      );
    }

    // Get ujian with all questions
    const ujian = await prisma.ujian.findUnique({
      where: { id: ujianId },
      include: {
        soalPilihanGanda: { orderBy: { urutan: 'asc' } },
        soalEssay: { orderBy: { urutan: 'asc' } },
      },
    });

    if (!ujian) {
      return NextResponse.json(
        { success: false, message: 'Ujian tidak ditemukan' },
        { status: 404 }
      );
    }

    const expectedTotalSoal = ujian.soalPilihanGanda.length + ujian.soalEssay.length;

    // Validate time
    const now = new Date();
    const examEndTime = new Date(ujian.endUjian);

    if (now > examEndTime) {
      return NextResponse.json(
        { success: false, message: '❌ Waktu ujian sudah berakhir' },
        { status: 403 }
      );
    }

    // Validate checksum if provided
    if (checksum) {
      const expectedChecksum = generateChecksum(answers);
      if (checksum !== expectedChecksum) {
        console.warn('[SUBMIT] Checksum mismatch', {
          expected: expectedChecksum,
          received: checksum,
        });
        // Don't block submission, just log warning
      }
    }

    // Use transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Get or create submission
      let submission = await tx.ujianSubmission.findUnique({
        where: {
          ujianId_siswaId: {
            ujianId,
            siswaId: siswa.id,
          },
        },
        include: {
          jawabanPilihanGanda: true,
          jawabanEssay: true,
        },
      });

      // Check if already submitted
      if (submission?.submittedAt) {
        throw new Error('Ujian sudah pernah dikumpulkan');
      }

      // Calculate PG score
      let correctPG = 0;
      const totalPG = ujian.soalPilihanGanda.length;

      ujian.soalPilihanGanda.forEach((soal) => {
        const userAnswer = answers[soal.id];
        if (userAnswer && userAnswer === soal.jawabanBenar) {
          correctPG++;
        }
      });

      // Determine final score
      const totalEssay = ujian.soalEssay.length;
      const hasEssay = totalEssay > 0;

      let nilaiPG = 0;
      if (totalPG > 0) {
        nilaiPG = Math.round((correctPG / totalPG) * 100);
      }

      const nilaiAkhir = hasEssay ? null : nilaiPG;
      const statusSubmission = hasEssay ? 'pending' : 'completed';

      // Create or update submission
      if (!submission) {
        submission = await tx.ujianSubmission.create({
          data: {
            ujianId,
            siswaId: siswa.id,
            startedAt: submittedAt ? new Date(submittedAt) : new Date(),
            submittedAt: new Date(),
            nilai: nilaiAkhir,
            status: statusSubmission,
          },
          include: {
            jawabanPilihanGanda: true,
            jawabanEssay: true,
          },
        });
      } else {
        submission = await tx.ujianSubmission.update({
          where: { id: submission.id },
          data: {
            submittedAt: new Date(),
            nilai: nilaiAkhir,
            status: statusSubmission,
          },
          include: {
            jawabanPilihanGanda: true,
            jawabanEssay: true,
          },
        });
      }

      // Save ALL PG answers (including unanswered)
      const pgResults = [];
      for (const soal of ujian.soalPilihanGanda) {
        const userAnswer = answers[soal.id] || '';
        const isCorrect = userAnswer ? userAnswer === soal.jawabanBenar : false;

        const existingAnswer = submission.jawabanPilihanGanda.find(
          (j) => j.soalId === soal.id
        );

        if (existingAnswer) {
          const updated = await tx.jawabanPilihanGanda.update({
            where: { id: existingAnswer.id },
            data: { jawaban: userAnswer, isCorrect },
          });
          pgResults.push({ soalId: soal.id, status: 'updated', result: updated });
        } else {
          const created = await tx.jawabanPilihanGanda.create({
            data: {
              submissionId: submission.id,
              soalId: soal.id,
              jawaban: userAnswer,
              isCorrect,
            },
          });
          pgResults.push({ soalId: soal.id, status: 'created', result: created });
        }
      }

      // Save ALL Essay answers (including unanswered)
      const essayResults = [];
      for (const soal of ujian.soalEssay) {
        const userAnswer = answers[soal.id] || '';

        const existingAnswer = submission.jawabanEssay.find(
          (j) => j.soalId === soal.id
        );

        if (existingAnswer) {
          const updated = await tx.jawabanEssay.update({
            where: { id: existingAnswer.id },
            data: { jawaban: userAnswer },
          });
          essayResults.push({ soalId: soal.id, status: 'updated', result: updated });
        } else {
          const created = await tx.jawabanEssay.create({
            data: {
              submissionId: submission.id,
              soalId: soal.id,
              jawaban: userAnswer,
            },
          });
          essayResults.push({ soalId: soal.id, status: 'created', result: created });
        }
      }

      return {
        submission,
        pgResults,
        essayResults,
        nilaiAkhir,
        correctPG,
        totalPG,
        totalEssay,
        stats: {
          pgSaved: pgResults.length,
          essaySaved: essayResults.length,
          pgCreated: pgResults.filter((r) => r.status === 'created').length,
          pgUpdated: pgResults.filter((r) => r.status === 'updated').length,
          essayCreated: essayResults.filter((r) => r.status === 'created').length,
          essayUpdated: essayResults.filter((r) => r.status === 'updated').length,
        },
      };
    });

    // Log success
    const duration = Date.now() - startTime;
    console.log('[SUBMIT SUCCESS]', {
      ujianId,
      siswaId: siswa.id,
      duration: `${duration}ms`,
      totalSoalPG: result.totalPG,
      totalSoalEssay: result.totalEssay,
      pgSaved: result.stats.pgSaved,
      essaySaved: result.stats.essaySaved,
      nilaiPG: result.nilaiAkhir,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: `✅ Ujian berhasil dikumpulkan. Total ${result.stats.pgSaved + result.stats.essaySaved} soal tersimpan`,
      data: {
        submission: result.submission,
        score: result.nilaiAkhir,
        correctPG: result.correctPG,
        totalPG: result.totalPG,
        totalEssay: result.totalEssay,
        pgSaved: result.stats.pgSaved,
        essaySaved: result.stats.essaySaved,
        pgCreated: result.stats.pgCreated,
        pgUpdated: result.stats.pgUpdated,
        essayCreated: result.stats.essayCreated,
        essayUpdated: result.stats.essayUpdated,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[SUBMIT ERROR]', {
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        message: `❌ ${error.message}`,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate checksum for data integrity
 */
function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(36);
}
