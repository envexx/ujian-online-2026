import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'GURU') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId, siswaId, tugasId, nilai, feedback } = body;

    console.log('Grading submission:', { submissionId, siswaId, tugasId, nilai, feedback });

    // Validate required fields
    if (!tugasId || !siswaId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tugasId and siswaId' },
        { status: 400 }
      );
    }

    // Check if submission exists
    let submission = await prisma.tugasSubmission.findFirst({
      where: {
        tugasId,
        siswaId,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Update submission with grade and feedback
    submission = await prisma.tugasSubmission.update({
      where: { id: submission.id },
      data: {
        nilai: nilai !== null && nilai !== undefined ? parseInt(nilai.toString()) : null,
        feedback: feedback || null,
        gradedAt: new Date(),
      },
    });

    console.log('Submission graded successfully:', submission.id);

    return NextResponse.json({
      success: true,
      message: 'Nilai berhasil disimpan',
      data: {
        submission,
      },
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to grade submission' },
      { status: 500 }
    );
  }
}
