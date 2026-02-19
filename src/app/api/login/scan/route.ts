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

    // Detect device dari User-Agent dan headers
    const userAgent = request.headers.get('user-agent') || '';
    const customAppHeader = request.headers.get('x-app-platform');
    
    let platform = 'unknown';
    let type = 'browser';

    // Check jika ada custom header dari app
    if (customAppHeader) {
      platform = customAppHeader.toLowerCase();
      type = 'app';
    } else {
      // Detect dari User-Agent
      const ua = userAgent.toLowerCase();
      
      if (ua.includes('android')) {
        platform = 'android';
        type = 'mobile';
      } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
        platform = 'ios';
        type = 'mobile';
      } else if (ua.includes('windows')) {
        platform = 'windows';
        type = 'desktop';
      } else if (ua.includes('mac')) {
        platform = 'mac';
        type = 'desktop';
      } else if (ua.includes('linux')) {
        platform = 'linux';
        type = 'desktop';
      }
    }

    // Store scan session in database using raw SQL (Edge-compatible)
    // Using PasswordResetToken table as temporary storage (will be cleaned up)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const deviceData = JSON.stringify({ type, platform });
    
    // Upsert scan session data
    await prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" (id, email, token, "expiresAt", used)
      VALUES (gen_random_uuid(), ${`scan_${sessionId}`}, ${deviceData}, ${expiresAt}, false)
      ON CONFLICT (email) DO UPDATE SET token = ${deviceData}, "expiresAt" = ${expiresAt}
    `;

    // Return HTML page untuk redirect atau info
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Device Terdeteksi</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 1rem;
      backdrop-filter: blur(10px);
    }
    h1 { margin: 0 0 1rem 0; }
    .info {
      background: rgba(255, 255, 255, 0.2);
      padding: 1rem;
      border-radius: 0.5rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✓ Device Terdeteksi!</h1>
    <div class="info">
      <p><strong>Platform:</strong> ${platform === 'android' ? 'Android' : platform === 'ios' ? 'iOS' : platform}</p>
      <p><strong>Type:</strong> ${type === 'app' ? 'App' : type === 'mobile' ? 'Mobile Browser' : 'Desktop Browser'}</p>
    </div>
    <p style="margin-top: 1rem; opacity: 0.8;">Anda dapat menutup halaman ini</p>
  </div>
</body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  } catch (error) {
    console.error('Error in scan route:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memproses scan' },
      { status: 500 }
    );
  }
}

