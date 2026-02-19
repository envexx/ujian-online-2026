import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const runtime = 'edge';

/**
 * GET - Ambil konfigurasi bobot penilaian guru
 */
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
      include: {
        gradeConfig: true,
      },
    });

    if (!guru) {
      return NextResponse.json(
        { success: false, error: 'Guru not found' },
        { status: 404 }
      );
    }

    // Jika belum ada config, return default
    if (!guru.gradeConfig) {
      return NextResponse.json({
        success: true,
        data: {
          pilihanGanda: {
            name: 'Pilihan Ganda',
            weight: 50,
            active: true,
          },
          essay: {
            name: 'Essay',
            weight: 50,
            active: true,
          },
        },
      });
    }

    // Return existing config
    return NextResponse.json({
      success: true,
      data: {
        pilihanGanda: {
          name: guru.gradeConfig.namaPG,
          weight: guru.gradeConfig.bobotPG,
          active: guru.gradeConfig.activePG,
        },
        essay: {
          name: guru.gradeConfig.namaEssay,
          weight: guru.gradeConfig.bobotEssay,
          active: guru.gradeConfig.activeEssay,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching grade config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch grade config' },
      { status: 500 }
    );
  }
}

/**
 * POST - Simpan konfigurasi bobot penilaian guru
 */
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
    const { pilihanGanda, essay } = body;

    // Validasi
    if (!pilihanGanda || !essay) {
      return NextResponse.json(
        { success: false, error: 'Data tidak lengkap' },
        { status: 400 }
      );
    }

    // Validasi total persentase
    const totalWeight = 
      (pilihanGanda.active ? pilihanGanda.weight : 0) +
      (essay.active ? essay.weight : 0);

    if (totalWeight !== 100) {
      return NextResponse.json(
        { success: false, error: 'Total persentase harus 100%' },
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

    // Upsert config
    const config = await prisma.gradeConfig.upsert({
      where: { guruId: guru.id },
      update: {
        namaPG: pilihanGanda.name,
        bobotPG: pilihanGanda.weight,
        activePG: pilihanGanda.active,
        namaEssay: essay.name,
        bobotEssay: essay.weight,
        activeEssay: essay.active,
      },
      create: {
        guruId: guru.id,
        namaPG: pilihanGanda.name,
        bobotPG: pilihanGanda.weight,
        activePG: pilihanGanda.active,
        namaEssay: essay.name,
        bobotEssay: essay.weight,
        activeEssay: essay.active,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi berhasil disimpan',
      data: config,
    });
  } catch (error) {
    console.error('Error saving grade config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save grade config' },
      { status: 500 }
    );
  }
}
