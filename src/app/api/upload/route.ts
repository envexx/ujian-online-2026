import { NextResponse } from 'next/server';
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

// Initialize S3 client for Cloudflare R2
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
        { success: false, error: 'R2 storage tidak dikonfigurasi. Pastikan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, dan R2_PUBLIC_URL dikonfigurasi.' },
        { status: 500 }
      );
    }

    const session = await getSession();

    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Get file extension
    const fileExtension = file.name.split('.').pop();
    const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif'];
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Create unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${folder}/${timestamp}_${randomString}_${sanitizedFileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = new Uint8Array(bytes);

    // Upload to R2
    const s3Client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    // Return public URL
    const publicUrl = `${R2_PUBLIC_URL}/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        fileName: uniqueFileName,
        filePath: publicUrl,
        fileSize: file.size,
        fileType: file.type,
      },
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
