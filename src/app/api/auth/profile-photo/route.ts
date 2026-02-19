import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'edge';

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ENDPOINT = R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'e-learning';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function POST(request: Request) {
  try {
    // Validate R2 configuration
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
      return NextResponse.json(
        { success: false, error: 'R2 storage tidak dikonfigurasi' },
        { status: 500 }
      );
    }

    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File foto harus diupload' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Format file harus JPG, PNG, atau WebP' },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Ukuran file maksimal 2MB' },
        { status: 400 }
      );
    }

    // Create unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `profiles/profile_${session.userId}_${timestamp}_${randomStr}.${ext}`;

    // Convert file to buffer and upload to R2
    const bytes = await file.arrayBuffer();
    const buffer = new Uint8Array(bytes);

    const s3Client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    const photoUrl = `${R2_PUBLIC_URL}/${fileName}`;

    // Update profilePhoto on User model
    await prisma.user.update({
      where: { id: session.userId },
      data: { profilePhoto: photoUrl },
    });

    // Also update foto on role-specific model
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });

    if (user?.role === 'GURU') {
      await prisma.guru.updateMany({
        where: { userId: session.userId },
        data: { foto: photoUrl },
      });
    } else if (user?.role === 'SISWA') {
      await prisma.siswa.updateMany({
        where: { userId: session.userId },
        data: { foto: photoUrl },
      });
    }

    return NextResponse.json({
      success: true,
      data: { url: photoUrl },
      message: 'Foto profil berhasil diupload',
    });
  } catch (error) {
    console.error('Profile photo upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengupload foto profil' },
      { status: 500 }
    );
  }
}
