import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get school information
    const schoolInfo = await prisma.sekolahInfo.findFirst({
      select: {
        namaSekolah: true,
        logo: true,
      },
    });

    if (!schoolInfo) {
      // Return default values if no school info exists
      return NextResponse.json({
        title: "E-Learning System",
        favicon: "/favicon.ico",
      });
    }

    return NextResponse.json({
      title: `${schoolInfo.namaSekolah} - E-Learning`,
      favicon: schoolInfo.logo || "/favicon.ico",
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { 
        title: "E-Learning System",
        favicon: "/favicon.ico",
      },
      { status: 500 }
    );
  }
}
