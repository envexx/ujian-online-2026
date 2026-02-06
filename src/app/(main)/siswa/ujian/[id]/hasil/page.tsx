"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MathRenderer } from "@/components/ui/math-renderer";
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Trophy,
  Clock,
  Calendar,
  FileText,
  ChartBar,
  Check,
  X,
  BookOpen,
  GraduationCap,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function SiswaUjianHasilPage() {
  const router = useRouter();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [resultData, setResultData] = useState<any>(null);

  useEffect(() => {
    if (params.id) {
      fetchResult();
    }
  }, [params.id]);

  const fetchResult = async () => {
    try {
      const response = await fetch(`/api/siswa/ujian/${params.id}/hasil`);
      const result = await response.json();
      
      if (result.success) {
        setResultData(result.data);
      } else {
        toast.error(result.error || "Gagal memuat hasil ujian");
        router.push('/siswa/ujian');
      }
    } catch (error) {
      console.error('Error fetching result:', error);
      toast.error("Terjadi kesalahan");
      router.push('/siswa/ujian');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!resultData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Hasil ujian tidak ditemukan</p>
      </div>
    );
  }

  const { ujian, submission, soalPG, soalEssay, answers } = resultData;
  const hasScore = submission.nilai !== null;
  const isPending = submission.status === 'pending';
  
  // Calculate statistics
  let correctPG = 0;
  let wrongPG = 0;
  let unansweredPG = 0;
  
  soalPG.forEach((soal: any) => {
    const userAnswer = answers[soal.id];
    if (!userAnswer) {
      unansweredPG++;
    } else if (userAnswer === soal.jawabanBenar) {
      correctPG++;
    } else {
      wrongPG++;
    }
  });

  const totalPG = soalPG.length;
  const totalEssay = soalEssay.length;
  const totalSoal = totalPG + totalEssay;
  
  // Calculate duration
  const startTime = new Date(ujian.startUjian);
  const endTime = new Date(ujian.endUjian);
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  
  // Calculate time spent (if available)
  // Validate dates before using them
  let submittedAt: Date | null = null;
  let startedAt: Date | null = null;
  
  if (submission.submittedAt) {
    const date = new Date(submission.submittedAt);
    if (!isNaN(date.getTime())) {
      submittedAt = date;
    }
  }
  
  if (submission.startedAt) {
    const date = new Date(submission.startedAt);
    if (!isNaN(date.getTime())) {
      startedAt = date;
    }
  }
  
  let timeSpentMinutes: number | null = null;
  if (submittedAt && startedAt) {
    const diff = submittedAt.getTime() - startedAt.getTime();
    if (diff > 0 && diff < 86400000) { // Less than 24 hours (sanity check)
      timeSpentMinutes = Math.round(diff / 60000);
    }
  }
  
  // Validate submittedAt for display
  const isValidSubmittedAt = submittedAt !== null;

  // Score percentage
  const scorePercentage = hasScore ? submission.nilai : 0;
  const isPassed = hasScore && submission.nilai >= 75;

  return (
    <div className="space-y-6 sm:space-y-8 pb-8 pt-4 sm:pt-6">
      {/* Header */}
      <div className="flex items-center gap-4 px-2 sm:px-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/siswa/ujian")}
          className="hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" weight="bold" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Hasil Ujian</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{ujian.judul}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{ujian.mapel}</p>
        </div>
      </div>

      {/* Score Card - Enhanced */}
      <Card className={cn(
        "rounded-2xl border-0 shadow-xl overflow-hidden mx-2 sm:mx-0",
        hasScore && isPassed 
          ? "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20"
          : hasScore && !isPassed
          ? "bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/20 dark:via-amber-950/20 dark:to-yellow-950/20"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20"
      )}>
        <CardContent className="p-4 sm:p-6 md:p-8">
          <div className="text-center space-y-4 sm:space-y-6">
            {hasScore ? (
              <>
                {/* Icon */}
                <div className={cn(
                  "inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full mb-2 sm:mb-4 transition-all",
                  isPassed
                    ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30"
                    : "bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30"
                )}>
                  {isPassed ? (
                    <Trophy className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white" weight="fill" />
                  ) : (
                    <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white" weight="fill" />
                  )}
                </div>

                {/* Score */}
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 uppercase tracking-wide">
                    Nilai Anda
                  </p>
                  <div className="flex items-baseline justify-center gap-1 sm:gap-2">
                    <p className={cn(
                      "text-5xl sm:text-6xl md:text-7xl font-extrabold bg-clip-text text-transparent leading-none",
                      isPassed
                        ? "bg-gradient-to-r from-green-600 to-emerald-600"
                        : "bg-gradient-to-r from-orange-600 to-amber-600"
                    )}>
                      {submission.nilai}
                    </p>
                    <span className="text-xl sm:text-2xl md:text-3xl font-bold text-muted-foreground">
                      /100
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="max-w-md mx-auto">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out",
                        isPassed
                          ? "bg-gradient-to-r from-green-500 to-emerald-500"
                          : "bg-gradient-to-r from-orange-500 to-amber-500"
                      )}
                      style={{ width: `${scorePercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {scorePercentage}% dari total nilai
                  </p>
                </div>

                {/* Status Badge */}
                <Badge 
                  variant={isPassed ? "default" : "destructive"}
                  className={cn(
                    "text-xs sm:text-sm px-4 sm:px-6 py-1.5 sm:py-2 font-semibold",
                    isPassed
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  )}
                >
                  {isPassed ? (
                    <span className="flex items-center gap-1.5 sm:gap-2">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" weight="fill" />
                      Lulus
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 sm:gap-2">
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" weight="fill" />
                      Tidak Lulus
                    </span>
                  )}
                </Badge>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 shadow-lg shadow-orange-500/30 mb-2 sm:mb-4">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white" weight="fill" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Menunggu Penilaian</p>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto px-2">
                    Ujian Anda sedang dikoreksi oleh guru. Nilai akan tersedia setelah koreksi selesai.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards - Enhanced */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 px-2 sm:px-0">
        <Card className="border-2 hover:border-blue-500 transition-colors">
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="text-center space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-1 sm:mb-2">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" weight="duotone" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Tanggal</p>
              {isValidSubmittedAt ? (
                <>
                  <p className="font-bold text-sm sm:text-base leading-tight">
                    {format(submittedAt!, "dd MMM yyyy", { locale: id })}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {format(submittedAt!, "HH:mm", { locale: id })} WIB
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-sm sm:text-base leading-tight text-muted-foreground">
                    -
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Tidak tersedia
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-orange-500 transition-colors">
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="text-center space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-1 sm:mb-2">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" weight="duotone" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {timeSpentMinutes !== null ? "Waktu Pengerjaan" : "Durasi Ujian"}
              </p>
              <p className="font-bold text-sm sm:text-base leading-tight">
                {timeSpentMinutes !== null && timeSpentMinutes > 0 
                  ? `${timeSpentMinutes} menit` 
                  : `${durationMinutes} menit`}
              </p>
              {timeSpentMinutes !== null && timeSpentMinutes > 0 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  dari {durationMinutes} menit
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-purple-500 transition-colors">
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="text-center space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-1 sm:mb-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" weight="duotone" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Soal</p>
              <p className="font-bold text-sm sm:text-base leading-tight">{totalSoal} soal</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {totalPG} PG + {totalEssay} Essay
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-green-500 transition-colors">
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="text-center space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-1 sm:mb-2">
                <ChartBar className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" weight="duotone" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <p className="font-bold text-sm sm:text-base leading-tight">
                {isPending ? "Pending" : "Selesai"}
              </p>
              {hasScore && (
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {correctPG}/{totalPG} benar
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PG Statistics - Only show if has score */}
      {hasScore && totalPG > 0 && (
        <Card className="rounded-2xl border-0 shadow-lg mx-2 sm:mx-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" weight="duotone" />
              Statistik Pilihan Ganda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="text-center p-3 sm:p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-800">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-green-600" weight="fill" />
                <p className="text-xl sm:text-2xl font-bold text-green-600">{correctPG}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Benar</p>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800">
                <XCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-red-600" weight="fill" />
                <p className="text-xl sm:text-2xl font-bold text-red-600">{wrongPG}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Salah</p>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border-2 border-gray-200 dark:border-gray-800">
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-gray-600" weight="duotone" />
                <p className="text-xl sm:text-2xl font-bold text-gray-600">{unansweredPG}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Tidak Dijawab</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Akurasi</span>
                <span className="font-semibold">
                  {totalPG > 0 ? Math.round((correctPG / totalPG) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${totalPG > 0 ? (correctPG / totalPG) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Answers Review - Enhanced */}
      {soalPG.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-lg mx-2 sm:mx-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" weight="duotone" />
              Review Jawaban Pilihan Ganda
            </CardTitle>
            {hasScore && (
              <p className="text-sm text-muted-foreground">
                {correctPG} benar dari {totalPG} soal
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {soalPG.map((soal: any, index: number) => {
              const userAnswer = answers[soal.id];
              const isCorrect = userAnswer === soal.jawabanBenar;
              const isAnswered = !!userAnswer;
              
              return (
                <div 
                  key={soal.id} 
                  className={cn(
                    "p-3 sm:p-4 md:p-5 rounded-xl border-2 transition-all hover:shadow-md",
                    isCorrect
                      ? "bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-800"
                      : isAnswered
                      ? "bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-800"
                      : "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800"
                  )}
                >
                  <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                    {/* Question Number */}
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full font-bold flex items-center justify-center text-xs sm:text-sm",
                      isCorrect
                        ? "bg-green-500 text-white"
                        : isAnswered
                        ? "bg-red-500 text-white"
                        : "bg-gray-400 text-white"
                    )}>
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                      {/* Question */}
                      <div>
                        <MathRenderer content={soal.pertanyaan || ""} className="font-medium text-sm sm:text-base" />
                      </div>
                      
                      {/* Options */}
                      <div className="space-y-1.5 sm:space-y-2">
                        {['A', 'B', 'C', 'D'].map((option) => {
                          const isUserAnswer = userAnswer === option;
                          const isCorrectAnswer = soal.jawabanBenar === option;
                          
                          return (
                            <div 
                              key={option}
                              className={cn(
                                "p-2 sm:p-3 rounded-lg border-2 transition-all",
                                isCorrectAnswer 
                                  ? 'border-green-500 bg-green-50 dark:bg-green-950/20 shadow-sm' 
                                  : isUserAnswer 
                                  ? 'border-red-500 bg-red-50 dark:bg-red-950/20 shadow-sm' 
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                  <span className={cn(
                                    "font-bold text-xs sm:text-sm w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0",
                                    isCorrectAnswer
                                      ? "bg-green-500 text-white"
                                      : isUserAnswer
                                      ? "bg-red-500 text-white"
                                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  )}>
                                    {option}
                                  </span>
                                  <MathRenderer content={soal[`opsi${option}`] || ""} className="flex-1 text-sm sm:text-base" />
                                </div>
                                <div className="flex-shrink-0">
                                  {isCorrectAnswer && (
                                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white border-0 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                                      <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" weight="bold" />
                                      <span className="hidden sm:inline">Benar</span>
                                    </Badge>
                                  )}
                                  {isUserAnswer && !isCorrectAnswer && (
                                    <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                                      <X className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" weight="bold" />
                                      <span className="hidden sm:inline">Jawaban Anda</span>
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Essay Answers - Enhanced */}
      {soalEssay.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-lg mx-2 sm:mx-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" weight="duotone" />
              Jawaban Essay
            </CardTitle>
            {isPending && (
              <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Clock className="w-4 h-4" weight="duotone" />
                Menunggu penilaian dari guru
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {soalEssay.map((soal: any, index: number) => {
              const userAnswer = answers[soal.id];
              
              return (
                <div key={soal.id} className="p-3 sm:p-4 md:p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 hover:shadow-md transition-all">
                  <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                    <span className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center text-xs sm:text-sm">
                      {soalPG.length + index + 1}
                    </span>
                    <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                      <div>
                        <MathRenderer content={soal.pertanyaan || ""} className="font-medium text-sm sm:text-base" />
                      </div>
                      <div className={cn(
                        "p-3 sm:p-4 rounded-lg border-2",
                        userAnswer
                          ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                          : "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700"
                      )}>
                        <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-1 sm:mb-2 uppercase tracking-wide">
                          Jawaban Anda:
                        </p>
                        {userAnswer && (userAnswer.startsWith('http://') || userAnswer.startsWith('https://')) ? (
                          <div className="space-y-2">
                            <img
                              src={userAnswer}
                              alt="Jawaban essay"
                              className="max-w-full h-auto rounded-lg border border-gray-300 shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = document.createElement('p');
                                fallback.className = 'text-xs sm:text-sm text-red-600';
                                fallback.textContent = 'Gagal memuat gambar';
                                (e.target as HTMLImageElement).parentElement?.appendChild(fallback);
                              }}
                            />
                            <a
                              href={userAnswer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              Buka gambar di tab baru
                            </a>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">
                            {userAnswer || (
                              <span className="text-muted-foreground italic">Tidak dijawab</span>
                            )}
                          </p>
                        )}
                      </div>
                      {isPending && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" weight="duotone" />
                          Menunggu penilaian dari guru
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <div className="flex justify-center pt-4 px-2 sm:px-0">
        <Button
          onClick={() => router.push('/siswa/ujian')}
          size="lg"
          className="w-full sm:w-auto px-6 sm:px-8 py-5 sm:py-6 text-sm sm:text-base font-semibold"
          variant="default"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" weight="bold" />
          Kembali ke Daftar Ujian
        </Button>
      </div>
    </div>
  );
}
