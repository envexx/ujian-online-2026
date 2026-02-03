import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * API endpoint untuk auto-save jawaban (bukan submit final)
 * Enhanced dengan:
 * - Transaction untuk data consistency
 * - Comprehensive validation
 * - Better error handling
 * - Detailed logging
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'SISWA') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const siswa = await prisma.siswa.findFirst({
      where: { userId: session.userId },
    });

    if (!siswa) {
      return NextResponse.json(
        { success: false, message: 'Siswa not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { questionId, questionType, answer, timestamp } = body;

    // Validate input
    if (!questionId || !questionType || answer === undefined) {
      return NextResponse.json(
        { success: false, message: 'Data tidak lengkap' },
        { status: 400 }
      );
    }

    if (!['multiple_choice', 'essay'].includes(questionType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid question type' },
        { status: 400 }
      );
    }

    // Check if ujian exists
    const ujian = await prisma.ujian.findFirst({
      where: { id },
      include: {
        soalPilihanGanda: true,
        soalEssay: true,
      },
    });

    if (!ujian) {
      return NextResponse.json(
        { success: false, message: 'Ujian tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validate time
    const now = new Date();
    const examEndTime = new Date(ujian.endUjian);
    const examStartTime = new Date(ujian.startUjian);

    if (now > examEndTime) {
      return NextResponse.json(
        { success: false, message: 'Waktu ujian telah berakhir. Jawaban tidak dapat disimpan.' },
        { status: 403 }
      );
    }

    if (now < examStartTime) {
      return NextResponse.json(
        { success: false, message: 'Ujian belum dimulai' },
        { status: 403 }
      );
    }

    // Validate question exists and belongs to this exam
    let soal: any = null;
    let soalType = '';

    if (questionType === 'multiple_choice') {
      soal = ujian.soalPilihanGanda.find((s) => s.id === questionId);
      soalType = 'PG';
    } else {
      soal = ujian.soalEssay.find((s) => s.id === questionId);
      soalType = 'ESSAY';
    }

    if (!soal) {
      return NextResponse.json(
        { success: false, message: `Soal ${questionId} tidak ditemukan atau tipe soal salah` },
        { status: 404 }
      );
    }

    // Use transaction for data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get or create submission
      let submission = await tx.ujianSubmission.findUnique({
        where: {
          ujianId_siswaId: {
            ujianId: id,
            siswaId: siswa.id,
          },
        },
      });

      if (!submission) {
        // Create draft submission
        submission = await tx.ujianSubmission.create({
          data: {
            ujianId: id,
            siswaId: siswa.id,
            startedAt: timestamp ? new Date(timestamp) : new Date(),
            status: 'draft',
          },
        });
      }

      // Check if already submitted
      if (submission.submittedAt) {
        throw new Error('Ujian sudah dikumpulkan, tidak bisa mengubah jawaban');
      }

      // Save answer based on type
      if (soalType === 'PG') {
        const isCorrect = answer === soal.jawabanBenar;

        const existingAnswer = await tx.jawabanPilihanGanda.findUnique({
          where: {
            submissionId_soalId: {
              submissionId: submission.id,
              soalId: questionId,
            },
          },
        });

        if (existingAnswer) {
          await tx.jawabanPilihanGanda.update({
            where: { id: existingAnswer.id },
            data: { jawaban: answer, isCorrect },
          });
        } else {
          await tx.jawabanPilihanGanda.create({
            data: {
              submissionId: submission.id,
              soalId: questionId,
              jawaban: answer,
              isCorrect,
            },
          });
        }

        return { type: 'PG', isCorrect, submissionId: submission.id };
      } else {
        const existingAnswer = await tx.jawabanEssay.findUnique({
          where: {
            submissionId_soalId: {
              submissionId: submission.id,
              soalId: questionId,
            },
          },
        });

        if (existingAnswer) {
          await tx.jawabanEssay.update({
            where: { id: existingAnswer.id },
            data: { jawaban: answer },
          });
        } else {
          await tx.jawabanEssay.create({
            data: {
              submissionId: submission.id,
              soalId: questionId,
              jawaban: answer,
            },
          });
        }

        return { type: 'ESSAY', submissionId: submission.id };
      }
    });

    return NextResponse.json({
      success: true,
      message: '✅ Jawaban berhasil disimpan',
      data: {
        questionId,
        savedAt: new Date().toISOString(),
        ...result,
      },
    });
  } catch (error: any) {
    console.error('[SAVE ANSWER ERROR]', error);

    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan jawaban' },
      { status: 500 }
    );
  }
}

/**
 * Batch save untuk multiple PG answers
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'SISWA') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const siswa = await prisma.siswa.findFirst({
      where: { userId: session.userId },
    });

    if (!siswa) {
      return NextResponse.json(
        { success: false, error: 'Siswa not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { answers } = body; // Array of { questionId, answer }

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid answers format' },
        { status: 400 }
      );
    }

    // Check if ujian exists
    const ujian = await prisma.ujian.findFirst({
      where: { id },
      include: {
        soalPilihanGanda: true,
      },
    });

    if (!ujian) {
      return NextResponse.json(
        { success: false, error: 'Ujian not found' },
        { status: 404 }
      );
    }

    // Check if exam time has passed
    const now = new Date();
    const examEndTime = new Date(ujian.endUjian);
    if (now > examEndTime) {
      return NextResponse.json(
        { success: false, error: 'Waktu ujian telah berakhir. Jawaban tidak dapat disimpan.' },
        { status: 400 }
      );
    }

    // Check if exam has started
    const examStartTime = new Date(ujian.startUjian);
    if (now < examStartTime) {
      return NextResponse.json(
        { success: false, error: 'Ujian belum dimulai' },
        { status: 400 }
      );
    }

    // Get or create submission
    let submission = await prisma.ujianSubmission.findFirst({
      where: {
        ujianId: id,
        siswaId: siswa.id,
      },
    });

    if (!submission) {
      submission = await prisma.ujianSubmission.create({
        data: {
          ujianId: id,
          siswaId: siswa.id,
          startedAt: new Date(),
          status: 'draft',
        },
      });
    }

    // Batch save PG answers
    const savePromises = answers.map(async ({ questionId, answer }) => {
      const soal = ujian.soalPilihanGanda.find((s) => s.id === questionId);
      if (!soal) return null;

      const existingAnswer = await prisma.jawabanPilihanGanda.findUnique({
        where: {
          submissionId_soalId: {
            submissionId: submission.id,
            soalId: questionId,
          },
        },
      });

      if (existingAnswer) {
        return prisma.jawabanPilihanGanda.update({
          where: { id: existingAnswer.id },
          data: {
            jawaban: answer,
            isCorrect: answer === soal.jawabanBenar,
          },
        });
      } else {
        return prisma.jawabanPilihanGanda.create({
          data: {
            submissionId: submission.id,
            soalId: questionId,
            jawaban: answer,
            isCorrect: answer === soal.jawabanBenar,
          },
        });
      }
    });

    await Promise.all(savePromises.filter(Boolean));

    return NextResponse.json({
      success: true,
      data: {
        message: `${answers.length} jawaban berhasil disimpan`,
        savedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error batch saving answers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save answers' },
      { status: 500 }
    );
  }
}

