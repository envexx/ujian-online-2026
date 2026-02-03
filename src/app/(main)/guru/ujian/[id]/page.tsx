"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MathRenderer } from "@/components/ui/math-renderer";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, FileText, ListChecks, Article } from "@phosphor-icons/react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function UjianDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isLoading: authLoading } = useAuth();

  const { data, error, isLoading } = useSWR(
    params.id ? `/api/guru/ujian/${params.id}` : null,
    fetcher
  );

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

  if (!data?.data) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Ujian tidak ditemukan</p>
      </div>
    );
  }

  const ujian = data.data.ujian;
  const soalPG = data.data.soalPG || [];
  const soalEssay = data.data.soalEssay || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/guru/ujian")}
        >
          <ArrowLeft className="w-5 h-5" weight="bold" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{ujian.judul}</h1>
          <p className="text-muted-foreground">
            {ujian.kelas.join(", ")} • {ujian.mapel} • {format(new Date(ujian.startUjian), "dd MMMM yyyy HH:mm", { locale: id })} - {format(new Date(ujian.endUjian), "dd MMMM yyyy HH:mm", { locale: id })} • {Math.round((new Date(ujian.endUjian).getTime() - new Date(ujian.startUjian).getTime()) / 60000)} menit
          </p>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-[#165DFB] to-[#0d4fc7] border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl text-white">Informasi Ujian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-blue-50 mb-2">Deskripsi</p>
            {ujian.deskripsi ? (
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <MathRenderer content={ujian.deskripsi} className="text-sm leading-relaxed text-white" />
              </div>
            ) : (
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <p className="text-sm text-blue-50">Tidak ada deskripsi</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/20">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-sm font-semibold text-blue-50 mb-2">Status</p>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                ujian.status === "aktif" ? "bg-green-100 text-green-700 border border-green-200" :
                ujian.status === "draft" ? "bg-orange-100 text-orange-700 border border-orange-200" :
                "bg-gray-100 text-gray-700 border border-gray-200"
              }`}>
                {ujian.status === "aktif" ? "Aktif" : ujian.status === "draft" ? "Draft" : "Selesai"}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-sm font-semibold text-blue-50 mb-2">Total Soal</p>
              <p className="text-2xl font-bold text-white">{soalPG.length + soalEssay.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-sm font-semibold text-blue-50 mb-2">Acak Soal</p>
              <p className="text-lg font-medium text-white">{ujian.shuffleQuestions ? "Ya" : "Tidak"}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-sm font-semibold text-blue-50 mb-2">Tampilkan Nilai</p>
              <p className="text-lg font-medium text-white">{ujian.showScore ? "Ya" : "Tidak"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {soalPG.length > 0 && (
        <Card className="bg-white border shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-gray-700" weight="duotone" />
              <CardTitle className="text-gray-900">Soal Pilihan Ganda ({soalPG.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {soalPG.map((soal: any) => (
              <div key={soal.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold text-sm border border-gray-300">
                    {soal.nomor}
                  </span>
                  <div className="flex-1">
                    <MathRenderer content={soal.pertanyaan || ""} className="font-medium text-gray-900" />
                  </div>
                </div>
                <div className="ml-11 space-y-2">
                  {['A', 'B', 'C', 'D'].map((option, idx) => (
                    <div 
                      key={option} 
                      className={`p-3 rounded-lg border flex items-start gap-2 ${
                        soal.kunciJawaban === option 
                          ? 'bg-green-50 border-green-300' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <span className={`font-medium text-sm flex-shrink-0 ${
                        soal.kunciJawaban === option ? 'text-green-700' : 'text-gray-700'
                      }`}>{option}.</span>
                      <div className="flex-1 flex items-center gap-2">
                        <MathRenderer content={soal[`opsi${option}`] || ""} className={`text-sm ${
                          soal.kunciJawaban === option ? 'text-gray-900' : 'text-gray-700'
                        }`} />
                        {soal.kunciJawaban === option && (
                          <span className="text-xs text-green-600 font-semibold whitespace-nowrap">(Kunci Jawaban)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {soalEssay.length > 0 && (
        <Card className="bg-white border shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Article className="w-5 h-5 text-gray-700" weight="duotone" />
              <CardTitle className="text-gray-900">Soal Essay ({soalEssay.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {soalEssay.map((soal: any) => (
              <div key={soal.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold text-sm border border-gray-300">
                    {soal.nomor}
                  </span>
                  <div className="flex-1">
                    <MathRenderer content={soal.pertanyaan || ""} className="font-medium text-gray-900" />
                  </div>
                </div>
                <div className="ml-11 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-xs font-semibold text-green-700 mb-1">Kunci Jawaban:</p>
                  <MathRenderer content={soal.kunciJawaban || ""} className="text-sm text-green-900" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
