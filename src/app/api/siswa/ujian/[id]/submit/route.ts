import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(
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
    const { answers } = body;

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
        { success: false, error: 'Ujian not found' },
        { status: 404 }
      );
    }

    // Check if exam time has passed
    const now = new Date();
    const examEndTime = new Date((ujian as any).endUjian);
    if (now > examEndTime) {
      return NextResponse.json(
        { success: false, error: 'Waktu ujian telah berakhir' },
        { status: 400 }
      );
    }

    // Check if already submitted
    const existingSubmission = await prisma.ujianSubmission.findFirst({
      where: {
        ujianId: id,
        siswaId: siswa.id,
      },
      include: {
        jawabanPilihanGanda: true,
        jawabanEssay: true,
      },
    });

    if (existingSubmission?.submittedAt) {
      return NextResponse.json(
        { success: false, error: 'Ujian sudah dikumpulkan' },
        { status: 400 }
      );
    }

    // Calculate score for multiple choice
    let correctPG = 0;
    const totalPG = ujian.soalPilihanGanda.length;
    
    console.log('Calculating PG score. Total soal:', totalPG);
    console.log('Soal IDs:', ujian.soalPilihanGanda.map(s => s.id));
    console.log('Answer keys:', Object.keys(answers || {}));
    
    ujian.soalPilihanGanda.forEach((soal) => {
      const userAnswer = answers[soal.id];
      if (userAnswer && userAnswer === soal.jawabanBenar) {
        correctPG++;
      }
    });
    
    console.log('Correct PG:', correctPG, 'out of', totalPG);

    // For essay, we'll set nilai to null and let guru grade it manually
    const totalEssay = ujian.soalEssay.length;
    const hasEssay = totalEssay > 0;

    // Calculate final score (only from PG if there are essay questions)
    let finalScore = null;
    if (!hasEssay && totalPG > 0) {
      // Only PG, calculate score
      finalScore = Math.round((correctPG / totalPG) * 100);
    }

    console.log('Processing submission for siswa:', siswa.id, 'ujian:', id);
    console.log('Final score:', finalScore, 'Status:', hasEssay ? 'pending' : 'completed');

    let submission;
    
    // If there's an existing draft submission, update it instead of creating new
    if (existingSubmission && !existingSubmission.submittedAt) {
      console.log('Updating existing draft submission:', existingSubmission.id);
      
      submission = await prisma.ujianSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          submittedAt: new Date(),
          nilai: finalScore,
          status: hasEssay ? 'pending' : 'completed',
        },
      });
      
      console.log('Submission updated with status:', submission.status, 'nilai:', submission.nilai);
    } else {
      // Create new submission
      submission = await prisma.ujianSubmission.create({
        data: {
          ujianId: id,
          siswaId: siswa.id,
          startedAt: new Date(),
          submittedAt: new Date(),
          nilai: finalScore,
          status: hasEssay ? 'pending' : 'completed',
        },
      });
      
      console.log('Submission created with status:', submission.status, 'nilai:', submission.nilai);
    }

    console.log('Submission created with ID:', submission.id);
    console.log('Total soal PG:', totalPG);
    console.log('Answers received:', Object.keys(answers).length, 'keys:', Object.keys(answers));

    // Store PG answers - save ALL questions, even unanswered ones
    // Check existing answers first to avoid duplicates
    let pgSaved = 0;
    let pgUpdated = 0;
    let pgErrors: string[] = [];
    
    for (const soal of ujian.soalPilihanGanda) {
      try {
        const userAnswer = answers[soal.id] || null;
        const answerValue = userAnswer || ''; // Save empty string if not answered
        const isCorrect = userAnswer ? userAnswer === soal.jawabanBenar : false;
        
        // Check if answer already exists (from auto-save)
        const existingAnswer = existingSubmission?.jawabanPilihanGanda?.find(
          (j: any) => j.soalId === soal.id
        );
        
        if (existingAnswer) {
          // Update existing answer
          await prisma.jawabanPilihanGanda.update({
            where: { id: existingAnswer.id },
            data: {
              jawaban: answerValue,
              isCorrect: isCorrect,
            },
          });
          pgUpdated++;
        } else {
          // Create new answer
          await prisma.jawabanPilihanGanda.create({
            data: {
              submissionId: submission.id,
              soalId: soal.id,
              jawaban: answerValue,
              isCorrect: isCorrect,
            },
          });
          pgSaved++;
        }
      } catch (error: any) {
        console.error(`Error saving PG answer for soal ${soal.id}:`, error);
        pgErrors.push(`Soal ${soal.id}: ${error.message}`);
      }
    }
    
    console.log('PG answers - Saved:', pgSaved, 'Updated:', pgUpdated, 'Total:', pgSaved + pgUpdated, 'out of', totalPG);
    if (pgErrors.length > 0) {
      console.error('PG save errors:', pgErrors);
    }

    // Store Essay answers - save ALL questions, even unanswered ones
    // Check existing answers first to avoid duplicates
    let essaySaved = 0;
    let essayUpdated = 0;
    let essayErrors: string[] = [];
    
    for (const soal of ujian.soalEssay) {
      try {
        const userAnswer = answers[soal.id] || null;
        const answerValue = userAnswer || ''; // Save empty string if not answered
        
        // Check if answer already exists (from auto-save)
        const existingAnswer = existingSubmission?.jawabanEssay?.find(
          (j: any) => j.soalId === soal.id
        );
        
        if (existingAnswer) {
          // Update existing answer
          await prisma.jawabanEssay.update({
            where: { id: existingAnswer.id },
            data: {
              jawaban: answerValue,
            },
          });
          essayUpdated++;
        } else {
          // Create new answer
          await prisma.jawabanEssay.create({
            data: {
              submissionId: submission.id,
              soalId: soal.id,
              jawaban: answerValue,
            },
          });
          essaySaved++;
        }
      } catch (error: any) {
        console.error(`Error saving Essay answer for soal ${soal.id}:`, error);
        essayErrors.push(`Soal ${soal.id}: ${error.message}`);
      }
    }
    
    console.log('Essay answers - Saved:', essaySaved, 'Updated:', essayUpdated, 'Total:', essaySaved + essayUpdated, 'out of', totalEssay);
    if (essayErrors.length > 0) {
      console.error('Essay save errors:', essayErrors);
    }

    // Verify submission was created/updated correctly
    const verifySubmission = await prisma.ujianSubmission.findUnique({
      where: { id: submission.id },
      include: {
        jawabanPilihanGanda: true,
        jawabanEssay: true,
      },
    });
    
    console.log('Verification - Submission status:', verifySubmission?.status);
    console.log('Verification - Submission nilai:', verifySubmission?.nilai);
    console.log('Verification - PG answers count:', verifySubmission?.jawabanPilihanGanda?.length);
    console.log('Verification - Essay answers count:', verifySubmission?.jawabanEssay?.length);

    return NextResponse.json({
      success: true,
      data: {
        submission,
        score: finalScore,
        correctPG,
        totalPG,
        pgSaved: pgSaved + pgUpdated,
        essaySaved: essaySaved + essayUpdated,
        message: hasEssay 
          ? 'Ujian berhasil dikumpulkan. Nilai akan diberikan setelah guru mengoreksi essay.'
          : `Ujian berhasil dikumpulkan. Nilai Anda: ${finalScore}`,
      },
    });
  } catch (error) {
    console.error('Error submitting ujian:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit ujian' },
      { status: 500 }
    );
  }
}


