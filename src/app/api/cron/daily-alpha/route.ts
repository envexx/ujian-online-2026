import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Cron endpoint for Vercel Cron Jobs or external cron services
 * This should be configured to run daily at 9:00 AM WIB
 * 
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-alpha",
 *     "schedule": "0 2 * * *"  // 9:00 AM WIB = 2:00 AM UTC
 *   }]
 * }
 * 
 * Or use external services like:
 * - cron-job.org
 * - EasyCron
 * - GitHub Actions
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call the auto-alpha endpoint
    const baseUrl = request.headers.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    
    const response = await fetch(`${protocol}://${baseUrl}/api/presensi/auto-alpha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      result,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request);
}
