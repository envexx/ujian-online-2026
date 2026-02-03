import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(
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

    // Get ujian with submission
    const ujian = await prisma.ujian.findFirst({
      where: { id },
      include: {
        mapel: true,
        soalPilihanGanda: {
          orderBy: { urutan: 'asc' },
        },
        soalEssay: {
          orderBy: { urutan: 'asc' },
        },
      },
    });

    if (!ujian) {
      return NextResponse.json(
        { success: false, error: 'Ujian not found' },
        { status: 404 }
      );
    }

    // Get submission
    const submission = await prisma.ujianSubmission.findFirst({
      where: {
        ujianId: id,
        siswaId: siswa.id,
      },
      include: {
        jawabanPilihanGanda: true,
        jawabanEssay: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Anda belum mengerjakan ujian ini' },
        { status: 404 }
      );
    }

    // Get answers - convert from JawabanPilihanGanda and JawabanEssay records to object
    const answersMap: { [key: string]: string } = {};
    
    // Add PG answers
    if (submission.jawabanPilihanGanda && submission.jawabanPilihanGanda.length > 0) {
      submission.jawabanPilihanGanda.forEach((answer: any) => {
        answersMap[answer.soalId] = answer.jawaban;
      });
    }
    
    // Add Essay answers
    if (submission.jawabanEssay && submission.jawabanEssay.length > 0) {
      submission.jawabanEssay.forEach((answer: any) => {
        answersMap[answer.soalId] = answer.jawaban;
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ujian: {
          id: ujian.id,
          judul: ujian.judul,
          mapel: ujian.mapel.nama,
          startUjian: ujian.startUjian,
          endUjian: ujian.endUjian,
        },
        submission: {
          id: submission.id,
          nilai: submission.nilai,
          status: submission.status,
          submittedAt: submission.submittedAt,
          startedAt: submission.startedAt,
        },
        soalPG: ujian.soalPilihanGanda,
        soalEssay: ujian.soalEssay,
        answers: answersMap,
      },
    });
  } catch (error) {
    console.error('Error fetching ujian result:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch result' },
      { status: 500 }
    );
  }
}
