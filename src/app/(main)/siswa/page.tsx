"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/useAuth";
import { 
  Exam, 
  CheckCircle,
  Clock,
  Calendar,
  Trophy,
  LockKey,
  ArrowRight,
  FileText,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function SiswaDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: authLoading } = useAuth();
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading } = useSWR('/api/siswa/dashboard', fetcher);
  const { data: ujianData, error: ujianError, isLoading: ujianLoading } = useSWR('/api/siswa/ujian', fetcher);

  if (authLoading || dashboardLoading || ujianLoading) {
    return <LoadingSpinner />;
  }

  if (dashboardError || ujianError) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data dashboard</p>
      </div>
    );
  }

  const siswa = dashboardData?.data?.siswa || {};
  const stats = dashboardData?.data?.stats || {};
  const allUjian = ujianData?.data?.ujian || [];
  
  // Filter ujian yang akan datang (belum selesai dan startUjian >= hari ini)
  const now = new Date();
  const upcomingUjian = allUjian.filter((u: any) => {
    const examStartTime = new Date(u.startUjian);
    return !u.submission && examStartTime >= now;
  });

  const rataRataNilai = stats.rataRataNilai || 0;
  const jumlahUjianMendatang = upcomingUjian.length;

  const gradients = [
    'from-purple-50 to-pink-50',
    'from-blue-50 to-cyan-50',
    'from-green-50 to-emerald-50',
    'from-orange-50 to-red-50',
    'from-indigo-50 to-blue-50',
    'from-rose-50 to-orange-50',
  ];

  const iconColors = [
    'text-purple-600',
    'text-blue-600',
    'text-green-600',
    'text-orange-600',
    'text-indigo-600',
    'text-rose-600',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header dengan Navigasi Mobile */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Selamat datang, {siswa.nama} - {siswa.kelas}
            </p>
          </div>

          {/* Navigasi Mobile Style */}
          <div className="flex gap-3">
            <Button
              onClick={() => router.push('/siswa')}
              className={cn(
                "flex-1 h-12 rounded-xl font-semibold transition-all",
                pathname === '/siswa' 
                  ? "bg-gradient-to-r from-[#1488cc] to-[#2b32b2] text-white shadow-lg" 
                  : "bg-white hover:bg-gray-50 border shadow-sm !text-black"
              )}
            >
              Dashboard
            </Button>
            <Button
              onClick={() => router.push('/siswa/ujian')}
              className={cn(
                "flex-1 h-12 rounded-xl font-semibold transition-all",
                pathname === '/siswa/ujian' 
                  ? "bg-gradient-to-r from-[#1488cc] to-[#2b32b2] text-white shadow-lg" 
                  : "bg-white hover:bg-gray-50 border shadow-sm !text-black [&_svg]:!text-black"
              )}
            >
              <FileText className="w-5 h-5 mr-2" weight="duotone" />
              Ujian
            </Button>
            <Button
              onClick={() => router.push('/siswa/raport')}
              className={cn(
                "flex-1 h-12 rounded-xl font-semibold transition-all",
                pathname === '/siswa/raport' 
                  ? "bg-gradient-to-r from-[#1488cc] to-[#2b32b2] text-white shadow-lg" 
                  : "bg-white hover:bg-gray-50 border shadow-sm !text-black [&_svg]:!text-black"
              )}
            >
              <Trophy className="w-5 h-5 mr-2" weight="duotone" />
              Raport
            </Button>
          </div>
        </div>

        {/* Statistik Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="rounded-2xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/70 backdrop-blur-sm">
                  <Trophy className="w-5 h-5 text-amber-600" weight="duotone" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Rata-rata Nilai</p>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-700">{rataRataNilai}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/70 backdrop-blur-sm">
                  <Exam className="w-5 h-5 text-purple-600" weight="duotone" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Ujian Mendatang</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-700">{jumlahUjianMendatang}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daftar Ujian */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Daftar Ujian</h2>
            {allUjian.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/siswa/ujian')}
                className="text-sm"
              >
                Lihat Semua
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>

          {allUjian.length === 0 ? (
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="py-16">
                <div className="text-center">
                  <Exam className="w-16 h-16 mx-auto text-muted-foreground mb-4" weight="duotone" />
                  <p className="text-muted-foreground font-medium">Belum ada ujian</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allUjian.map((u: any, index: number) => {
                const hasSubmission = !!u.submission;
                const canStart = u.canStart;
                const examStatus = u.examStatus;

                return (
                  <Card 
                    key={u.id} 
                    className={`rounded-2xl border-0 bg-gradient-to-br ${gradients[index % gradients.length]} shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer`}
                    onClick={() => router.push(hasSubmission ? `/siswa/ujian/${u.id}/hasil` : `/siswa/ujian/${u.id}`)}
                  >
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-white/60 backdrop-blur-sm">
                              <Exam className={`w-4 h-4 ${iconColors[index % iconColors.length]}`} weight="duotone" />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                              {u.mapel}
                            </span>
                          </div>
                          <h3 className="font-bold text-base sm:text-lg leading-tight line-clamp-2 mb-1">
                            {u.judul}
                          </h3>
                        </div>
                        {hasSubmission && (
                          <div className="p-2 rounded-lg bg-white/60 backdrop-blur-sm flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-green-600" weight="fill" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" weight="duotone" />
                          <span className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
                            {format(new Date(u.startUjian), "dd MMM yyyy HH:mm", { locale: id })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" weight="duotone" />
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                              {Math.round((new Date(u.endUjian).getTime() - new Date(u.startUjian).getTime()) / 60000)} menit • {u.totalSoal} soal
                            </span>
                          </div>

                          {hasSubmission && u.submission.nilai !== null && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 backdrop-blur-sm flex-shrink-0">
                              <Trophy className="w-4 h-4 text-amber-500" weight="fill" />
                              <span className="font-bold text-sm">{u.submission.nilai}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            examStatus === 'selesai' ? 'bg-green-500' : 
                            examStatus === 'berlangsung' ? 'bg-blue-500' : 
                            examStatus === 'berakhir' ? 'bg-red-500' : 
                            'bg-gray-400'
                          }`} />
                          <span className="text-xs font-medium text-muted-foreground truncate">
                            {examStatus === 'selesai' ? 'Selesai' : 
                             examStatus === 'berlangsung' ? 'Berlangsung' : 
                             examStatus === 'berakhir' ? 'Waktu habis' : 
                             'Belum dimulai'}
                          </span>
                          {!canStart && !hasSubmission && (
                            <LockKey className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" weight="fill" />
                          )}
                        </div>

                        <Button 
                          size="sm" 
                          className={`rounded-lg ${iconColors[index % iconColors.length]} bg-white/60 hover:bg-white/80 backdrop-blur-sm border-0 shadow-none flex-shrink-0 h-8 px-3`}
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(hasSubmission ? `/siswa/ujian/${u.id}/hasil` : `/siswa/ujian/${u.id}`);
                          }}
                          disabled={!canStart && !hasSubmission}
                        >
                          <span className="text-xs font-semibold">
                            {hasSubmission ? 'Lihat' : canStart ? 'Mulai' : 'Terkunci'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" weight="bold" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
