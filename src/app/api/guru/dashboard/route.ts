import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshSession } from '@/lib/session';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export const runtime = 'edge';

export async function GET() {
  try {
    // Use refreshSession to keep session alive on dashboard access (rolling session)
    const session = await refreshSession();

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

    // Get today's date range
    const today = new Date();
    const dayName = format(today, 'EEEE', { locale: id });

    // Get statistics in parallel
    const [
      totalKelas,
      totalSiswa,
      jadwalHariIni,
      tugasBelumDinilai,
      jadwalList,
      tugasPendingList,
    ] = await Promise.all([
      // Total kelas yang diajar guru ini
      prisma.guruKelas.count({
        where: { guruId: guru.id },
      }),

      // Total siswa di kelas yang diajar
      prisma.siswa.count({
        where: {
          kelas: {
            guru: {
              some: {
                guruId: guru.id,
              },
            },
          },
        },
      }),

      // Jadwal hari ini
      prisma.jadwal.count({
        where: {
          guruId: guru.id,
          hari: dayName,
        },
      }),

      // Tugas belum dinilai (submissions yang belum ada nilai)
      prisma.tugasSubmission.count({
        where: {
          tugas: {
            guruId: guru.id,
          },
          nilai: null,
        },
      }),

      // List jadwal hari ini
      prisma.jadwal.findMany({
        where: {
          guruId: guru.id,
          hari: dayName,
        },
        include: {
          kelas: true,
          mapel: true,
        },
        orderBy: {
          jamMulai: 'asc',
        },
        take: 5,
      }),

      // List tugas pending (yang punya submission belum dinilai)
      prisma.tugas.findMany({
        where: {
          guruId: guru.id,
          submissions: {
            some: {
              nilai: null,
            },
          },
        },
        include: {
          mapel: true,
          _count: {
            select: {
              submissions: {
                where: {
                  nilai: null,
                },
              },
            },
          },
        },
        orderBy: {
          deadline: 'asc',
        },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalKelas,
          totalSiswa,
          jadwalHariIni,
          tugasBelumDinilai,
        },
        jadwalHariIni: jadwalList.map((j) => ({
          id: j.id,
          waktu: `${j.jamMulai} - ${j.jamSelesai}`,
          kelas: j.kelas.nama,
          mapel: j.mapel.nama,
          ruangan: j.ruangan || '-',
        })),
        tugasPending: tugasPendingList.map((t) => ({
          id: t.id,
          kelas: t.kelas.join(', '),
          mapel: t.mapel.nama,
          judul: t.judul,
          jumlahSiswa: t._count.submissions,
          deadline: t.deadline,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching guru dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
