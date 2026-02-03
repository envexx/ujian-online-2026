import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

// TODO: Implement Nilai model in Prisma schema before enabling these endpoints
export async function GET(request: Request) {
  return NextResponse.json(
    { success: false, error: 'Nilai feature not yet implemented' },
    { status: 501 }
  );
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: 'Nilai feature not yet implemented' },
    { status: 501 }
  );
}

// export async function GET(request: Request) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const kelasId = searchParams.get('kelas');
//     const mapelId = searchParams.get('mapel');
//     const semester = searchParams.get('semester');
//     const tahunAjaran = searchParams.get('tahunAjaran');
    
//     const nilai = await prisma.nilai.findMany({
//       where: {
//         ...(kelasId && kelasId !== 'all' ? { siswa: { kelasId } } : {}),
//         ...(mapelId && mapelId !== 'all' ? { mapelId } : {}),
//         ...(semester ? { semester } : {}),
//         ...(tahunAjaran ? { tahunAjaran } : {}),
//       },
//       include: {
//         siswa: {
//           include: {
//             kelas: true,
//           },
//         },
//         mapel: true,
//         guru: true,
//       },
//       orderBy: { siswa: { nama: 'asc' } },
//     });
    
//     return NextResponse.json({
//       success: true,
//       data: nilai,
//     });
//   } catch (error) {
//     console.error('Error fetching nilai:', error);
//     return NextResponse.json(
//       { success: false, error: 'Failed to fetch nilai' },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(request: Request) {
//   try {
//     const body = await request.json();
    
//     const nilai = await prisma.nilai.upsert({
//       where: {
//         siswaId_mapelId_semester_tahunAjaran: {
//           siswaId: body.siswaId,
//           mapelId: body.mapelId,
//           semester: body.semester,
//           tahunAjaran: body.tahunAjaran,
//         },
//       },
//       update: {
//         tugas: body.tugas,
//         uts: body.uts,
//         uas: body.uas,
//         nilaiAkhir: body.nilaiAkhir,
//       },
//       create: body,
//       include: {
//         siswa: true,
//         mapel: true,
//         guru: true,
//       },
//     });
    
//     return NextResponse.json({
//       success: true,
//       data: nilai,
//       message: 'Nilai berhasil disimpan',
//     });
//   } catch (error) {
//     console.error('Error saving nilai:', error);
//     return NextResponse.json(
//       { success: false, error: 'Failed to save nilai' },
//       { status: 500 }
//     );
//   }
// }
