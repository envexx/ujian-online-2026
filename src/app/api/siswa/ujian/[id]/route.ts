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
      include: { kelas: true },
    });

    if (!siswa) {
      return NextResponse.json(
        { success: false, error: 'Siswa not found' },
        { status: 404 }
      );
    }

    // Get ujian detail
    const ujian = await prisma.ujian.findFirst({
      where: {
        id,
        kelas: { has: siswa.kelas.nama },
        status: 'aktif',
      },
      include: {
        mapel: true,
        soalPilihanGanda: {
          orderBy: { urutan: 'asc' },
        },
        soalEssay: {
          orderBy: { urutan: 'asc' },
        },
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

    // Check time validation - ujian hanya bisa diakses pada waktu yang ditentukan
    // Menggunakan startUjian dan endUjian langsung dari database
    const now = new Date();
    const examStartTime = new Date(ujian.startUjian);
    const examEndTime = new Date(ujian.endUjian);
    
    // Debug log untuk membantu troubleshooting
    console.log('Time Check:', {
      now: now.toString(),
      nowLocal: now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      examStartTime: examStartTime.toString(),
      examStartTimeLocal: examStartTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      examEndTime: examEndTime.toString(),
      examEndTimeLocal: examEndTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      canStart: now >= examStartTime && now <= examEndTime,
      comparison: {
        nowVsExamStart: now >= examStartTime,
        nowVsExamEnd: now <= examEndTime,
      },
    });

    // Ujian hanya bisa dimulai jika:
    // 1. Waktu saat ini >= waktu mulai ujian (startUjian)
    // 2. Waktu saat ini <= waktu akhir ujian (endUjian)
    // 3. Belum ada submission yang sudah di-submit
    const canStart = now >= examStartTime && now <= examEndTime && !ujian.submissions[0]?.submittedAt;

    // Calculate remaining time
    // Waktu tersisa dihitung dari endUjian - sekarang
    // Tidak peduli kapan siswa mulai, waktu habis saat endUjian tercapai
    let timeRemaining = 0; // in seconds
    timeRemaining = Math.max(0, Math.floor((examEndTime.getTime() - now.getTime()) / 1000));

    // Helper function to format date in Indonesian
    const formatDateIndonesian = (date: Date) => {
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    const formatTime = (date: Date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    // Determine access status message
    let accessMessage = '';
    if (ujian.submissions[0]?.submittedAt) {
      accessMessage = 'Ujian sudah dikumpulkan';
    } else if (now < examStartTime) {
      accessMessage = `Ujian belum dimulai. Ujian dapat diakses mulai ${formatDateIndonesian(examStartTime)} pukul ${formatTime(examStartTime)}`;
    } else if (now > examEndTime) {
      accessMessage = `Waktu ujian telah berakhir. Ujian berakhir pada ${formatDateIndonesian(examEndTime)} pukul ${formatTime(examEndTime)}`;
    } else {
      accessMessage = 'Ujian dapat diakses';
    }

    // Prepare soal data
    let soalPG = ujian.soalPilihanGanda.map((s, idx) => ({
      id: s.id,
      nomor: idx + 1,
      pertanyaan: s.pertanyaan,
      opsiA: s.opsiA,
      opsiB: s.opsiB,
      opsiC: s.opsiC,
      opsiD: s.opsiD,
    }));

    let soalEssay = ujian.soalEssay.map((s, idx) => ({
      id: s.id,
      nomor: idx + 1,
      pertanyaan: s.pertanyaan,
    }));

    // Shuffle questions if shuffleQuestions is enabled
    // Note: Shuffle is done in frontend to ensure each student gets different order
    // Backend only provides the shuffleQuestions flag

    return NextResponse.json({
      success: true,
      data: {
        ujian: {
          id: ujian.id,
          judul: ujian.judul,
          deskripsi: ujian.deskripsi,
          mapel: ujian.mapel.nama,
          startUjian: ujian.startUjian,
          endUjian: ujian.endUjian,
          shuffleQuestions: ujian.shuffleQuestions, // Include shuffleQuestions flag
          totalSoal: ujian.soalPilihanGanda.length + ujian.soalEssay.length,
        },
        soalPG,
        soalEssay,
        submission: ujian.submissions[0] || null,
        canStart,
        timeRemaining, // Waktu tersisa dalam detik (dihitung dari endUjian - sekarang)
        examStartTime: examStartTime.toISOString(),
        examEndTime: examEndTime.toISOString(),
        accessMessage, // Pesan status akses
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
