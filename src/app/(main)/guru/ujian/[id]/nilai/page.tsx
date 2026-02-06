"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DataTable } from "@/components/ui/data-table";
import { createNilaiColumns, NilaiSubmission } from "./columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Eye,
  Download,
  ArrowsClockwise,
  CircleNotch,
  ChartBar,
  Users,
  CheckCircle,
  XCircle,
  FileText,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function UjianNilaiPage() {
  const router = useRouter();
  const params = useParams();
  const { isLoading: authLoading } = useAuth();
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [essayGrades, setEssayGrades] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("nilai");
  const [gradeConfig, setGradeConfig] = useState({ bobotPG: 50, bobotEssay: 50 });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    params.id ? `/api/guru/ujian/${params.id}/nilai` : null,
    fetcher
  );

  // Load grading config from database
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/guru/settings/grade-config');
        const result = await response.json();
        
        if (result.success && result.data) {
          setGradeConfig({
            bobotPG: result.data.pilihanGanda?.weight || 50,
            bobotEssay: result.data.essay?.weight || 50,
          });
        }
      } catch (e) {
        console.error('Error loading grade config:', e);
      } finally {
        setConfigLoaded(true);
      }
    };
    
    loadConfig();
  }, []);

  if (authLoading || isLoading || !configLoaded) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data nilai ujian</p>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Data tidak ditemukan</p>
      </div>
    );
  }

  const ujian = data.data.ujian;
  const soalEssay = data.data.soalEssay || [];
  const submissions = data.data.submissions || [];

  const handleGrade = (submission: any) => {
    if (submission.status === 'belum') {
      toast.error("Siswa belum mengerjakan ujian");
      return;
    }

    setSelectedSubmission(submission);
    
    // Initialize essay grades from existing data
    const grades = soalEssay.map((soal: any) => {
      const existingJawaban = submission.jawabanEssay?.find(
        (j: any) => j.soalId === soal.id
      );
      return {
        id: existingJawaban?.id || null,
        soalId: soal.id,
        pertanyaan: soal.pertanyaan,
        kunciJawaban: soal.kunciJawaban,
        jawaban: existingJawaban?.jawaban || '',
        nilai: existingJawaban?.nilai || 0,
        feedback: existingJawaban?.feedback || '',
      };
    });
    
    setEssayGrades(grades);
    setIsGradingOpen(true);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // Dynamic import xlsx
      const XLSX = await import('xlsx');
      
      // Prepare data for Excel
      const excelData = submissions.map((s: any) => ({
        'Nama Siswa': s.siswa,
        'Kelas': ujian.kelas?.join(', ') || '-',
        'Mata Pelajaran': ujian.mapel,
        'Tanggal Submit': s.submittedAt ? format(new Date(s.submittedAt), "dd MMM yyyy HH:mm", { locale: id }) : '-',
        'Nilai PG': s.nilaiPG ?? '-',
        'Nilai Essay': s.nilaiEssay ?? '-',
        'Nilai Total': s.nilaiTotal ?? '-',
        'Status': s.status === 'completed' ? 'Sudah' : s.status === 'pending' ? 'Pending' : 'Belum',
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, // Nama Siswa
        { wch: 15 }, // Kelas
        { wch: 20 }, // Mata Pelajaran
        { wch: 20 }, // Tanggal Submit
        { wch: 12 }, // Nilai PG
        { wch: 12 }, // Nilai Essay
        { wch: 12 }, // Nilai Total
        { wch: 12 }, // Status
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Nilai Siswa');

      // Generate filename
      const filename = `Nilai_${ujian.judul.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      toast.success('File Excel berhasil diunduh');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Gagal mengekspor ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRecalculateScores = async () => {
    setIsRecalculating(true);
    try {
      const response = await fetch(`/api/guru/ujian/${params.id}/nilai/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bobotPG: gradeConfig.bobotPG,
          bobotEssay: gradeConfig.bobotEssay,
        }),
      });

      const result = await response.json();

      if (result.success) {
        await mutate();
        toast.success(`Berhasil menghitung ulang ${result.updated} nilai`);
      } else {
        toast.error(result.error || "Gagal menghitung ulang nilai");
      }
    } catch (error) {
      console.error('Error recalculating scores:', error);
      toast.error("Terjadi kesalahan saat menghitung ulang nilai");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSubmitGrades = async () => {
    if (!selectedSubmission?.id) {
      toast.error("Data submission tidak valid");
      return;
    }

    try {
      const response = await fetch(`/api/guru/ujian/${params.id}/nilai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          jawabanEssay: essayGrades.map(g => ({
            id: g.id,
            nilai: g.nilai,
            feedback: g.feedback,
          })),
          bobotPG: gradeConfig.bobotPG,
          bobotEssay: gradeConfig.bobotEssay,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        await mutate();
        toast.success("Nilai essay berhasil disimpan");
        setIsGradingOpen(false);
        setSelectedSubmission(null);
      } else {
        toast.error(result.error || "Gagal menyimpan nilai");
      }
    } catch (error) {
      console.error('Error saving grades:', error);
      toast.error("Terjadi kesalahan saat menyimpan nilai");
    }
  };

  const stats = {
    sudahMengerjakan: submissions.filter((s: any) => s.status === 'sudah').length,
    belumMengerjakan: submissions.filter((s: any) => s.status === 'belum').length,
  };

  const handleExportJawaban = () => {
    try {
      // Get soal data
      const soalPG = data?.data?.soalPG || [];
      const soalEssayData = data?.data?.soalEssay || [];
      
      // Prepare data for CSV
      const exportData = submissions.map((s: any, idx: number) => {
        const row: any = {
          'No': idx + 1,
          'Nama Siswa': s.siswa,
          'Kelas': ujian.kelas?.join(', ') || '-',
        };
        
        // Add PG answers
        soalPG.forEach((soal: any, i: number) => {
          const jawaban = s.jawabanPG?.find((j: any) => j.soalId === soal.id);
          row[`PG${i + 1}`] = jawaban?.jawaban || '-';
        });
        
        // Add Essay answers
        soalEssayData.forEach((soal: any, i: number) => {
          const jawaban = s.jawabanEssay?.find((j: any) => j.soalId === soal.id);
          row[`Essay${i + 1}`] = jawaban?.jawaban || '-';
        });
        
        return row;
      });
      
      // Convert to CSV
      const headers = Object.keys(exportData[0] || {});
      const csv = [
        headers.join(','),
        ...exportData.map((row: any) => 
          headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');
      
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Jawaban_${ujian.judul.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      link.click();
      
      toast.success('File CSV berhasil diunduh');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Gagal mengekspor ke CSV');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/guru/ujian")}
          className="hover:bg-gray-100 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" weight="bold" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 truncate">{ujian.judul}</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">
            {ujian.kelas.join(", ")} • {ujian.mapel} • {
              ujian.startUjian ? (() => {
                try {
                  const date = new Date(ujian.startUjian);
                  if (!isNaN(date.getTime())) {
                    return format(date, "dd MMMM yyyy", { locale: id });
                  }
                  return "-";
                } catch (error) {
                  return "-";
                }
              })() : "-"
            }
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-blue-100">Total Soal</p>
                <p className="text-2xl md:text-3xl font-bold text-white mt-1 md:mt-2">{ujian.totalSoalPG + ujian.totalSoalEssay}</p>
                <p className="text-xs text-blue-100 mt-1 hidden md:block">PG: {ujian.totalSoalPG} ({gradeConfig.bobotPG}%) • Essay: {ujian.totalSoalEssay} ({gradeConfig.bobotEssay}%)</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg hidden md:block">
                <FileText className="w-6 h-6 text-white" weight="duotone" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-green-100">Sudah</p>
                <p className="text-2xl md:text-3xl font-bold text-white mt-1 md:mt-2">{stats.sudahMengerjakan}</p>
                <p className="text-xs text-green-100 mt-1">Siswa</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg hidden md:block">
                <CheckCircle className="w-6 h-6 text-white" weight="duotone" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-orange-100">Belum</p>
                <p className="text-2xl md:text-3xl font-bold text-white mt-1 md:mt-2">{stats.belumMengerjakan}</p>
                <p className="text-xs text-orange-100 mt-1">Siswa</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg hidden md:block">
                <XCircle className="w-6 h-6 text-white" weight="duotone" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-purple-100">Rata-rata</p>
                <p className="text-2xl md:text-3xl font-bold text-white mt-1 md:mt-2">
                  {submissions.filter((s: any) => s.nilaiTotal).length > 0
                    ? Math.round(
                        submissions
                          .filter((s: any) => s.nilaiTotal)
                          .reduce((sum: number, s: any) => sum + s.nilaiTotal, 0) /
                          submissions.filter((s: any) => s.nilaiTotal).length
                      )
                    : '-'}
                </p>
                <p className="text-xs text-purple-100 mt-1 hidden md:block">Dari {submissions.filter((s: any) => s.nilaiTotal).length} siswa</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg hidden md:block">
                <ChartBar className="w-6 h-6 text-white" weight="duotone" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="nilai">Daftar Nilai</TabsTrigger>
          <TabsTrigger value="jawaban">Jawaban Siswa</TabsTrigger>
        </TabsList>

        <TabsContent value="nilai">
          <Card className="border border-gray-300/30 shadow-lg">
            <CardHeader className="border-b border-gray-300/30">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" weight="duotone" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg md:text-xl truncate">Daftar Nilai Siswa</CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{submissions.length} siswa terdaftar</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    disabled={isExporting}
                    className="gap-1 md:gap-2 bg-white hover:bg-gray-50 border-gray-300 text-xs md:text-sm flex-1 md:flex-initial"
                  >
                    {isExporting ? (
                      <>
                        <CircleNotch className="w-4 h-4 animate-spin" />
                        Mengekspor...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Export Excel
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRecalculateScores}
                    disabled={isRecalculating}
                    className="gap-1 md:gap-2 bg-white hover:bg-gray-50 border-gray-300 text-xs md:text-sm flex-1 md:flex-initial"
                  >
                    {isRecalculating ? (
                      <>
                        <CircleNotch className="w-4 h-4 animate-spin" />
                        Menghitung ulang...
                      </>
                    ) : (
                      <>
                        <ArrowsClockwise className="w-4 h-4" />
                        Refresh Nilai
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <DataTable
                columns={createNilaiColumns(handleGrade)}
                data={submissions as NilaiSubmission[]}
                searchKey="siswa"
                searchPlaceholder="Cari nama siswa..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jawaban">
          <Card className="border border-gray-300/30 shadow-lg">
            <CardHeader className="border-b border-gray-300/30">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 md:w-5 md:h-5 text-purple-600" weight="duotone" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg md:text-xl truncate">Jawaban Semua Siswa</CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Detail jawaban untuk {submissions.length} siswa</p>
                  </div>
                </div>
                <Button onClick={handleExportJawaban} variant="outline" size="sm" className="gap-1 md:gap-2 bg-white hover:bg-gray-50 border-gray-300 text-xs md:text-sm w-full md:w-auto">
                  <Download className="w-4 h-4" weight="bold" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead className="min-w-[150px]">Nama Siswa</TableHead>
                      {Array.from({ length: ujian.totalSoalPG }, (_, i) => (
                        <TableHead key={`pg-${i}`} className="text-center w-16">PG{i + 1}</TableHead>
                      ))}
                      {Array.from({ length: ujian.totalSoalEssay }, (_, i) => (
                        <TableHead key={`essay-${i}`} className="text-center min-w-[200px]">Essay{i + 1}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-yellow-50">
                      <TableCell className="font-semibold">Kunci</TableCell>
                      <TableCell className="font-semibold">-</TableCell>
                      {data.data.soalPG?.map((soal: any) => (
                        <TableCell key={soal.id} className="text-center font-semibold text-green-700">
                          {soal.jawabanBenar}
                        </TableCell>
                      ))}
                      {soalEssay.map((soal: any) => (
                        <TableCell key={soal.id} className="text-xs text-green-700">
                          {soal.kunciJawaban?.substring(0, 50)}{soal.kunciJawaban?.length > 50 ? '...' : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                    {submissions.map((s: any, idx: number) => (
                      <TableRow key={s.siswaId}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{s.siswa}</TableCell>
                        {data.data.soalPG?.map((soal: any, i: number) => {
                          const jawaban = s.jawabanPG?.find((j: any) => j.soalId === soal.id);
                          const isCorrect = jawaban?.isCorrect;
                          return (
                            <TableCell 
                              key={`pg-${i}`} 
                              className={`text-center ${
                                isCorrect ? 'bg-green-50 text-green-700 font-semibold' : 
                                jawaban ? 'bg-red-50 text-red-700' : ''
                              }`}
                            >
                              {jawaban?.jawaban || '-'}
                            </TableCell>
                          );
                        })}
                        {data.data.soalEssay?.map((soal: any, i: number) => {
                          const jawaban = s.jawabanEssay?.find((j: any) => j.soalId === soal.id);
                          return (
                            <TableCell key={`essay-${i}`} className="text-xs">
                              {jawaban?.jawaban ? (
                                jawaban.jawaban.startsWith('http://') || jawaban.jawaban.startsWith('https://') ? (
                                  <div className="max-w-[200px]">
                                    <img
                                      src={jawaban.jawaban}
                                      alt="Jawaban"
                                      className="max-w-full h-auto rounded border border-gray-300"
                                      style={{ maxHeight: '100px' }}
                                    />
                                  </div>
                                ) : (
                                  <div className="max-w-[200px] truncate" title={jawaban.jawaban}>
                                    {jawaban.jawaban}
                                  </div>
                                )
                              ) : '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isGradingOpen} onOpenChange={setIsGradingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Penilaian Essay - {selectedSubmission?.siswa}</DialogTitle>
            <DialogDescription>
              Berikan nilai dan feedback untuk setiap jawaban essay
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {essayGrades.map((grade, index) => (
              <div key={grade.soalId} className="p-4 border rounded-lg space-y-3">
                <div>
                  <p className="font-semibold text-sm mb-2">Soal {index + 1}:</p>
                  <p className="text-sm">{grade.pertanyaan}</p>
                </div>

                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-xs font-semibold text-green-700 mb-1">Kunci Jawaban:</p>
                  <p className="text-sm text-green-900 whitespace-pre-wrap">{grade.kunciJawaban}</p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Jawaban Siswa:</p>
                  {grade.jawaban && (grade.jawaban.startsWith('http://') || grade.jawaban.startsWith('https://')) ? (
                    <div className="space-y-2">
                      <img
                        src={grade.jawaban}
                        alt="Jawaban essay siswa"
                        className="max-w-full h-auto rounded-lg border border-blue-300 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const fallback = document.createElement('p');
                          fallback.className = 'text-sm text-red-600';
                          fallback.textContent = 'Gagal memuat gambar';
                          (e.target as HTMLImageElement).parentElement?.appendChild(fallback);
                        }}
                      />
                      <a
                        href={grade.jawaban}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        Buka gambar di tab baru
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{grade.jawaban || '(Tidak ada jawaban)'}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`nilai-${index}`}>Nilai (0-100)</Label>
                    <Input
                      id={`nilai-${index}`}
                      type="number"
                      min="0"
                      max="100"
                      value={grade.nilai}
                      onChange={(e) => {
                        const newGrades = [...essayGrades];
                        newGrades[index].nilai = parseInt(e.target.value) || 0;
                        setEssayGrades(newGrades);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`feedback-${index}`}>Feedback</Label>
                  <Textarea
                    id={`feedback-${index}`}
                    placeholder="Berikan feedback untuk siswa..."
                    value={grade.feedback}
                    onChange={(e) => {
                      const newGrades = [...essayGrades];
                      newGrades[index].feedback = e.target.value;
                      setEssayGrades(newGrades);
                    }}
                    rows={3}
                  />
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsGradingOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmitGrades}>
                Simpan Nilai
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
