"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter, useParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditorWithToolbar } from "@/components/tiptap";
import { prepareContentForTipTap } from "@/components/tiptap/utils/convertMathDelimiters";
import { TimePickerIndonesia } from "@/components/ui/time-picker-indonesia";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  ArrowLeft, 
  Plus, 
  Trash, 
  FileText, 
  ListChecks, 
  Article,
  Upload,
  Download,
  Shuffle,
  Eye,
  EyeClosed,
} from "@phosphor-icons/react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { parseWordFile } from "@/lib/wordParser";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MultipleChoiceQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string; // 'A', 'B', 'C', or 'D'
}

interface EssayQuestion {
  id: string;
  question: string;
  answerKey: string;
}

interface ExamInfo {
  judul: string;
  deskripsi: string;
  kelas: string[];
  mapelId: string;
  startUjian: Date;
  endUjian: Date;
  shuffleQuestions: boolean;
  showScore: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function EditUjianPage() {
  const router = useRouter();
  const params = useParams();
  const { isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("info");
  const [importSource, setImportSource] = useState<"pdf" | "word">("pdf");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  
  const [examInfo, setExamInfo] = useState<ExamInfo>({
    judul: "",
    deskripsi: "",
    kelas: [],
    mapelId: "",
    startUjian: new Date(),
    endUjian: new Date(Date.now() + 90 * 60000), // Default 90 menit dari sekarang
    shuffleQuestions: false,
    showScore: true,
  });

  const [multipleChoice, setMultipleChoice] = useState<MultipleChoiceQuestion[]>([]);
  const [essay, setEssay] = useState<EssayQuestion[]>([]);

  // Fetch ujian list for kelas and mapel dropdown
  const { data: ujianListData, error: ujianListError, isLoading: ujianListLoading } = useSWR('/api/guru/ujian?status=all', fetcher);
  
  // Fetch ujian detail using SWR
  const { data: ujianDetailData, error: ujianDetailError, isLoading: ujianDetailLoading } = useSWR(
    params.id ? `/api/guru/ujian/${params.id}` : null,
    fetcher
  );

  // Populate form when ujian detail data is loaded
  useEffect(() => {
    if (ujianDetailData?.success && ujianDetailData.data) {
      const ujianData = ujianDetailData.data;
      const ujian = ujianData.ujian;
      const soalPG = ujianData.soalPG || [];
      const soalEssay = ujianData.soalEssay || [];
      
      // Populate exam info
      setExamInfo({
        judul: ujian.judul || "",
        deskripsi: ujian.deskripsi || "",
        kelas: ujian.kelas || [],
        mapelId: ujian.mapelId || "",
        startUjian: new Date(ujian.startUjian),
        endUjian: new Date(ujian.endUjian),
        shuffleQuestions: ujian.shuffleQuestions || false,
        showScore: ujian.showScore !== undefined ? ujian.showScore : true,
      });
      
      // Populate multiple choice questions
      const mcQuestions: MultipleChoiceQuestion[] = soalPG.map((soal: any, idx: number) => ({
        id: soal.id || `pg-${idx}`,
        question: soal.pertanyaan || "",
        options: [
          soal.opsiA || "",
          soal.opsiB || "",
          soal.opsiC || "",
          soal.opsiD || "",
        ],
        correctAnswer: (soal.kunciJawaban && ['A', 'B', 'C', 'D'].includes(soal.kunciJawaban.toUpperCase())) 
          ? soal.kunciJawaban.toUpperCase() 
          : 'A',
      }));
      setMultipleChoice(mcQuestions.length > 0 ? mcQuestions : [{
        id: "1",
        question: "",
        options: ["", "", "", ""],
        correctAnswer: "A",
      }]);
      
      // Populate essay questions
      const essayQuestions: EssayQuestion[] = soalEssay.map((soal: any, idx: number) => ({
        id: soal.id || `essay-${idx}`,
        question: soal.pertanyaan || "",
        answerKey: soal.kunciJawaban || "",
      }));
      setEssay(essayQuestions.length > 0 ? essayQuestions : [{
        id: "1",
        question: "",
        answerKey: "",
      }]);
      
      setIsLoadingData(false);
    } else if (ujianDetailError || (ujianDetailData && !ujianDetailData.success)) {
      toast.error(ujianDetailData?.error || "Gagal memuat data ujian");
      router.push('/guru/ujian');
      setIsLoadingData(false);
    }
  }, [ujianDetailData, ujianDetailError, router]);

  // Early returns after all hooks are called
  if (authLoading || ujianListLoading || ujianDetailLoading || isLoadingData) {
    return <LoadingSpinner />;
  }

  if (ujianListError || ujianDetailError) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data</p>
      </div>
    );
  }

