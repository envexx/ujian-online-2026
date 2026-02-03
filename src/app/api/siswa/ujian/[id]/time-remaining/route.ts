import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * API endpoint untuk mendapatkan waktu tersisa ujian
 * Menghitung berdasarkan:
 * - Waktu akhir ujian (endUjian dari database)
 * - Waktu sekarang
 * - Waktu tersisa = endUjian - sekarang
 */
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

    // Get ujian and submission
    const ujian = await prisma.ujian.findFirst({
      where: { id },
      include: {
        submissions: {
          where: { siswaId: siswa.id },
        },
      },
    });

    if (!ujian) {
      return NextResponse.json(
        { success: false, error: 'Ujian not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const examStartTime = new Date(ujian.startUjian);
    const examEndTime = new Date(ujian.endUjian);

    // Calculate remaining time
    // Logika: Waktu tersisa = endUjian - sekarang
    // Tidak peduli kapan siswa mulai, waktu habis saat endUjian tercapai
    let timeRemaining = 0; // in seconds
    let hasStarted = false;
    
    if (ujian.submissions[0] && ujian.submissions[0].startedAt) {
      hasStarted = true;
    }
    
    // Waktu tersisa selalu dihitung dari endUjian - sekarang
    timeRemaining = Math.max(0, Math.floor((examEndTime.getTime() - now.getTime()) / 1000));

    // Check if time has expired
    const isExpired = timeRemaining <= 0;

    return NextResponse.json({
      success: true,
      data: {
        timeRemaining, // in seconds (dihitung dari endUjian - sekarang)
        isExpired,
        examStartTime: examStartTime.toISOString(),
        examEndTime: examEndTime.toISOString(),
        hasStarted,
      },
    });
  } catch (error) {
    console.error('Error calculating time remaining:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate time remaining' },
      { status: 500 }
    );
  }
}

