# 🎓 E-Learning Management System (LMS)

Sistem Manajemen Pembelajaran berbasis web yang lengkap untuk sekolah, dibangun dengan Next.js 15, TypeScript, Prisma ORM, dan PostgreSQL.

## 📋 Deskripsi

E-Learning Management System adalah platform pembelajaran digital yang dirancang khusus untuk sekolah menengah. Sistem ini menyediakan fitur lengkap untuk mengelola proses pembelajaran, penilaian, dan administrasi sekolah secara terintegrasi.

## ✨ Fitur Utama

### 👨‍🎓 Portal Siswa
- **Dashboard Interaktif** - Ringkasan tugas, ujian, dan nilai
- **Manajemen Tugas** - Lihat, download, dan submit tugas
- **Sistem Ujian Online** - Ujian dengan pilihan ganda dan essay
- **Raport Digital** - Lihat nilai dan raport per semester
- **Materi Pembelajaran** - Akses materi dari guru
- **Token Ujian** - Sistem keamanan akses ujian

### 👨‍🏫 Portal Guru
- **Dashboard Guru** - Overview kelas dan aktivitas
- **Manajemen Tugas** - Buat, edit, dan nilai tugas siswa
- **Manajemen Ujian** - Buat soal PG & Essay, nilai otomatis
- **Penilaian Siswa** - Sistem penilaian terintegrasi (Tugas, UTS, UAS)
- **Jadwal Mengajar** - Kelola jadwal mengajar
- **Upload Materi** - Share materi pembelajaran

### 👨‍💼 Portal Admin
- **Dashboard Admin** - Statistik sekolah lengkap
- **Manajemen Guru** - CRUD data guru
- **Manajemen Siswa** - CRUD data siswa
- **Manajemen Kelas** - Kelola kelas dan wali kelas
- **Manajemen Mata Pelajaran** - Setup mapel dan guru pengampu
- **Token Ujian** - Generate dan kelola token akses ujian
- **Presensi** - Sistem presensi dengan QR Code
- **Kartu Pelajar Digital** - Generate kartu pelajar siswa

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn UI
- **State Management**: SWR (Stale-While-Revalidate)
- **Form Handling**: React Hook Form
- **Icons**: Lucide React, Phosphor Icons

### Backend
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: Iron Session
- **File Upload**: Multipart Form Data
- **API**: Next.js API Routes

### DevOps & Tools
- **Version Control**: Git & GitHub
- **Deployment**: Vercel
- **Package Manager**: npm
- **Linting**: Biome
- **Git Hooks**: Husky
- **Forms**: React Hook Form
- **Tables**: TanStack Table  

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm atau yarn

### Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/envexx/LMS---Learning-Management-School.git
   cd LMS---Learning-Management-School
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   
   Buat file `.env` di root project:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/elearning_db"
   
   # Session Secret (generate random string)
   SESSION_SECRET="your-secret-key-here"
   
   # App URL
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Setup database**
   ```bash
   # Generate Prisma Client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev
   
   # Seed database dengan data awal
   npm run seed
   
   # Seed data sekolah
   npx tsx prisma/seed-sekolah.ts
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

   Aplikasi akan berjalan di [http://localhost:3000](http://localhost:3000)

### Default Login Credentials

Setelah seeding, gunakan kredensial berikut untuk login:

**Admin:**
- Email: `admin@sekolah.com`
- Password: `admin123`

**Guru:**
- Email: `budi.hartono@sekolah.com`
- Password: `guru123`

**Siswa:**
- Email: `ahmad.rizki@student.com`
- Password: `siswa123`

## 📁 Struktur Project

```
e-learning/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Seed data utama
│   └── seed-sekolah.ts        # Seed data sekolah
├── public/
│   ├── uploads/               # File uploads
│   └── avatars/               # Avatar images
├── src/
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── admin/         # Admin pages
│   │   │   ├── guru/          # Guru pages
│   │   │   └── siswa/         # Siswa pages
│   │   ├── api/               # API routes
│   │   └── login/             # Login page
│   ├── components/
│   │   └── ui/                # Shadcn UI components
│   ├── contexts/              # React contexts
│   ├── hooks/                 # Custom hooks
│   └── lib/                   # Utilities & configs
├── .env                       # Environment variables
└── package.json
```

## 🔐 Authentication & Authorization

Sistem menggunakan **Iron Session** untuk autentikasi dengan role-based access control:

- **Admin**: Full access ke semua fitur
- **Guru**: Akses ke manajemen kelas, tugas, ujian, dan penilaian
- **Siswa**: Akses ke tugas, ujian, materi, dan raport

## 📊 Database Schema

Database menggunakan PostgreSQL dengan Prisma ORM. Schema utama:

- `users` - Data user (admin, guru, siswa)
- `guru` - Data guru
- `siswa` - Data siswa
- `kelas` - Data kelas
- `mata_pelajaran` - Data mata pelajaran
- `tugas` - Data tugas
- `tugas_submission` - Submission tugas siswa
- `ujian` - Data ujian
- `ujian_submission` - Submission ujian siswa
- `soal_pilihan_ganda` - Soal PG
- `soal_essay` - Soal Essay
- `nilai` - Data nilai siswa
- `sekolah_info` - Informasi sekolah

## 🎨 Customization

### Theme
Sistem mendukung light/dark mode dengan beberapa preset warna:
- Neutral (default)
- Tangerine
- Neo Brutalism
- Soft Pop

### School Branding
Logo dan nama sekolah dapat diubah melalui database `sekolah_info` dan akan otomatis muncul di halaman login.

## 🔧 Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npx prisma generate     # Generate Prisma Client
npx prisma migrate dev  # Run migrations
npm run seed            # Seed database
npx prisma studio       # Open Prisma Studio

# Code Quality
npx @biomejs/biome check --write  # Format & lint
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get session

### Admin
- `GET /api/admin/guru` - Get all guru
- `POST /api/admin/guru` - Create guru
- `GET /api/admin/siswa` - Get all siswa
- `POST /api/admin/siswa` - Create siswa

### Guru
- `GET /api/guru/tugas` - Get tugas
- `POST /api/guru/tugas` - Create tugas
- `GET /api/guru/ujian` - Get ujian
- `POST /api/guru/ujian` - Create ujian
- `GET /api/guru/nilai` - Get nilai siswa

### Siswa
- `GET /api/siswa/tugas` - Get tugas
- `POST /api/siswa/tugas/[id]` - Submit tugas
- `GET /api/siswa/ujian` - Get ujian
- `POST /api/siswa/ujian/[id]/submit` - Submit ujian

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Developer

Developed with ❤️ for education

---

**Happy Learning! 🎓**
