import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const runtime = 'edge';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'GURU') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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

    // Get all jadwal for this guru
    const jadwal = await prisma.jadwal.findMany({
      where: {
        guruId: guru.id,
      },
      include: {
        kelas: true,
        mapel: true,
      },
      orderBy: [
        { hari: 'asc' },
        { jamMulai: 'asc' },
      ],
    });

    // Get unique kelas list for filter
    const kelasList = await prisma.kelas.findMany({
      where: {
        guru: {
          some: {
            guruId: guru.id,
          },
        },
      },
      select: {
        id: true,
        nama: true,
      },
      orderBy: {
        nama: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        jadwal: jadwal.map((j) => ({
          id: j.id,
          hari: j.hari,
          waktuMulai: j.jamMulai,
          waktuSelesai: j.jamSelesai,
          kelas: j.kelas.nama,
          kelasId: j.kelasId,
          mapel: j.mapel.nama,
          ruangan: j.ruangan || '-',
        })),
        kelasList: kelasList.map((k) => ({
          id: k.id,
          nama: k.nama,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching jadwal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jadwal' },
      { status: 500 }
    );
  }
}
