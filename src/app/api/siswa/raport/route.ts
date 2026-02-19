import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'SISWA') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get siswa data
    const siswa = await prisma.siswa.findFirst({
      where: { userId: session.userId },
      include: {
        kelas: true,
      },
    });

    if (!siswa) {
      return NextResponse.json(
        { success: false, error: 'Siswa not found' },
        { status: 404 }
      );
    }

    // Get only ujian submissions with grades
    const ujianSubmissions = await prisma.ujianSubmission.findMany({
      where: {
        siswaId: siswa.id,
        nilai: {
          not: null,
        },
      },
      include: {
        ujian: {
          include: {
            mapel: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // Group by mapel
    const nilaiPerMapel: Record<string, any> = {};

    ujianSubmissions.forEach(sub => {
      const mapelNama = sub.ujian.mapel.nama;
      if (!nilaiPerMapel[mapelNama]) {
        nilaiPerMapel[mapelNama] = {
          mapel: mapelNama,
          ujian: [],
        };
      }
      nilaiPerMapel[mapelNama].ujian.push({
        judul: sub.ujian.judul,
        nilai: sub.nilai,
        tanggal: sub.submittedAt,
      });
    });

    // Calculate average per mapel
    const raport = Object.values(nilaiPerMapel).map((data: any) => {
      const allNilai = data.ujian.map((u: any) => u.nilai);
      const rataRata = allNilai.length > 0
        ? Math.round(allNilai.reduce((a: number, b: number) => a + b, 0) / allNilai.length)
        : 0;

      return {
        mapel: data.mapel,
        totalUjian: data.ujian.length,
        rataRata,
        ujian: data.ujian,
      };
    });

    // Overall average (only from ujian)
    const allNilai = ujianSubmissions.map(s => s.nilai as number);
    const rataRataKeseluruhan = allNilai.length > 0
      ? Math.round(allNilai.reduce((a, b) => a + b, 0) / allNilai.length)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        siswa: {
          nama: siswa.nama,
          nisn: siswa.nisn,
          kelas: siswa.kelas.nama,
        },
        rataRataKeseluruhan,
        totalUjianDinilai: ujianSubmissions.length,
        raport,
      },
    });
  } catch (error) {
    console.error('Error fetching raport:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch raport' },
      { status: 500 }
    );
  }
}
