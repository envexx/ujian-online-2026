"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Student,
  CalendarBlank,
  ClipboardText,
  BookOpen,
  Clock,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface DashboardStats {
  totalKelas: number;
  totalSiswa: number;
  jadwalHariIni: number;
  tugasBelumDinilai: number;
}

interface JadwalHariIni {
  id: string;
  waktu: string;
  kelas: string;
  mapel: string;
  ruangan: string;
}

interface TugasPending {
  id: string;
  kelas: string;
  mapel: string;
  judul: string;
  jumlahSiswa: number;
  deadline: Date;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function GuruDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, error, isLoading } = useSWR('/api/guru/dashboard', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  if (authLoading || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data dashboard</p>
      </div>
    );
  }

  const stats = data?.data?.stats || {
    totalKelas: 0,
    totalSiswa: 0,
    jadwalHariIni: 0,
    tugasBelumDinilai: 0,
  };
  const jadwalHariIni = data?.data?.jadwalHariIni || [];
  const tugasPending = data?.data?.tugasPending || [];

  const statCards = [
    {
      title: "Total Kelas",
      value: stats.totalKelas,
      icon: Users,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
    },
    {
      title: "Total Siswa",
      value: stats.totalSiswa,
      icon: Student,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
    },
    {
      title: "Jadwal Hari Ini",
      value: stats.jadwalHariIni,
      icon: CalendarBlank,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
    },
    {
      title: "Tugas Belum Dinilai",
      value: stats.tugasBelumDinilai,
      icon: ClipboardText,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard Guru</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Selamat datang, {user?.profile?.nama || 'Guru'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.iconColor}
            iconBg={stat.iconBg}
          />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" weight="duotone" />
                Jadwal Mengajar Hari Ini
              </CardTitle>
              <Link href="/guru/jadwal">
                <Button variant="ghost" size="sm">
                  Lihat Semua
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jadwalHariIni.length > 0 ? (
                jadwalHariIni.map((jadwal: any) => (
                  <div
                    key={jadwal.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="p-2 rounded-lg bg-gray-100">
                        <Clock className="w-4 h-4 text-gray-600" weight="duotone" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{jadwal.mapel}</p>
                        <span className="text-xs text-muted-foreground">
                          {jadwal.waktu}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Kelas {jadwal.kelas} • {jadwal.ruangan}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarBlank className="w-12 h-12 mx-auto mb-2 opacity-50" weight="duotone" />
                  <p>Tidak ada jadwal mengajar hari ini</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <WarningCircle className="w-5 h-5" weight="duotone" />
                Tugas Menunggu Penilaian
              </CardTitle>
              <Link href="/guru/nilai">
                <Button variant="ghost" size="sm">
                  Lihat Semua
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tugasPending.length > 0 ? (
                tugasPending.map((tugas: any) => (
                  <div
                    key={tugas.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="p-2 rounded-lg bg-red-100">
                        <ClipboardText className="w-4 h-4 text-red-600" weight="duotone" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{tugas.judul}</p>
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                          {tugas.jumlahSiswa} siswa
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tugas.mapel} • Kelas {tugas.kelas}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Deadline: {new Date(tugas.deadline).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Semua tugas sudah dinilai</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/guru/jadwal">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-lg bg-purple-100">
                <CalendarBlank className="w-6 h-6 text-purple-600" weight="duotone" />
              </div>
              <div>
                <h3 className="font-semibold">Jadwal Mengajar</h3>
                <p className="text-sm text-muted-foreground">
                  Lihat jadwal mengajar
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/guru/nilai">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-lg bg-green-100">
                <ClipboardText className="w-6 h-6 text-green-600" weight="duotone" />
              </div>
              <div>
                <h3 className="font-semibold">Penilaian Siswa</h3>
                <p className="text-sm text-muted-foreground">
                  Input dan kelola nilai
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/guru/materi">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-lg bg-orange-100">
                <BookOpen className="w-6 h-6 text-orange-600" weight="duotone" />
              </div>
              <div>
                <h3 className="font-semibold">Materi Pembelajaran</h3>
                <p className="text-sm text-muted-foreground">
                  Upload dan kelola materi
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
