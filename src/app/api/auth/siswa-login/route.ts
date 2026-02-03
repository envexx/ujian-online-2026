import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-characters-long'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nisn } = body;

    if (!nisn) {
      return NextResponse.json(
        { success: false, error: 'NISN harus diisi' },
        { status: 400 }
      );
    }

    // Find siswa by NISN
    const siswa = await prisma.siswa.findUnique({
      where: { nisn },
      include: {
        user: true,
        kelas: true,
      },
    });

    if (!siswa || !siswa.user) {
      return NextResponse.json(
        { success: false, error: 'NISN tidak ditemukan' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!siswa.user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Akun tidak aktif. Hubungi administrator.' },
        { status: 403 }
      );
    }

    // Create JWT token
    const token = await new SignJWT({
      userId: siswa.user.id,
      email: siswa.user.email,
      role: siswa.user.role,
      nama: siswa.nama,
      siswaId: siswa.id,
      nisn: siswa.nisn,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: {
          id: siswa.user.id,
          email: siswa.user.email,
          nama: siswa.nama,
          role: siswa.user.role,
        },
        siswa: {
          id: siswa.id,
          nisn: siswa.nisn,
          kelas: siswa.kelas?.nama || null,
        },
      },
    });
  } catch (error) {
    console.error('Siswa login error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
