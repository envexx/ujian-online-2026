import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'GURU') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

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

    // Build where clause
    const where: any = {
      guruId: guru.id,
    };

    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter;
    }

    // Get ujian with counts
    const [ujian, kelasList, mapelList] = await Promise.all([
      prisma.ujian.findMany({
        where,
        include: {
          mapel: true,
          _count: {
            select: {
              soalPilihanGanda: true,
              soalEssay: true,
              submissions: true,
            },
          },
        },
        orderBy: {
          startUjian: 'desc',
        },
      }),
      // Get kelas that this guru teaches
      prisma.kelas.findMany({
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
      }),
      // Get mapel that this guru teaches
      prisma.guruMapel.findMany({
        where: {
          guruId: guru.id,
        },
        include: {
          mapel: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ujian: ujian.map((u) => ({
          id: u.id,
          judul: u.judul,
          deskripsi: u.deskripsi,
          mapel: u.mapel.nama,
          mapelId: u.mapelId,
          kelas: u.kelas,
          startUjian: u.startUjian,
          endUjian: u.endUjian,
          shuffleQuestions: u.shuffleQuestions,
          showScore: u.showScore,
          status: u.status,
          totalSoalPG: u._count.soalPilihanGanda,
          totalSoalEssay: u._count.soalEssay,
          totalSubmissions: u._count.submissions,
          createdAt: u.createdAt,
        })),
        kelasList: kelasList.map((k) => ({
          id: k.id,
          nama: k.nama,
        })),
        mapelList: mapelList.map((gm) => ({
          id: gm.mapel.id,
          nama: gm.mapel.nama,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching ujian:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ujian' },
      { status: 500 }
    );
  }
}

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
    const { 
      judul, 
      deskripsi, 
      mapelId, 
      kelas, 
      startUjian, 
      endUjian,
      shuffleQuestions,
      showScore,
      status,
      soalPG,
      soalEssay,
    } = body;

    // Validate startUjian and endUjian
    if (!startUjian || !endUjian) {
      return NextResponse.json(
        { success: false, error: 'Waktu mulai dan waktu akhir ujian harus diisi' },
        { status: 400 }
      );
    }

    const startDate = new Date(startUjian);
    const endDate = new Date(endUjian);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Format waktu tidak valid' },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { success: false, error: 'Waktu akhir harus lebih besar dari waktu mulai' },
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

    // Validasi: Jika status aktif/publish, SEMUA soalPG harus valid dengan semua opsi (A-D) terisi
    const finalStatus = status || 'draft';
    const allSoalPG = soalPG || [];
    
    if (finalStatus === 'aktif') {
      if (allSoalPG.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Tidak dapat mempublikasikan ujian. Soal Pilihan Ganda tidak boleh kosong untuk ujian aktif. Silakan tambahkan minimal 1 soal PG atau simpan sebagai draft terlebih dahulu.' 
          },
          { status: 400 }
        );
      }

      // Cek apakah semua soal PG valid - untuk publish, SEMUA opsi (A, B, C, D) harus terisi
      const invalidSoalPG = allSoalPG.filter((soal: any) => {
        const hasQuestion = soal.pertanyaan && soal.pertanyaan.replace(/<[^>]*>/g, '').trim().length > 0;
        // Untuk publish, semua opsi harus terisi
        const allOptionsFilled = soal.opsiA && soal.opsiA.replace(/<[^>]*>/g, '').trim().length > 0 &&
                                soal.opsiB && soal.opsiB.replace(/<[^>]*>/g, '').trim().length > 0 &&
                                soal.opsiC && soal.opsiC.replace(/<[^>]*>/g, '').trim().length > 0 &&
                                soal.opsiD && soal.opsiD.replace(/<[^>]*>/g, '').trim().length > 0;
        return !(hasQuestion && allOptionsFilled);
      });

      if (invalidSoalPG.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Tidak dapat mempublikasikan ujian. Terdapat ${invalidSoalPG.length} soal Pilihan Ganda yang belum lengkap. Semua opsi (A, B, C, D) harus diisi untuk publish.` 
          },
          { status: 400 }
        );
      }
    }

    // Filter soal yang valid untuk disimpan (untuk draft, minimal 1 opsi terisi)
    const validSoalPG = allSoalPG.filter((soal: any) => {
      const hasQuestion = soal.pertanyaan && soal.pertanyaan.replace(/<[^>]*>/g, '').trim().length > 0;
      // Untuk draft, minimal 1 opsi terisi
      const hasOptions = (soal.opsiA && soal.opsiA.replace(/<[^>]*>/g, '').trim().length > 0) ||
                        (soal.opsiB && soal.opsiB.replace(/<[^>]*>/g, '').trim().length > 0) ||
                        (soal.opsiC && soal.opsiC.replace(/<[^>]*>/g, '').trim().length > 0) ||
                        (soal.opsiD && soal.opsiD.replace(/<[^>]*>/g, '').trim().length > 0);
      return hasQuestion && hasOptions;
    });

    // Create ujian with soal
    const ujian = await prisma.ujian.create({
      data: {
        judul,
        deskripsi,
        mapelId,
        guruId: guru.id,
        kelas: Array.isArray(kelas) ? kelas : [kelas],
        startUjian: startDate,
        endUjian: endDate,
        shuffleQuestions: shuffleQuestions || false,
        showScore: showScore !== false,
        status: finalStatus,
        soalPilihanGanda: {
          create: (finalStatus === 'aktif' ? allSoalPG : validSoalPG).map((soal: any, index: number) => ({
            pertanyaan: soal.pertanyaan,
            opsiA: soal.opsiA,
            opsiB: soal.opsiB,
            opsiC: soal.opsiC,
            opsiD: soal.opsiD,
            jawabanBenar: soal.kunciJawaban,
            urutan: index + 1,
          })),
        },
        soalEssay: {
          create: soalEssay?.map((soal: any, index: number) => ({
            pertanyaan: soal.pertanyaan,
            kunciJawaban: soal.kunciJawaban,
            urutan: index + 1,
          })) || [],
        },
      },
      include: {
        mapel: true,
        soalPilihanGanda: true,
        soalEssay: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ujian,
        totalSoalPG: ujian.soalPilihanGanda.length,
        totalSoalEssay: ujian.soalEssay.length,
      },
      message: 'Ujian berhasil ditambahkan',
    });
  } catch (error) {
    console.error('Error creating ujian:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create ujian' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'GURU') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
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

    // Validasi: Jika status diubah menjadi aktif, SEMUA soalPG harus valid
    if (status === 'aktif') {
      const existingUjian = await prisma.ujian.findFirst({
        where: {
          id,
          guruId: guru.id,
        },
        include: {
          soalPilihanGanda: true,
        },
      });

      if (!existingUjian) {
        return NextResponse.json(
          { success: false, error: 'Ujian not found or unauthorized' },
          { status: 404 }
        );
      }

      if (existingUjian.soalPilihanGanda.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Tidak dapat mengaktifkan ujian. Soal Pilihan Ganda tidak boleh kosong untuk ujian aktif. Silakan tambahkan minimal 1 soal PG terlebih dahulu.' 
          },
          { status: 400 }
        );
      }

      // Cek apakah semua soal PG valid - untuk publish, SEMUA opsi (A, B, C, D) harus terisi
      const invalidSoalPG = existingUjian.soalPilihanGanda.filter((soal) => {
        const hasQuestion = soal.pertanyaan && soal.pertanyaan.replace(/<[^>]*>/g, '').trim().length > 0;
        // Untuk publish, semua opsi harus terisi
        const allOptionsFilled = soal.opsiA && soal.opsiA.replace(/<[^>]*>/g, '').trim().length > 0 &&
                                soal.opsiB && soal.opsiB.replace(/<[^>]*>/g, '').trim().length > 0 &&
                                soal.opsiC && soal.opsiC.replace(/<[^>]*>/g, '').trim().length > 0 &&
                                soal.opsiD && soal.opsiD.replace(/<[^>]*>/g, '').trim().length > 0;
        return !(hasQuestion && allOptionsFilled);
      });

      if (invalidSoalPG.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Tidak dapat mengaktifkan ujian. Terdapat ${invalidSoalPG.length} soal Pilihan Ganda yang belum lengkap. Semua opsi (A, B, C, D) harus diisi untuk publish.` 
          },
          { status: 400 }
        );
      }
    }

    // Update ujian status (only if owned by this guru)
    const ujian = await prisma.ujian.updateMany({
      where: {
        id,
        guruId: guru.id,
      },
      data: {
        status,
      },
    });

    if (ujian.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Ujian not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Status ujian berhasil diupdate',
    });
  } catch (error) {
    console.error('Error updating ujian:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update ujian' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'GURU') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
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

    // Delete ujian (only if owned by this guru)
    await prisma.ujian.deleteMany({
      where: {
        id,
        guruId: guru.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Ujian berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting ujian:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete ujian' },
      { status: 500 }
    );
  }
}
