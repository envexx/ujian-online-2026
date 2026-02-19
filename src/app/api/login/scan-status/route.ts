import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID diperlukan' },
        { status: 400 }
      );
    }

    // Query scan session from database
    const scanSession = await prisma.passwordResetToken.findFirst({
      where: {
        email: `scan_${sessionId}`,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!scanSession || !scanSession.token) {
      return NextResponse.json({
        success: true,
        detected: false,
      });
    }

    // Parse device data from token field
    try {
      const device = JSON.parse(scanSession.token);
      return NextResponse.json({
        success: true,
        detected: true,
        device,
      });
    } catch {
      return NextResponse.json({
        success: true,
        detected: false,
      });
    }
  } catch (error) {
    console.error('Error checking scan status:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memeriksa status scan' },
      { status: 500 }
    );
  }
}

