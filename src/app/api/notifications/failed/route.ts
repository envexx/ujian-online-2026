import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { receiver, message, error, failedAt } = body;

    if (!receiver || !message) {
      return NextResponse.json(
        { success: false, error: 'Receiver and message are required' },
        { status: 400 }
      );
    }

    // Save failed notification to database
    const failedNotification = await prisma.failedNotification.create({
      data: {
        receiver,
        message,
        error: error || null,
        failedAt: failedAt ? new Date(failedAt) : new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: failedNotification,
    });
  } catch (error: any) {
    console.error('Error saving failed notification:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const retried = searchParams.get('retried');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};
    if (retried !== null) {
      where.retried = retried === 'true';
    }

    const failedNotifications = await prisma.failedNotification.findMany({
      where,
      orderBy: { failedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: failedNotifications,
      total: failedNotifications.length,
    });
  } catch (error: any) {
    console.error('Error fetching failed notifications:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
