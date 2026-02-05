import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create template data with headers and example row
    const templateData = [
      {
        'NIS': '12345',
        'NISN': '0012345678',
        'Nama': 'Contoh Nama Siswa',
        'Email': 'siswa@example.com',
        'Kelas': '7A',
        'Jenis Kelamin': 'L',
        'Tanggal Lahir': '2010-01-15',
        'Alamat': 'Jl. Contoh No. 123',
        'No. Telepon': '081234567890',
        'Nama Wali': 'Nama Wali Siswa',
        'No. Telepon Wali': '081234567891',
      },
      {
        'NIS': '',
        'NISN': '',
        'Nama': '',
        'Email': '',
        'Kelas': '',
        'Jenis Kelamin': '',
        'Tanggal Lahir': '',
        'Alamat': '',
        'No. Telepon': '',
        'Nama Wali': '',
        'No. Telepon Wali': '',
      },
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // NIS
      { wch: 15 }, // NISN
      { wch: 30 }, // Nama
      { wch: 30 }, // Email
      { wch: 10 }, // Kelas
      { wch: 15 }, // Jenis Kelamin
      { wch: 15 }, // Tanggal Lahir
      { wch: 40 }, // Alamat
      { wch: 18 }, // No. Telepon
      { wch: 30 }, // Nama Wali
      { wch: 18 }, // No. Telepon Wali
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return file as download
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template_Import_Siswa.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
