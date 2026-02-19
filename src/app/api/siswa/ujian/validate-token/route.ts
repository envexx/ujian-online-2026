import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshSession } from '@/lib/session';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // Use refreshSession for token validation (rolling session)
    const session = await refreshSession();

    if (!session.isLoggedIn || session.role !== 'SISWA') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token || token.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Token harus diisi' },
        { status: 400 }
      );
    }

    // Get the global access control
    const accessControl = await prisma.ujianAccessControl.findFirst();

    if (!accessControl) {
      return NextResponse.json(
        { success: false, error: 'Sistem akses ujian belum dikonfigurasi' },
        { status: 404 }
      );
    }

    // Check if access is active
    if (!accessControl.isActive) {
      return NextResponse.json(
        { success: false, error: 'Akses ujian sedang tidak aktif' },
        { status: 403 }
      );
    }

    // Check if token is expired
    const now = new Date();
    if (!accessControl.tokenExpiresAt || accessControl.tokenExpiresAt < now) {
      return NextResponse.json(
        { success: false, error: 'Token sudah kadaluarsa' },
        { status: 403 }
      );
    }

    // Validate token
    if (token.trim() !== accessControl.currentToken) {
      return NextResponse.json(
        { success: false, error: 'Token tidak valid' },
        { status: 403 }
      );
    }

    // Token is valid
    return NextResponse.json({
      success: true,
      message: 'Token valid. Anda dapat mengakses ujian.',
      data: {
        expiresAt: accessControl.tokenExpiresAt,
      },
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memvalidasi token' },
      { status: 500 }
    );
  }
}
