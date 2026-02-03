"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/useAuth";
import { 
  Exam, 
  CheckCircle, 
  Clock, 
  Calendar,
  BookOpen,
  ArrowRight,
  Trophy,
  LockKey,
  FileText,
} from "@phosphor-icons/react";
import { format, differenceInDays } from "date-fns";
import { id } from "date-fns/locale";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function SiswaUjianPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: authLoading } = useAuth();
  const [filterTab, setFilterTab] = useState<"all" | "selesai" | "belum">("all");
  const { data, error, isLoading } = useSWR('/api/siswa/ujian', fetcher);

  if (authLoading || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data ujian</p>
      </div>
    );
  }

  const allUjian = data?.data?.ujian || [];
  
  const ujian = allUjian.filter((u: any) => {
    if (filterTab === "selesai") return !!u.submission;
    if (filterTab === "belum") return !u.submission;
    return true;
  });

  const stats = {
    total: allUjian.length,
    selesai: allUjian.filter((u: any) => u.submission).length,
    belum: allUjian.filter((u: any) => !u.submission).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header dengan Navigasi Mobile */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Ujian</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Lihat dan kerjakan ujian dari guru
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

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="rounded-xl border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/60 backdrop-blur-sm">
                <Exam className="w-4 h-4 text-purple-600" weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/60 backdrop-blur-sm">
                <CheckCircle className="w-4 h-4 text-green-600" weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Selesai</p>
                <p className="text-2xl font-bold text-green-600">{stats.selesai}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-gradient-to-br from-orange-50 to-red-50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/60 backdrop-blur-sm">
                <Clock className="w-4 h-4 text-orange-600" weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Belum</p>
                <p className="text-2xl font-bold text-orange-600">{stats.belum}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filterTab} onValueChange={(value: any) => setFilterTab(value)} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm !text-black data-[state=active]:!text-foreground font-medium">Semua ({stats.total})</TabsTrigger>
          <TabsTrigger value="belum" className="text-xs sm:text-sm whitespace-nowrap !text-black data-[state=active]:!text-foreground font-medium">Belum ({stats.belum})</TabsTrigger>
          <TabsTrigger value="selesai" className="text-xs sm:text-sm whitespace-nowrap !text-black data-[state=active]:!text-foreground font-medium">Sudah ({stats.selesai})</TabsTrigger>
        </TabsList>

        <TabsContent value={filterTab} className="space-y-4">
          {ujian.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <Exam className="w-16 h-16 mx-auto text-muted-foreground mb-4" weight="duotone" />
                  <p className="text-muted-foreground">Belum ada ujian</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ujian.map((u: any, index: number) => {
                const hasSubmission = !!u.submission;
                const canStart = u.canStart;
                const examStatus = u.examStatus;
                
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
                  <Card 
                    key={u.id} 
                    className={`rounded-3xl border-0 bg-gradient-to-br ${gradients[index % gradients.length]} shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer`}
                    onClick={() => router.push(hasSubmission ? `/siswa/ujian/${u.id}/hasil` : `/siswa/ujian/${u.id}`)}
                  >
                    <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 sm:mb-3">
                            <div className="p-1.5 sm:p-2 rounded-xl bg-white/60 backdrop-blur-sm">
                              <Exam className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconColors[index % iconColors.length]}`} weight="duotone" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                              {u.mapel}
                            </span>
                          </div>
                          <h3 className="font-bold text-base sm:text-lg leading-tight line-clamp-2 mb-1">
                            {u.judul}
                          </h3>
                        </div>
                        {hasSubmission && (
                          <div className="p-1.5 sm:p-2 rounded-xl bg-white/60 backdrop-blur-sm flex-shrink-0">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" weight="fill" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" weight="duotone" />
                          <span className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
                            {format(new Date(u.startUjian), "dd MMM yyyy HH:mm", { locale: id })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" weight="duotone" />
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                              {Math.round((new Date(u.endUjian).getTime() - new Date(u.startUjian).getTime()) / 60000)} menit • {u.totalSoal} soal
                            </span>
                          </div>

                          {hasSubmission && u.submission.nilai !== null && (
                            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/60 backdrop-blur-sm flex-shrink-0">
                              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" weight="fill" />
                              <span className="font-bold text-sm sm:text-base">{u.submission.nilai}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 sm:pt-3 border-t gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${
                            examStatus === 'selesai' ? 'bg-green-500' : 
                            examStatus === 'berlangsung' ? 'bg-blue-500' : 
                            examStatus === 'berakhir' ? 'bg-red-500' : 
                            'bg-gray-400'
                          }`} />
                          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                            {examStatus === 'selesai' ? 'Selesai' : 
                             examStatus === 'berlangsung' ? 'Berlangsung' : 
                             examStatus === 'berakhir' ? 'Waktu habis' : 
                             'Belum dimulai'}
                          </span>
                          {!canStart && !hasSubmission && (
                            <LockKey className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 flex-shrink-0" weight="fill" />
                          )}
                        </div>

                        <Button 
                          size="sm" 
                          className={`rounded-xl ${iconColors[index % iconColors.length]} bg-white/60 hover:bg-white/80 backdrop-blur-sm border-0 shadow-none flex-shrink-0 h-8 sm:h-9 px-3 sm:px-4`}
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(hasSubmission ? `/siswa/ujian/${u.id}/hasil` : `/siswa/ujian/${u.id}`);
                          }}
                          disabled={!canStart && !hasSubmission}
                        >
                          <span className="text-[10px] sm:text-xs font-semibold">
                            {hasSubmission ? 'Lihat' : canStart ? 'Mulai' : 'Terkunci'}
                          </span>
                          <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 ml-1" weight="bold" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
