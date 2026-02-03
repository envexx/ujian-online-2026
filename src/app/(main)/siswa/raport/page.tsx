"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartBar, Trophy, Exam, FileText } from "@phosphor-icons/react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function SiswaRaportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: authLoading } = useAuth();
  const { data, error, isLoading } = useSWR('/api/siswa/raport', fetcher);

  if (authLoading || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data raport</p>
      </div>
    );
  }

  const siswa = data?.data?.siswa || {};
  const raport = data?.data?.raport || [];
  const rataRataKeseluruhan = data?.data?.rataRataKeseluruhan || 0;
  const totalUjianDinilai = data?.data?.totalUjianDinilai || 0;

  const getNilaiColor = (nilai: number) => {
    if (nilai >= 85) return 'text-green-600 bg-green-50';
    if (nilai >= 70) return 'text-blue-600 bg-blue-50';
    if (nilai >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header dengan Navigasi Mobile */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Raport</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {siswa.nama} - {siswa.nisn} - {siswa.kelas}
            </p>
          </div>

          {/* Navigasi Mobile Style */}
          <div className="flex gap-3">
            <Button
              onClick={() => router.push('/siswa')}
              className={cn(
                "flex-1 h-12 rounded-xl font-semibold transition-all",
                "bg-white hover:bg-gray-50 border shadow-sm !text-black"
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

      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <Card className="rounded-xl border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/60 backdrop-blur-sm">
                <Trophy className="w-5 h-5 text-purple-600" weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Rata-rata</p>
                <p className="text-2xl font-bold">{rataRataKeseluruhan}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/60 backdrop-blur-sm">
                <Exam className="w-4 h-4 text-green-600" weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Total Ujian</p>
                <p className="text-2xl font-bold">{totalUjianDinilai}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBar className="w-5 h-5 text-purple-600" weight="duotone" />
            Nilai Per Mata Pelajaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          {raport.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Belum ada nilai yang tersedia
            </p>
          ) : (
            <div className="space-y-6">
              {raport.map((r: any) => (
                <div key={r.mapel} className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{r.mapel}</h3>
                    <div className={`px-4 py-2 rounded-lg font-bold text-xl ${getNilaiColor(r.rataRata)}`}>
                      {r.rataRata}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Daftar Ujian ({r.totalUjian})</p>
                    <div className="space-y-2">
                      {r.ujian.map((u: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{u.judul}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(u.tanggal), "dd MMM yyyy", { locale: id })}
                            </span>
                          </div>
                          <div className={`px-3 py-1 rounded-lg font-bold text-base ml-3 ${getNilaiColor(u.nilai)}`}>
                            {u.nilai}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
