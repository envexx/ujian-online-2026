import { NextResponse } from 'next/server';
import { addToQueue, getQueueStatus } from '@/lib/whatsapp-queue';

export const runtime = 'edge';

// Endpoint untuk menambahkan pesan ke antrian
export async function POST(request: Request) {
  try {
    const { receiver, message } = await request.json();

    if (!receiver || !message) {
      return NextResponse.json(
        { success: false, error: 'Receiver dan message diperlukan' },
        { status: 400 }
      );
    }

    await addToQueue(receiver, message);

    const status = getQueueStatus();
    return NextResponse.json({
      success: true,
      message: 'Pesan telah ditambahkan ke antrian',
      queueLength: status.queueLength,
    });
  } catch (error: any) {
    console.error('Error adding message to queue:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan pesan ke antrian' },
      { status: 500 }
    );
  }
}

// Endpoint untuk melihat status antrian
export async function GET(request: Request) {
  const status = getQueueStatus();
  return NextResponse.json({
    success: true,
    ...status,
  });
}

