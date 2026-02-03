import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ 
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🎯 Creating dummy ujian...\n');

  try {
    // Find first guru
    const guru = await prisma.guru.findFirst({
      include: {
        user: true,
      },
    });

    if (!guru) {
      console.error('❌ No guru found. Please run seed.ts first.');
      return;
    }

    // Find first mapel (Matematika)
    const mapel = await prisma.mataPelajaran.findFirst({
      where: {
        nama: {
          contains: 'Matematika',
        },
      },
    });

    if (!mapel) {
      console.error('❌ No mata pelajaran found. Please run seed.ts first.');
      return;
    }

    // Find first kelas
    const kelas = await prisma.kelas.findFirst();
    if (!kelas) {
      console.error('❌ No kelas found. Please run seed.ts first.');
      return;
    }

    // Create dummy ujian - set tanggal untuk hari ini agar bisa langsung diakses
    const today = new Date();
    today.setHours(8, 0, 0, 0); // Set jam 08:00

    const ujian = await prisma.ujian.create({
      data: {
        judul: 'Ujian Dummy - Matematika Dasar',
        deskripsi: 'Ujian dummy untuk testing pengalaman user. Ujian ini berisi soal-soal matematika dasar yang dapat digunakan untuk melihat bagaimana sistem ujian bekerja.',
        mapelId: mapel.id,
        guruId: guru.id,
        kelas: [kelas.nama],
        startUjian: new Date(today.getTime() + 8 * 60 * 60 * 1000), // 08:00 hari ini
        endUjian: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 09:00 hari ini (60 menit)
        shuffleQuestions: false,
        showScore: true,
        status: 'aktif',
      },
    });

    console.log('✅ Created ujian:', ujian.judul);

    // Create 4 soal pilihan ganda
    const soalPG = [
      {
        ujianId: ujian.id,
        pertanyaan: 'Berapakah hasil dari 15 + 27?',
        opsiA: '40',
        opsiB: '42',
        opsiC: '44',
        opsiD: '45',
        jawabanBenar: 'B',
        urutan: 1,
      },
      {
        ujianId: ujian.id,
        pertanyaan: 'Jika sebuah persegi panjang memiliki panjang 8 cm dan lebar 5 cm, berapakah luasnya?',
        opsiA: '35 cm²',
        opsiB: '40 cm²',
        opsiC: '45 cm²',
        opsiD: '50 cm²',
        jawabanBenar: 'B',
        urutan: 2,
      },
      {
        ujianId: ujian.id,
        pertanyaan: 'Berapakah hasil dari 144 ÷ 12?',
        opsiA: '10',
        opsiB: '11',
        opsiC: '12',
        opsiD: '13',
        jawabanBenar: 'C',
        urutan: 3,
      },
      {
        ujianId: ujian.id,
        pertanyaan: 'Jika x = 5, berapakah nilai dari 3x + 7?',
        opsiA: '20',
        opsiB: '22',
        opsiC: '24',
        opsiD: '26',
        jawabanBenar: 'B',
        urutan: 4,
      },
    ];

    await prisma.soalPilihanGanda.createMany({
      data: soalPG,
    });

    console.log(`✅ Created ${soalPG.length} soal pilihan ganda`);

    console.log('\n✅ ============================================');
    console.log('✅ DUMMY UJIAN CREATED SUCCESSFULLY!');
    console.log('✅ ============================================\n');
    console.log('📝 Ujian Details:');
    console.log(`   - Judul: ${ujian.judul}`);
    console.log(`   - Mata Pelajaran: ${mapel.nama}`);
    console.log(`   - Kelas: ${kelas.nama}`);
    console.log(`   - Waktu Mulai: ${ujian.startUjian.toLocaleString('id-ID')}`);
    console.log(`   - Waktu Akhir: ${ujian.endUjian.toLocaleString('id-ID')}`);
    const durasiMenit = Math.round((ujian.endUjian.getTime() - ujian.startUjian.getTime()) / 60000);
    console.log(`   - Durasi: ${durasiMenit} menit`);
    console.log(`   - Total Soal: ${soalPG.length} soal pilihan ganda`);
    console.log(`   - Status: ${ujian.status}`);
    console.log('\n💡 Ujian ini sudah aktif dan dapat langsung diakses oleh siswa!');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error creating dummy ujian:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




