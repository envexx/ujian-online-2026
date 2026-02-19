import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

export const runtime = 'edge';

export async function POST() {
  try {
    await destroySession();
    
    return NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat logout' },
      { status: 500 }
    );
  }
}
