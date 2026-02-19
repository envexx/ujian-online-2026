import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, isResetRequired, isBcryptHash } from '@/lib/password';
import { createSession } from '@/lib/session';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email dan password harus diisi' },
        { status: 400 }
      );
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email },
    });

    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    if (!superAdmin.isActive) {
      return NextResponse.json(
        { success: false, error: 'Akun tidak aktif' },
        { status: 403 }
      );
    }

    // Check if password reset is required
    if (isResetRequired(superAdmin.password)) {
      return NextResponse.json(
        { success: false, error: 'Password perlu direset. Hubungi administrator.' },
        { status: 403 }
      );
    }

    // Check if password is still in old bcrypt format
    if (isBcryptHash(superAdmin.password)) {
      return NextResponse.json(
        { success: false, error: 'Akun perlu migrasi. Hubungi administrator.' },
        { status: 403 }
      );
    }

    const isPasswordValid = verifyPassword(password, superAdmin.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    await createSession({
      userId: superAdmin.id,
      email: superAdmin.email,
      role: 'SUPERADMIN',
    });

    return NextResponse.json({
      success: true,
      message: 'Login berhasil',
      data: {
        userId: superAdmin.id,
        email: superAdmin.email,
        nama: superAdmin.nama,
        role: 'SUPERADMIN',
      },
    });
  } catch (error) {
    console.error('SuperAdmin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat login' },
      { status: 500 }
    );
  }
}
