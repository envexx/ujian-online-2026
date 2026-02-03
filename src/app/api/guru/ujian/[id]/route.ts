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

    // Get ujian detail with questions
    const ujian = await prisma.ujian.findFirst({
      where: {
        id: id,
        guruId: guru.id,
      },
      include: {
        mapel: true,
        soalPilihanGanda: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        soalEssay: {
          orderBy: {
            createdAt: 'asc',
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

    return NextResponse.json({
      success: true,
      data: {
        ujian: {
          id: ujian.id,
          judul: ujian.judul,
          deskripsi: ujian.deskripsi,
          mapel: ujian.mapel.nama,
          mapelId: ujian.mapelId,
          kelas: ujian.kelas,
          startUjian: ujian.startUjian,
          endUjian: ujian.endUjian,
          shuffleQuestions: ujian.shuffleQuestions,
          showScore: ujian.showScore,
          status: ujian.status,
          createdAt: ujian.createdAt,
        },
        soalPG: ujian.soalPilihanGanda.map((soal, index) => ({
          id: soal.id,
          nomor: index + 1,
          pertanyaan: soal.pertanyaan,
          opsiA: soal.opsiA,
          opsiB: soal.opsiB,
          opsiC: soal.opsiC,
          opsiD: soal.opsiD,
          kunciJawaban: soal.jawabanBenar,
        })),
        soalEssay: ujian.soalEssay.map((soal, index) => ({
          id: soal.id,
          nomor: index + 1,
          pertanyaan: soal.pertanyaan,
          kunciJawaban: soal.kunciJawaban,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching ujian detail:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ujian detail' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'GURU') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const guru = await prisma.guru.findFirst({
      where: { userId: session.userId },
    });

    if (!guru) {
      return NextResponse.json(
        { success: false, error: 'Guru not found' },
        { status: 404 }
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

    // Validate
    if (!judul || !judul.trim()) {
      return NextResponse.json(
        { success: false, error: 'Judul harus diisi' },
        { status: 400 }
      );
    }

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

    // Check if ujian exists and belongs to this guru
    const existingUjian = await prisma.ujian.findFirst({
      where: {
        id: id,
        guruId: guru.id,
      },
    });

    if (!existingUjian) {
      return NextResponse.json(
        { success: false, error: 'Ujian not found' },
        { status: 404 }
      );
    }

    // Validasi: Jika status aktif/publish, SEMUA soalPG harus valid dengan semua opsi (A-D) terisi
    const finalStatus = status || existingUjian.status || 'draft';
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

    const validSoalEssay = (soalEssay || []).filter((soal: any) => {
      const hasQuestion = soal.pertanyaan && soal.pertanyaan.replace(/<[^>]*>/g, '').trim().length > 0;
      return hasQuestion;
    });

    // Update ujian dengan transaction untuk memastikan konsistensi
    const updatedUjian = await prisma.$transaction(async (tx) => {
      // Update ujian info
      const ujian = await tx.ujian.update({
        where: { id },
        data: {
          judul: judul.trim(),
          deskripsi: deskripsi?.trim() || null,
          mapelId: mapelId || existingUjian.mapelId,
          kelas: Array.isArray(kelas) ? kelas : (kelas ? [kelas] : existingUjian.kelas),
          startUjian: startDate,
          endUjian: endDate,
          shuffleQuestions: shuffleQuestions !== undefined ? shuffleQuestions : existingUjian.shuffleQuestions,
          showScore: showScore !== undefined ? showScore : existingUjian.showScore,
          status: finalStatus,
        },
      });

      // Hapus semua soal lama
      await tx.soalPilihanGanda.deleteMany({
        where: { ujianId: id },
      });

      await tx.soalEssay.deleteMany({
        where: { ujianId: id },
      });

      // Buat soal baru
      const soalToCreate = finalStatus === 'aktif' ? allSoalPG : validSoalPG;
      
      if (soalToCreate.length > 0) {
        await tx.soalPilihanGanda.createMany({
          data: soalToCreate.map((soal: any, index: number) => ({
            ujianId: id,
            pertanyaan: soal.pertanyaan,
            opsiA: soal.opsiA,
            opsiB: soal.opsiB,
            opsiC: soal.opsiC,
            opsiD: soal.opsiD,
            jawabanBenar: soal.kunciJawaban || 'A',
            urutan: index + 1,
          })),
        });
      }

      if (validSoalEssay.length > 0) {
        await tx.soalEssay.createMany({
          data: validSoalEssay.map((soal: any, index: number) => ({
            ujianId: id,
            pertanyaan: soal.pertanyaan,
            kunciJawaban: soal.kunciJawaban || '',
            urutan: index + 1,
          })),
        });
      }

      return ujian;
    });

    return NextResponse.json({
      success: true,
      data: updatedUjian,
      message: 'Ujian berhasil diupdate',
    });
  } catch (error) {
    console.error('Error updating ujian:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update ujian' },
      { status: 500 }
    );
  }
}
