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

    // Get ujian with submissions
    const ujian = await prisma.ujian.findFirst({
      where: {
        id: id,
        guruId: guru.id,
      },
      include: {
        mapel: true,
        submissions: {
          include: {
            siswa: true,
            jawabanPilihanGanda: true,
            jawabanEssay: true,
          },
          orderBy: {
            submittedAt: 'desc',
          },
        },
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

    // Get all siswa in the kelas
    const allSiswa = await prisma.siswa.findMany({
      where: {
        kelas: {
          nama: {
            in: ujian.kelas,
          },
        },
      },
      orderBy: {
        nama: 'asc',
      },
    });

    // Map submissions with all siswa
    const submissionsMap = new Map(
      ujian.submissions.map((sub) => [sub.siswaId, sub])
    );

    const submissions = allSiswa.map((siswa) => {
      const submission = submissionsMap.get(siswa.id);

      // Calculate PG score
      // Always use total soal from ujian, not from saved answers
      let nilaiPG = null;
      const totalPG = ujian.soalPilihanGanda.length;
      
      if (submission && totalPG > 0) {
        // Count correct answers from saved answers
        const correctPG = submission.jawabanPilihanGanda 
          ? submission.jawabanPilihanGanda.filter((j: any) => j.isCorrect).length
          : 0;
        
        // Calculate score based on total soal, not saved answers
        nilaiPG = Math.round((correctPG / totalPG) * 100);
        
        console.log(`Siswa ${siswa.nama}: Correct PG: ${correctPG}, Total PG: ${totalPG}, Nilai: ${nilaiPG}`);
      }

      // Calculate Essay score
      let nilaiEssay = null;
      if (submission && submission.jawabanEssay && submission.jawabanEssay.length > 0) {
        const totalNilaiEssay = submission.jawabanEssay.reduce(
          (sum: number, j: any) => sum + (j.nilai || 0),
          0
        );
        const totalEssay = ujian.soalEssay.length;
        nilaiEssay = totalEssay > 0 ? Math.round(totalNilaiEssay / totalEssay) : 0;
      }

      return {
        id: submission?.id || null,
        siswaId: siswa.id,
        siswa: siswa.nama,
        nisn: siswa.nisn,
        submittedAt: submission?.submittedAt || null,
        nilaiPG,
        nilaiEssay,
        nilaiTotal: submission?.nilai || null,
        status: submission ? 'sudah' : 'belum',
        jawabanPG: submission?.jawabanPilihanGanda?.map((jawaban: any) => ({
          id: jawaban.id,
          soalId: jawaban.soalId,
          jawaban: jawaban.jawaban,
          isCorrect: jawaban.isCorrect,
        })) || [],
        jawabanEssay: submission?.jawabanEssay?.map((jawaban: any) => ({
          id: jawaban.id,
          soalId: jawaban.soalId,
          jawaban: jawaban.jawaban,
          nilai: jawaban.nilai,
          feedback: jawaban.feedback,
        })) || [],
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ujian: {
          id: ujian.id,
          judul: ujian.judul,
          deskripsi: ujian.deskripsi,
          mapel: ujian.mapel.nama,
          kelas: ujian.kelas,
          startUjian: ujian.startUjian,
          endUjian: ujian.endUjian,
          totalSoalPG: ujian.soalPilihanGanda.length,
          totalSoalEssay: ujian.soalEssay.length,
        },
        soalPG: ujian.soalPilihanGanda.map((soal, index) => ({
          id: soal.id,
          nomor: index + 1,
          pertanyaan: soal.pertanyaan,
          jawabanBenar: soal.jawabanBenar,
        })),
        soalEssay: ujian.soalEssay.map((soal, index) => ({
          id: soal.id,
          nomor: index + 1,
          pertanyaan: soal.pertanyaan,
          kunciJawaban: soal.kunciJawaban,
        })),
        submissions,
      },
    });
  } catch (error) {
    console.error('Error fetching ujian nilai:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ujian nilai' },
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

    const body = await request.json();
    const { submissionId, jawabanEssay } = body;

    if (!submissionId || !jawabanEssay) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update essay answers with grades
    for (const jawaban of jawabanEssay) {
      if (!jawaban.id) {
        console.error('Missing jawaban.id for essay answer:', jawaban);
        continue;
      }
      
      await prisma.jawabanEssay.update({
        where: { id: jawaban.id },
        data: {
          nilai: jawaban.nilai,
          feedback: jawaban.feedback || '',
          gradedAt: new Date(),
        },
      });
    }

    // Get submission with all answers to calculate total score
    const submission = await prisma.ujianSubmission.findUnique({
      where: { id: submissionId },
      include: {
        ujian: {
          include: {
            soalPilihanGanda: true,
            soalEssay: true,
          },
        },
        jawabanPilihanGanda: true,
        jawabanEssay: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    const totalSoalPG = submission.ujian.soalPilihanGanda.length;
    const totalSoalEssay = submission.ujian.soalEssay.length;

    // Get grading weights from request body (from frontend settings)
    const { bobotPG = 50, bobotEssay = 50 } = body;

    // Calculate PG score (correct answers / total PG * 100)
    // Always use total soal from ujian, not from saved answers
    const correctPG = submission.jawabanPilihanGanda 
      ? submission.jawabanPilihanGanda.filter((j: any) => j.isCorrect).length
      : 0;
    const nilaiPG = totalSoalPG > 0 ? Math.round((correctPG / totalSoalPG) * 100) : 0;
    
    console.log(`Updating nilai - Correct PG: ${correctPG}, Total PG: ${totalSoalPG}, Nilai PG: ${nilaiPG}`);

    // Calculate Essay score (sum of essay grades / total essay * 100)
    const totalNilaiEssay = submission.jawabanEssay.reduce(
      (sum, j) => sum + (j.nilai || 0),
      0
    );
    const nilaiEssay = totalSoalEssay > 0 ? totalNilaiEssay / totalSoalEssay : 0;

    // Calculate weighted final score using percentage weights from settings
    let nilaiAkhir = 0;
    if (totalSoalPG > 0 && totalSoalEssay > 0) {
      // Both PG and Essay exist - use percentage weights from settings
      nilaiAkhir = Math.round((nilaiPG * bobotPG / 100) + (nilaiEssay * bobotEssay / 100));
    } else if (totalSoalPG > 0) {
      // Only PG - use full PG score
      nilaiAkhir = nilaiPG;
    } else if (totalSoalEssay > 0) {
      // Only Essay - use full Essay score
      nilaiAkhir = Math.round(nilaiEssay);
    }
    
    console.log(`Bobot PG: ${bobotPG}%, Bobot Essay: ${bobotEssay}%, Nilai Akhir: ${nilaiAkhir}`);

    // Update submission with final score and status
    await prisma.ujianSubmission.update({
      where: { id: submissionId },
      data: {
        nilai: nilaiAkhir,
        status: 'completed',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Nilai essay berhasil disimpan',
      data: {
        nilai: nilaiAkhir,
      },
    });
  } catch (error) {
    console.error('Error updating essay grades:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update essay grades' },
      { status: 500 }
    );
  }
}