  const kelasList = ujianListData?.data?.kelasList || [];
  const mapelList = ujianListData?.data?.mapelList || [];

  const handleAddMultipleChoice = () => {
    setMultipleChoice([
      ...multipleChoice,
      {
        id: Date.now().toString(),
        question: "",
        options: ["", "", "", ""],
        correctAnswer: "A",
      },
    ]);
  };

  const handleRemoveMultipleChoice = (id: string) => {
    setMultipleChoice(multipleChoice.filter((q) => q.id !== id));
  };

  const handleAddEssay = () => {
    setEssay([
      ...essay,
      {
        id: Date.now().toString(),
        question: "",
        answerKey: "",
      },
    ]);
  };

  const handleRemoveEssay = (id: string) => {
    setEssay(essay.filter((q) => q.id !== id));
  };

  const handleImportPDF = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validasi format file - hanya PDF yang didukung
    const ext = file.name.toLowerCase().split('.').pop();
    
    if (ext !== 'pdf') {
      toast.error('Format file tidak didukung. Hanya file .pdf yang didukung.');
      return;
    }

    try {
      toast.loading("Memproses file dengan AI Claude...");
      const parsed = await parseWordFile(file);
      
      // Convert parsed data to our format dan filter soal yang kosong
      const newMultipleChoice = parsed.soalPG
        .map((soal, idx) => ({
          id: `imported-pg-${Date.now()}-${idx}`,
          question: prepareContentForTipTap(soal.pertanyaan || ""),
          options: [
            prepareContentForTipTap(soal.opsiA || ""),
            prepareContentForTipTap(soal.opsiB || ""),
            prepareContentForTipTap(soal.opsiC || ""),
            prepareContentForTipTap(soal.opsiD || ""),
          ],
          correctAnswer: (soal.kunciJawaban && ['A', 'B', 'C', 'D'].includes(soal.kunciJawaban.toUpperCase())) 
            ? soal.kunciJawaban.toUpperCase() 
            : 'A',
        }))
        // Filter soal yang kosong: pertanyaan kosong atau semua opsi kosong
        .filter((soal) => {
          const hasQuestion = soal.question && soal.question.replace(/<[^>]*>/g, '').trim().length > 0;
          const hasOptions = soal.options.some(opt => opt && opt.replace(/<[^>]*>/g, '').trim().length > 0);
          return hasQuestion && hasOptions;
        });

      const newEssay = parsed.soalEssay
        .map((soal, idx) => ({
          id: `imported-essay-${Date.now()}-${idx}`,
          question: prepareContentForTipTap(soal.pertanyaan || ""),
          answerKey: prepareContentForTipTap(soal.kunciJawaban || ""),
        }))
        // Filter soal yang kosong: hanya hapus jika pertanyaan kosong
        // Kunci jawaban tidak wajib, bisa diisi nanti
        .filter((soal) => {
          const hasQuestion = soal.question && soal.question.replace(/<[^>]*>/g, '').trim().length > 0;
          return hasQuestion;
        });

      // Check if we should replace or append
      const hasPGOnlyEmptyDefault = 
        multipleChoice.length === 1 && 
        multipleChoice[0].question === "" &&
        multipleChoice[0].options.every(opt => opt === "");
      
      const hasEssayOnlyEmptyDefault = 
        essay.length === 1 && 
        essay[0].question === "" &&
        essay[0].answerKey === "";

      let removedPG = 0;
      let removedEssay = 0;

      if (hasPGOnlyEmptyDefault) {
        // Replace empty default with imported questions
        setMultipleChoice(newMultipleChoice);
      } else {
        // Filter existing questions and append
        const filteredMultipleChoice = multipleChoice.filter((soal) => {
          const hasQuestion = soal.question && soal.question.trim().length > 0;
          const hasOptions = soal.options.some(opt => opt && opt.trim().length > 0);
          return hasQuestion && hasOptions;
        });
        removedPG = multipleChoice.length - filteredMultipleChoice.length;
        setMultipleChoice([...filteredMultipleChoice, ...newMultipleChoice]);
      }

      if (hasEssayOnlyEmptyDefault) {
        // Replace empty default with imported questions
        setEssay(newEssay);
      } else {
        // Filter existing questions and append
        const filteredEssay = essay.filter((soal) => {
          const hasQuestion = soal.question && soal.question.trim().length > 0;
          return hasQuestion;
        });
        removedEssay = essay.length - filteredEssay.length;
        setEssay([...filteredEssay, ...newEssay]);
      }
      
      toast.dismiss();
      
      let successMessage = `Berhasil import ${newMultipleChoice.length} soal PG dan ${newEssay.length} soal Essay`;
      if (removedPG > 0 || removedEssay > 0) {
        successMessage += `. ${removedPG > 0 ? `${removedPG} soal PG kosong dihapus. ` : ''}${removedEssay > 0 ? `${removedEssay} soal Essay kosong dihapus.` : ''}`;
      }
      
      toast.success(successMessage);
      
      // Trigger MathJax to render after content is added
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
          (window as any).MathJax.typesetPromise().catch((err: any) => {
            console.debug('MathJax typeset error:', err);
          });
        }
      }, 100);
      
      // Switch to appropriate tab
      if (newMultipleChoice.length > 0) {
        setActiveTab("multiple");
      } else if (newEssay.length > 0) {
        setActiveTab("essay");
      }
    } catch (error) {
      toast.dismiss();
      const errorMessage = error instanceof Error ? error.message : "Gagal memproses file. Pastikan format file sesuai dan API key Claude dikonfigurasi dengan benar.";
      toast.error(errorMessage);
      console.error(error);
    }

    // Reset input
    event.target.value = '';
  };

  const handleImportWord = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validasi format file - hanya .docx yang didukung
    const ext = file.name.toLowerCase().split('.').pop();
    
    if (ext !== 'docx') {
      toast.error('Format file tidak didukung. Hanya file .docx yang didukung.');
      return;
    }

    try {
      toast.loading("Memproses file Word dengan Mammoth...");
      
      // Upload to API
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/word/parse-mammoth', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse Word document');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.questions) {
        throw new Error('No questions found in document');
      }
      
      // Convert parsed data to our format
      const newMultipleChoice = data.questions
        .filter((q: any) => q.options && q.options.length > 0)
        .map((q: any, idx: number) => {
          // Build question text with image and context
          let questionText = q.questionText;
          if (q.image) {
            questionText += `\n<img src="${q.image}" alt="Question ${q.questionNumber}" />`;
          }
          if (q.context) {
            questionText += `\n${q.context}`;
          }
          
          // Handle correctAnswer: can be string ('A', 'B', 'C', 'D'), null, or undefined
          // null/undefined means no answer detected, use default 'A'
          const correctAnswer = (q.correctAnswer && typeof q.correctAnswer === 'string') 
            ? q.correctAnswer.toUpperCase() 
            : 'A';
          
          // Debug log
          if (q.correctAnswer) {
            console.log(`Question ${q.questionNumber}: correctAnswer = ${correctAnswer}`);
          }
          
          return {
            id: `imported-word-pg-${Date.now()}-${idx}`,
            question: prepareContentForTipTap(questionText),
            options: q.options.map((opt: string) => prepareContentForTipTap(opt)),
            correctAnswer: correctAnswer,
          };
        });
      
      const newEssay = data.questions
        .filter((q: any) => !q.options || q.options.length === 0)
        .map((q: any, idx: number) => {
          let questionText = q.questionText;
          if (q.image) {
            questionText += `\n<img src="${q.image}" alt="Question ${q.questionNumber}" />`;
          }
          if (q.context) {
            questionText += `\n${q.context}`;
          }
          
          return {
            id: `imported-word-essay-${Date.now()}-${idx}`,
            question: prepareContentForTipTap(questionText),
            answerKey: "",
          };
        });
      
      // Add to existing questions
      if (newMultipleChoice.length > 0) {
        // Check if we have only 1 empty default question
        const hasOnlyEmptyDefault = 
          multipleChoice.length === 1 && 
          multipleChoice[0].question === "" &&
          multipleChoice[0].options.every(opt => opt === "");
        
        if (hasOnlyEmptyDefault) {
          // Replace empty default with imported questions
          setMultipleChoice(newMultipleChoice);
        } else {
          // Append to existing questions
          setMultipleChoice([...multipleChoice, ...newMultipleChoice]);
        }
      }
      
      if (newEssay.length > 0) {
        // Check if we have only 1 empty default question
        const hasOnlyEmptyDefault = 
          essay.length === 1 && 
          essay[0].question === "" &&
          essay[0].answerKey === "";
        
        if (hasOnlyEmptyDefault) {
          // Replace empty default with imported questions
          setEssay(newEssay);
        } else {
          // Append to existing questions
          setEssay([...essay, ...newEssay]);
        }
      }
      
      toast.dismiss();
      toast.success(`Berhasil import ${newMultipleChoice.length} soal PG dan ${newEssay.length} soal Essay dari Word`);
      
      // Switch to appropriate tab
      if (newMultipleChoice.length > 0) {
        setActiveTab("pilgan");
      } else if (newEssay.length > 0) {
        setActiveTab("essay");
      }
      
    } catch (error) {
      toast.dismiss();
      const errorMessage = error instanceof Error ? error.message : "Gagal memproses file Word. Pastikan format file .docx.";
      toast.error(errorMessage);
      console.error('Error parsing Word file:', error);
    }

    // Reset input
    event.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/template-soal-ujian.txt';
    link.download = 'Template-Soal-Ujian.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Template PDF berhasil didownload");
  };

  const handleDownloadWordTemplate = () => {
    const link = document.createElement('a');
    link.href = '/template-word/soal.docx';
    link.download = 'Template-Soal-Ujian.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Template Word berhasil didownload");
  };

  const handleKelasToggle = (kelas: string) => {
    setExamInfo(prev => ({
      ...prev,
      kelas: prev.kelas.includes(kelas)
        ? prev.kelas.filter(k => k !== kelas)
        : [...prev.kelas, kelas]
    }));
  };

  // Helper function untuk mengecek apakah soal PG valid
  // strict: true = semua opsi (A-D) harus terisi (untuk publish), false = minimal 1 opsi terisi (untuk draft)
  const isPGValid = (soal: MultipleChoiceQuestion, strict: boolean = false): boolean => {
    const hasQuestion = soal.question && soal.question.replace(/<[^>]*>/g, '').trim().length > 0;
    
    if (!hasQuestion) return false;
    
    if (strict) {
      // Untuk publish: semua opsi (A, B, C, D) harus terisi
      return soal.options.every(opt => opt && opt.replace(/<[^>]*>/g, '').trim().length > 0);
    } else {
      // Untuk draft: minimal 1 opsi terisi
      return soal.options.some(opt => opt && opt.replace(/<[^>]*>/g, '').trim().length > 0);
    }
  };

  const handleSave = async (status: "draft" | "publish") => {
    // Validate
    if (!examInfo.judul || examInfo.kelas.length === 0 || !examInfo.mapelId) {
      toast.error("Mohon lengkapi informasi ujian dan pilih minimal 1 kelas");
      setActiveTab("info");
      return;
    }

    // Validasi khusus untuk publish/aktif: SEMUA PG harus valid dengan semua opsi terisi
    if (status === "publish") {
      const invalidIndices: number[] = [];
      multipleChoice.forEach((soal, index) => {
        // Untuk publish, semua opsi (A-D) harus terisi
        if (!isPGValid(soal, true)) {
          invalidIndices.push(index + 1);
        }
      });
      
      if (invalidIndices.length > 0) {
        const nomorSoal = invalidIndices.join(", ");
        toast.error(`Tidak dapat mempublikasikan ujian. Soal nomor ${nomorSoal} belum lengkap. Semua opsi (A, B, C, D) harus diisi untuk publish.`);
        setActiveTab("multiple");
        return;
      }

      if (multipleChoice.length === 0) {
        toast.error("Tidak dapat mempublikasikan ujian. Soal Pilihan Ganda tidak boleh kosong untuk ujian aktif. Silakan tambahkan minimal 1 soal PG atau simpan sebagai draft terlebih dahulu.");
        setActiveTab("multiple");
        return;
      }
    }

    // Filter soal kosong sebelum submit (untuk draft, hapus yang kosong - minimal 1 opsi terisi)
    const validMultipleChoice = multipleChoice.filter((soal) => {
      return isPGValid(soal, false); // Untuk draft, minimal 1 opsi terisi
    });

    const validEssay = essay.filter((soal) => {
      const hasQuestion = soal.question && soal.question.replace(/<[^>]*>/g, '').trim().length > 0;
      // Kunci jawaban tidak wajib, hanya perlu pertanyaan
      return hasQuestion;
    });

    // Update state dengan soal yang valid (hanya untuk draft)
    if (status === "draft" && (validMultipleChoice.length !== multipleChoice.length || validEssay.length !== essay.length)) {
      setMultipleChoice(validMultipleChoice);
      setEssay(validEssay);
      const removedPG = multipleChoice.length - validMultipleChoice.length;
      const removedEssay = essay.length - validEssay.length;
      if (removedPG > 0 || removedEssay > 0) {
        toast.info(`${removedPG > 0 ? `${removedPG} soal PG kosong dihapus. ` : ''}${removedEssay > 0 ? `${removedEssay} soal Essay kosong dihapus.` : ''}`);
      }
    }

    const totalQuestions = status === "publish" 
      ? multipleChoice.length + validEssay.length 
      : validMultipleChoice.length + validEssay.length;
    
    if (totalQuestions === 0) {
      toast.error("Tambahkan minimal 1 soal");
      return;
    }

    try {
      const response = await fetch(`/api/guru/ujian/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: examInfo.judul,
          deskripsi: examInfo.deskripsi,
          mapelId: examInfo.mapelId,
          kelas: examInfo.kelas,
          startUjian: examInfo.startUjian,
          endUjian: examInfo.endUjian,
          shuffleQuestions: examInfo.shuffleQuestions,
          showScore: examInfo.showScore,
          status: status === "publish" ? "aktif" : "draft",
          soalPG: (status === "publish" ? multipleChoice : validMultipleChoice).map(q => ({
            pertanyaan: q.question,
            opsiA: q.options[0],
            opsiB: q.options[1],
            opsiC: q.options[2],
            opsiD: q.options[3],
            kunciJawaban: q.correctAnswer || 'A',
          })),
          soalEssay: validEssay.map(q => ({
            pertanyaan: q.question,
            kunciJawaban: q.answerKey,
          })),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(status === "draft" ? "Ujian berhasil diupdate sebagai draft" : "Ujian berhasil diupdate dan dipublikasikan");
        router.push("/guru/ujian");
      } else {
        toast.error(result.error || "Gagal mengupdate ujian");
      }
    } catch (error) {
      console.error('Error saving ujian:', error);
      toast.error("Terjadi kesalahan saat menyimpan ujian");
    }
  };

  const totalQuestions = multipleChoice.length + essay.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/guru/ujian")}
          >
            <ArrowLeft className="w-5 h-5" weight="bold" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Ujian</h1>
            <p className="text-muted-foreground">
              Edit informasi ujian dan soal
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => handleSave("draft")} className="w-full sm:w-auto">
            Simpan Draft
          </Button>
          <Button onClick={() => setShowPublishModal(true)} className="w-full sm:w-auto">
            Publikasikan
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gradient-to-br from-[#165DFB] to-[#0d4fc7] p-1">
          <TabsTrigger value="info" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-[#165DFB] text-white">
            <FileText className="w-4 h-4" weight="duotone" />
            Informasi
          </TabsTrigger>
          <TabsTrigger value="multiple" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-[#165DFB] text-white">
            <ListChecks className="w-4 h-4" weight="duotone" />
            Pilihan Ganda ({multipleChoice.length})
          </TabsTrigger>
          <TabsTrigger value="essay" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-[#165DFB] text-white">
            <Article className="w-4 h-4" weight="duotone" />
            Essay ({essay.length})
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-[#165DFB] text-white">
            <Upload className="w-4 h-4" weight="duotone" />
            Impor Soal
          </TabsTrigger>
        </TabsList>

        {/* Tab Informasi */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Ujian</CardTitle>
              <CardDescription>
                Atur detail dan konfigurasi ujian
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="judul">Judul Ujian</Label>
                <Input
                  id="judul"
                  placeholder="Contoh: Ulangan Harian Matematika Bab 3"
                  value={examInfo.judul}
                  onChange={(e) => setExamInfo({ ...examInfo, judul: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deskripsi">Deskripsi</Label>
                <TiptapEditorWithToolbar
                  onChange={(html) => setExamInfo({ ...examInfo, deskripsi: html })}
                  content={examInfo.deskripsi}
                  placeholder="Deskripsi singkat tentang ujian"
                />
              </div>

              <div className="space-y-2">
                <Label>Kelas (Pilih satu atau lebih)</Label>
                <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg">
                  {kelasList.map((kelas: any) => (
                    <div key={kelas.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`exam-kelas-${kelas.id}`}
                        checked={examInfo.kelas.includes(kelas.nama)}
                        onCheckedChange={() => handleKelasToggle(kelas.nama)}
                      />
                      <label
                        htmlFor={`exam-kelas-${kelas.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {kelas.nama}
                      </label>
                    </div>
                  ))}
                </div>
                {examInfo.kelas.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Dipilih: {examInfo.kelas.join(", ")}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mapel">Mata Pelajaran</Label>
                  <Select
                    value={examInfo.mapelId}
                    onValueChange={(value) => setExamInfo({ ...examInfo, mapelId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Mata Pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {mapelList.map((mapel: any) => (
                        <SelectItem key={mapel.id} value={mapel.id}>
                          {mapel.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startUjian">Waktu Mulai Ujian</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="startDate" className="text-xs text-muted-foreground">Tanggal</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={examInfo.startUjian ? (() => {
                            const d = new Date(examInfo.startUjian);
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                          })() : ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              const dateStr = e.target.value;
                              const timeStr = (() => {
                                const d = new Date(examInfo.startUjian);
                                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                              })();
                              const newDate = new Date(`${dateStr}T${timeStr}`);
                              setExamInfo({ ...examInfo, startUjian: newDate });
                            }
                          }}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <TimePickerIndonesia
                          value={examInfo.startUjian}
                          onChange={(date) => {
                            setExamInfo({ ...examInfo, startUjian: date });
                          }}
                          placeholder="08:00"
                          label="Waktu (24 jam)"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Format waktu: 24 jam (00:00 - 23:59). Contoh: 14:00 untuk jam 2 siang
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endUjian">Waktu Akhir Ujian</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="endDate" className="text-xs text-muted-foreground">Tanggal</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={examInfo.endUjian ? (() => {
                            const d = new Date(examInfo.endUjian);
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                          })() : ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              const dateStr = e.target.value;
                              const timeStr = (() => {
                                const d = new Date(examInfo.endUjian);
                                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                              })();
                              const newDate = new Date(`${dateStr}T${timeStr}`);
                              setExamInfo({ ...examInfo, endUjian: newDate });
                            }
                          }}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <TimePickerIndonesia
                          value={examInfo.endUjian}
                          onChange={(date) => {
                            setExamInfo({ ...examInfo, endUjian: date });
                          }}
                          placeholder="09:00"
                          label="Waktu (24 jam)"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Format waktu: 24 jam (00:00 - 23:59). Durasi akan dihitung otomatis.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Pengaturan Ujian</h3>
                
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-50">
                      <Shuffle className="w-5 h-5 text-purple-600" weight="duotone" />
                    </div>
                    <div>
                      <Label htmlFor="shuffle" className="font-medium">Acak Urutan Soal</Label>
                      <p className="text-sm text-muted-foreground">
                        Soal akan ditampilkan secara acak untuk setiap siswa
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="shuffle"
                    checked={examInfo.shuffleQuestions}
                    onCheckedChange={(checked) => setExamInfo({ ...examInfo, shuffleQuestions: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50">
                      {examInfo.showScore ? (
                        <Eye className="w-5 h-5 text-green-600" weight="duotone" />
                      ) : (
                        <EyeClosed className="w-5 h-5 text-gray-600" weight="duotone" />
                      )}
                    </div>
                    <div>
                      <Label htmlFor="showScore" className="font-medium">Tampilkan Nilai ke Siswa</Label>
                      <p className="text-sm text-muted-foreground">
                        Siswa dapat melihat nilai setelah menyelesaikan ujian
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="showScore"
                    checked={examInfo.showScore}
                    onCheckedChange={(checked) => setExamInfo({ ...examInfo, showScore: checked })}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Soal</span>
                  <span className="text-lg font-bold">{totalQuestions}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Pilihan Ganda: {multipleChoice.length} • Essay: {essay.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Pilihan Ganda */}
        <TabsContent value="multiple" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Soal Pilihan Ganda</CardTitle>
                  <CardDescription>
                    Tambah dan kelola soal pilihan ganda
                  </CardDescription>
                </div>
                <Button onClick={handleAddMultipleChoice}>
                  <Plus className="w-4 h-4 mr-2" weight="bold" />
                  Tambah Soal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {multipleChoice.map((question, index) => (
                <div key={question.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold">Soal {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMultipleChoice(question.id)}
                      disabled={multipleChoice.length === 1}
                    >
                      <Trash className="w-4 h-4 text-red-600" weight="duotone" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Pertanyaan</Label>
                    <TiptapEditorWithToolbar
                      onChange={(html) => {
                        const updated = [...multipleChoice];
                        updated[index].question = html;
                        setMultipleChoice(updated);
                      }}
                      content={question.question}
                      placeholder="Tulis pertanyaan di sini..."
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Pilihan Jawaban</Label>
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-start gap-2">
                        <span className="text-sm font-medium text-muted-foreground mt-2 min-w-[20px]">
                          {String.fromCharCode(65 + optIndex)}.
                        </span>
                        <div className="flex-1">
                          <TiptapEditorWithToolbar
                            onChange={(html) => {
                              const updated = [...multipleChoice];
                              updated[index].options[optIndex] = html;
                              setMultipleChoice(updated);
                            }}
                            content={option}
                            placeholder={`Pilihan ${String.fromCharCode(65 + optIndex)}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Kunci Jawaban</Label>
                    <Select
                      value={question.correctAnswer}
                      onValueChange={(value) => {
                        const updated = [...multipleChoice];
                        updated[index].correctAnswer = value;
                        setMultipleChoice(updated);
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Pilih Jawaban" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                        <SelectItem value="D">D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Essay */}
        <TabsContent value="essay" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Soal Essay</CardTitle>
                  <CardDescription>
                    Tambah dan kelola soal essay
                  </CardDescription>
                </div>
                <Button onClick={handleAddEssay}>
                  <Plus className="w-4 h-4 mr-2" weight="bold" />
                  Tambah Soal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {essay.map((question, index) => (
                <div key={question.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold">Soal {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEssay(question.id)}
                      disabled={essay.length === 1}
                    >
                      <Trash className="w-4 h-4 text-red-600" weight="duotone" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Pertanyaan</Label>
                    <TiptapEditorWithToolbar
                      onChange={(html) => {
                        const updated = [...essay];
                        updated[index].question = html;
                        setEssay(updated);
                      }}
                      content={question.question}
                      placeholder="Tulis pertanyaan essay di sini..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Kunci Jawaban</Label>
                    <TiptapEditorWithToolbar
                      onChange={(html) => {
                        const updated = [...essay];
                        updated[index].answerKey = html;
                        setEssay(updated);
                      }}
                      content={question.answerKey}
                      placeholder="Tulis kunci jawaban atau poin-poin penting yang harus ada dalam jawaban siswa..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Kunci jawaban ini akan membantu Anda dalam menilai jawaban siswa
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Import Word */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Soal</CardTitle>
              <CardDescription>
                Upload file yang berisi soal ujian. Pilih format file di bawah.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sub-tabs for PDF and Word */}
              <div className="flex gap-2 bg-gradient-to-br from-[#165DFB] to-[#0d4fc7] p-1 rounded-lg">
                <button
                  onClick={() => setImportSource("pdf")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors rounded-md flex-1",
                    importSource === "pdf"
                      ? "bg-white text-[#165DFB]"
                      : "text-white hover:bg-white/20"
                  )}
                >
                  📄 PDF (AI-Powered)
                </button>
                <button
                  onClick={() => setImportSource("word")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors rounded-md flex-1",
                    importSource === "word"
                      ? "bg-white text-[#165DFB]"
                      : "text-white hover:bg-white/20"
                  )}
                >
                  📝 Word (.docx)
                </button>
              </div>
              {importSource === "pdf" && (
                <>
                  <div className="flex justify-end mb-4">
                    <Button variant="outline" onClick={handleDownloadTemplate}>
                      <Download className="w-4 h-4 mr-2" weight="bold" />
                      Download Template
                    </Button>
                  </div>

                  <div className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" weight="duotone" />
                    <h3 className="font-semibold mb-2">Upload File PDF</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Klik tombol di bawah untuk memilih file .pdf
                    </p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleImportPDF}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload">
                      <Button asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" weight="bold" />
                          Pilih File PDF
                        </span>
                      </Button>
                    </label>
                  </div>
                </>
              )}

              {importSource === "word" && (
                <>
                  <div className="flex justify-end mb-4">
                    <Button variant="outline" onClick={handleDownloadWordTemplate}>
                      <Download className="w-4 h-4 mr-2" weight="bold" />
                      Download Template Word
                    </Button>
                  </div>

                  <div className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" weight="duotone" />
                    <h3 className="font-semibold mb-2">Upload File Word (.docx)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Klik tombol di bawah untuk memilih file .docx
                    </p>
                    <input
                      type="file"
                      accept=".docx"
                      onChange={handleImportWord}
                      className="hidden"
                      id="word-upload"
                    />
                    <label htmlFor="word-upload">
                      <Button asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" weight="bold" />
                          Pilih File Word
                        </span>
                      </Button>
                    </label>
                  </div>
                </>
              )}

              {importSource === "pdf" && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Format File PDF:</h4>
                  <div className="p-4 bg-muted rounded-lg space-y-3 text-sm">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="font-medium text-blue-800 text-xs mb-2">✨ Format yang Didukung:</p>
                      <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                        <li>PDF (.pdf)</li>
                      </ul>
                    </div>

                  <div>
                    <p className="font-medium text-blue-600">A. PILIHAN GANDA</p>
                    <pre className="text-xs mt-2 bg-white p-3 rounded border">
{`1. Pertanyaan soal nomor 1?
A. Pilihan A
B. Pilihan B
C. Pilihan C
D. Pilihan D
Kunci Jawaban: A`}
                    </pre>
                  </div>
                  
                  <div>
                    <p className="font-medium text-green-600 mt-4">B. ESSAY</p>
                    <pre className="text-xs mt-2 bg-white p-3 rounded border">
{`1. Jelaskan tentang...
Kunci Jawaban: Jawaban harus mencakup:
- Poin penting 1
- Poin penting 2`}
                    </pre>
                  </div>

                  <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                    <p className="font-medium text-purple-800 text-xs mb-2">🤖 AI-Powered Extraction:</p>
                    <ul className="text-xs text-purple-700 mt-2 space-y-1 list-disc list-inside">
                      <li>Sistem menggunakan AI Claude Haiku untuk mengekstrak soal secara otomatis</li>
                      <li>File PDF akan diproses langsung oleh Claude sebagai document</li>
                      <li>Ekspresi matematika akan diekstrak dalam format LaTeX</li>
                      <li>Pastikan API key Claude dikonfigurasi di environment variable</li>
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="font-medium text-yellow-800 text-xs">⚠️ Catatan Penting:</p>
                    <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                      <li>Gunakan format "Kunci Jawaban:" (bukan "Jawaban:")</li>
                      <li>Untuk PG: Kunci Jawaban harus A, B, C, atau D</li>
                      <li>Pisahkan section Pilihan Ganda dan Essay dengan jelas</li>
                      <li>Untuk soal matematika, ekspresi akan otomatis dikonversi ke LaTeX</li>
                    </ul>
                  </div>
                </div>
              </div>
              )}

              {importSource === "word" && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Format File Word (.docx):</h4>
                  <div className="p-4 bg-muted rounded-lg space-y-3 text-sm">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="font-medium text-blue-800 text-xs mb-2">✨ Format Table (Recommended):</p>
                      <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                        <li>Gunakan <strong>Table di Word</strong> untuk struktur yang lebih jelas</li>
                        <li>Buat section "A. Pilihan Ganda" dan "B. Essay"</li>
                        <li>Tiap row table = 1 soal atau 1 option</li>
                        <li>Gambar akan otomatis diekstrak sebagai Base64</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium text-blue-600">Contoh Format Table:</p>
                      <div className="text-xs mt-2 bg-white p-3 rounded border">
                        <p className="font-semibold mb-2">A. Pilihan Ganda / Multiple Choice</p>
                        <table className="w-full border-collapse border border-gray-300 text-xs">
                          <tbody>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1 w-12">1.</td>
                              <td className="border border-gray-300 px-2 py-1">
                                Ini Soal Pilihan Ganda<br />
                                [Gambar]<br />
                                Apa isi Soal Tersebut ....
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">A.</td>
                              <td className="border border-gray-300 px-2 py-1">Robot</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">B.</td>
                              <td className="border border-gray-300 px-2 py-1">Telepon</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">C.</td>
                              <td className="border border-gray-300 px-2 py-1">Layar</td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="font-semibold mt-4 mb-2">B. Essay / Essay Question</p>
                        <table className="w-full border-collapse border border-gray-300 text-xs">
                          <tbody>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1 w-12">1.</td>
                              <td className="border border-gray-300 px-2 py-1">
                                Jelaskan tentang...<br />
                                Kunci Jawaban: [isi jawaban]
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                      <p className="font-medium text-green-800 text-xs mb-2">📝 Petunjuk Pembuatan:</p>
                      <ul className="text-xs text-green-700 mt-2 space-y-1 list-disc list-inside">
                        <li><strong>Download template</strong> di atas untuk melihat contoh lengkap</li>
                        <li>Gunakan table dengan 2 kolom: kolom 1 = nomor/huruf, kolom 2 = konten</li>
                        <li>Pisahkan section dengan header "A. Pilihan Ganda" dan "B. Essay"</li>
                        <li>Untuk PG: buat row terpisah untuk setiap option (A., B., C., D.)</li>
                        <li>Gambar bisa ditempatkan di cell table bersama text soal</li>
                      </ul>
                    </div>

                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                      <p className="font-medium text-purple-800 text-xs mb-2">🖼️ Tentang Gambar:</p>
                      <ul className="text-xs text-purple-700 mt-2 space-y-1 list-disc list-inside">
                        <li>Gambar akan diekstrak otomatis dalam format Base64</li>
                        <li>Letakkan gambar di dalam cell table bersama text soal</li>
                        <li>Format gambar: PNG, JPEG, GIF didukung</li>
                        <li>Posisi gambar akan dipertahankan sesuai di Word</li>
                      </ul>
                    </div>

                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="font-medium text-yellow-800 text-xs">⚠️ Catatan Penting:</p>
                      <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                        <li>Gunakan file .docx (bukan .doc)</li>
                        <li>Kunci jawaban harus diset manual setelah import</li>
                        <li>Untuk soal matematika, bisa menggunakan Equation Editor atau LaTeX</li>
                      </ul>
                    </div>

                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="font-medium text-red-800 text-xs mb-2">🚫 TIDAK DIDUKUNG:</p>
                      <ul className="text-xs text-red-700 mt-2 space-y-1 list-disc list-inside">
                        <li><strong>Dokumen scan/screenshot</strong> - Mammoth tidak bisa OCR gambar</li>
                        <li><strong>PDF di-convert ke Word</strong> - Biasanya jadi gambar, bukan text</li>
                        <li><strong>Gambar seluruh halaman</strong> - Text harus editable, bukan embedded image</li>
                      </ul>
                      <p className="text-xs text-red-700 mt-2 font-medium">
                        💡 Jika file Anda adalah scan, gunakan <strong>PDF import (AI-Powered)</strong> yang support vision/OCR!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Konfirmasi Publish */}
      <AlertDialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Publikasi Ujian</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mempublikasikan ujian <span className="font-semibold">{examInfo.judul}</span>?
              <br />
              <br />
              Setelah dipublikasikan, ujian akan menjadi aktif dan dapat diakses oleh siswa. Pastikan semua soal sudah lengkap dan benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowPublishModal(false);
                handleSave("publish");
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Ya, Publikasikan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
