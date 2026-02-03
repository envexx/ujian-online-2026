import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * POST - Recalculate all scores for an exam with current grade config
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'GURU') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params for Next.js 15
    const { id } = await params;

    const body = await request.json();
    const { bobotPG, bobotEssay } = body;

    // Validate percentages
    if (!bobotPG || !bobotEssay) {
      return NextResponse.json(
        { success: false, error: 'Bobot PG dan Essay harus diisi' },
        { status: 400 }
      );
    }

    // Get guru data
    const guru = await prisma.guru.findFirst({
      where: { userId: session.userId },
    });

    if (!guru) {
      return NextResponse.json(
        { success: false, error: 'Guru not found' },
        { status: 404 }
      );
    }

    // Get ujian with submissions
    const ujian = await prisma.ujian.findUnique({
      where: { id },
      include: {
        soalPilihanGanda: true,
        soalEssay: true,
        submissions: {
          where: {
            status: 'completed', // Only recalculate completed submissions
          },
          include: {
            jawabanPilihanGanda: true,
            jawabanEssay: true,
          },
        },
      },
    });

    if (!ujian) {
      return NextResponse.json(
        { success: false, error: 'Ujian not found' },
        { status: 404 }
      );
    }

    // Verify guru owns this ujian
    if (ujian.guruId !== guru.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - not your ujian' },
        { status: 403 }
      );
    }

    const totalSoalPG = ujian.soalPilihanGanda.length;
    const totalSoalEssay = ujian.soalEssay.length;

    let updatedCount = 0;

    // Recalculate each submission
    for (const submission of ujian.submissions) {
      // Calculate PG score
      const correctPG = submission.jawabanPilihanGanda
        ? submission.jawabanPilihanGanda.filter((j: any) => j.isCorrect).length
        : 0;
      const nilaiPG = totalSoalPG > 0 ? Math.round((correctPG / totalSoalPG) * 100) : 0;

      // Calculate Essay score
      const totalNilaiEssay = submission.jawabanEssay.reduce(
        (sum, j) => sum + (j.nilai || 0),
        0
      );
      const nilaiEssay = totalSoalEssay > 0 ? totalNilaiEssay / totalSoalEssay : 0;

      // Calculate weighted final score
      let nilaiAkhir = 0;
      if (totalSoalPG > 0 && totalSoalEssay > 0) {
        // Both PG and Essay exist - use percentage weights
        nilaiAkhir = Math.round((nilaiPG * bobotPG / 100) + (nilaiEssay * bobotEssay / 100));
      } else if (totalSoalPG > 0) {
        // Only PG - use full PG score
        nilaiAkhir = nilaiPG;
      } else if (totalSoalEssay > 0) {
        // Only Essay - use full Essay score
        nilaiAkhir = Math.round(nilaiEssay);
      }

      // Update submission with new score
      await prisma.ujianSubmission.update({
        where: { id: submission.id },
        data: { nilai: nilaiAkhir },
      });

      updatedCount++;
    }

    console.log(`Recalculated ${updatedCount} submissions with PG:${bobotPG}% Essay:${bobotEssay}%`);

    return NextResponse.json({
      success: true,
      message: `Berhasil menghitung ulang ${updatedCount} nilai`,
      updated: updatedCount,
      config: {
        bobotPG,
        bobotEssay,
      },
    });
  } catch (error) {
    console.error('Error recalculating scores:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to recalculate scores' },
      { status: 500 }
    );
  }
}
