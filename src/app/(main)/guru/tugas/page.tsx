"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Plus, 
  Eye, 
  Trash, 
  PencilSimple,
  ClipboardText,
  CheckCircle,
  Clock,
  XCircle,
  CalendarBlank,
} from "@phosphor-icons/react";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Tugas {
  id: string;
  judul: string;
  deskripsi: string;
  kelas: string[];
  mapel: string;
  deadline: Date;
  status: "aktif" | "selesai";
  totalSiswa: number;
  sudahMengumpulkan: number;
  belumMengumpulkan: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function TugasGuruPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [formData, setFormData] = useState({
    judul: "",
    deskripsi: "",
    instruksi: "",
    kelas: [] as string[],
    mapelId: "",
    deadline: new Date(),
    fileUrl: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string>("");

  const { data, error, isLoading, mutate } = useSWR(
    `/api/guru/tugas?status=${filterStatus}`,
    fetcher
  );

  if (authLoading || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data tugas</p>
      </div>
    );
  }

  const tugas = data?.data?.tugas || [];
  const kelasList = data?.data?.kelasList || [];
  const mapelList = data?.data?.mapelList || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let fileUrl = formData.fileUrl;

      // Handle file upload if there's a new file
      if (selectedFile) {
        toast.info("Mengupload file...");
        
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        uploadFormData.append('folder', 'tugas');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        const uploadResult = await uploadResponse.json();

        if (uploadResponse.ok && uploadResult.success) {
          fileUrl = uploadResult.data.filePath;
          toast.success("File berhasil diupload");
        } else {
          toast.error(uploadResult.error || "Gagal mengupload file");
          return;
        }
      }

      const url = isEditMode ? '/api/guru/tugas' : '/api/guru/tugas';
      const method = isEditMode ? 'PUT' : 'POST';
      const body = isEditMode 
        ? { ...formData, id: editingId, fileUrl } 
        : { ...formData, fileUrl };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        await mutate();
        toast.success(isEditMode ? "Tugas berhasil diupdate" : "Tugas berhasil ditambahkan");
        setIsDialogOpen(false);
        resetForm();
      } else {
        toast.error(result.error || (isEditMode ? "Gagal mengupdate tugas" : "Gagal menambahkan tugas"));
      }
    } catch (error) {
      console.error('Error saving tugas:', error);
      toast.error("Terjadi kesalahan saat menyimpan tugas");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus tugas ini?")) {
      try {
        const response = await fetch(`/api/guru/tugas?id=${id}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (response.ok && result.success) {
          await mutate();
          toast.success("Tugas berhasil dihapus");
        } else {
          toast.error(result.error || "Gagal menghapus tugas");
        }
      } catch (error) {
        console.error('Error deleting tugas:', error);
        toast.error("Terjadi kesalahan saat menghapus tugas");
      }
    }
  };

  const handleEdit = (tugasItem: any) => {
    setIsEditMode(true);
    setEditingId(tugasItem.id);
    setFormData({
      judul: tugasItem.judul,
      deskripsi: tugasItem.deskripsi,
      instruksi: tugasItem.instruksi,
      kelas: tugasItem.kelas,
      mapelId: tugasItem.mapelId,
      deadline: new Date(tugasItem.deadline),
      fileUrl: tugasItem.fileUrl || "",
    });
    setExistingFileUrl(tugasItem.fileUrl || "");
    setSelectedFile(null);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExistingFileUrl("");
    setFormData({ ...formData, fileUrl: "" });
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditingId(null);
    setSelectedFile(null);
    setExistingFileUrl("");
    setFormData({
      judul: "",
      deskripsi: "",
      instruksi: "",
      kelas: [],
      mapelId: "",
      deadline: new Date(),
      fileUrl: "",
    });
  };

  const handleKelasToggle = (kelas: string) => {
    setFormData(prev => ({
      ...prev,
      kelas: prev.kelas.includes(kelas)
        ? prev.kelas.filter((k: string) => k !== kelas)
        : [...prev.kelas, kelas]
    }));
  };

  const stats = {
    total: tugas.length,
    aktif: tugas.filter((t: any) => t.status === 'aktif').length,
    selesai: tugas.filter((t: any) => t.status === 'selesai').length,
    belumDinilai: tugas.reduce((sum: number, t: any) => sum + (t.totalSubmissions || 0), 0),
  };

  const filteredTugas = tugas;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Manajemen Tugas</h1>
          <p className="text-sm md:text-base text-muted-foreground">Kelola tugas dan penilaian siswa</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" weight="bold" />
              Buat Tugas Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Edit Tugas" : "Buat Tugas Baru"}</DialogTitle>
              <DialogDescription>
                {isEditMode ? "Ubah informasi tugas" : "Isi form di bawah untuk membuat tugas baru"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="judul">Judul Tugas</Label>
                <Input
                  id="judul"
                  placeholder="Masukkan judul tugas"
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instruksi">Instruksi</Label>
                <Textarea
                  id="instruksi"
                  placeholder="Tulis instruksi lengkap untuk siswa mengerjakan tugas ini..."
                  value={formData.instruksi}
                  onChange={(e) => setFormData({ ...formData, instruksi: e.target.value })}
                  required
                  className="w-full"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">File Lampiran (Opsional)</Label>
                
                {/* Show existing file in edit mode */}
                {isEditMode && existingFileUrl && !selectedFile && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                    <div className="flex-1">
                      <p className="text-sm font-medium">File saat ini:</p>
                      <p className="text-xs text-muted-foreground truncate">{existingFileUrl}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleRemoveFile}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Show selected new file */}
                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-blue-50">
                    <div className="flex-1">
                      <p className="text-sm font-medium">File baru:</p>
                      <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setSelectedFile(null)}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* File input - show if no file or in create mode */}
                {(!isEditMode || !existingFileUrl || selectedFile) && (
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    className="w-full"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                  />
                )}

                <p className="text-xs text-muted-foreground">
                  Format: PDF, Word, PowerPoint, atau Gambar (Max 10MB)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Kelas (Pilih satu atau lebih)</Label>
                <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg">
                  {kelasList.map((kelas: any) => (
                    <div key={kelas.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`kelas-${kelas.id}`}
                        checked={formData.kelas.includes(kelas.nama)}
                        onCheckedChange={() => handleKelasToggle(kelas.nama)}
                      />
                      <label
                        htmlFor={`kelas-${kelas.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {kelas.nama}
                      </label>
                    </div>
                  ))}
                </div>
                {formData.kelas.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Dipilih: {formData.kelas.join(", ")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mapel">Mata Pelajaran</Label>
                  <Select
                    value={formData.mapelId}
                    onValueChange={(value) => setFormData({ ...formData, mapelId: value })}
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

                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.deadline, "PPP", { locale: id })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.deadline}
                        onSelect={(date) => date && setFormData({ ...formData, deadline: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>


              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit">
                  Buat Tugas
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Total Tugas"
          value={stats.total}
          icon={ClipboardText}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Tugas Aktif"
          value={stats.aktif}
          icon={Clock}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
        <StatCard
          title="Tugas Selesai"
          value={stats.selesai}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Perlu Dinilai"
          value={stats.belumDinilai}
          icon={XCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Daftar Tugas ({filteredTugas.length})</CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="selesai">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul Tugas</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTugas.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{t.judul}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{t.deskripsi}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.kelas.map((k: any) => (
                        <span key={k} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {k}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarBlank className="w-4 h-4 text-muted-foreground" weight="duotone" />
                      <span className="text-sm">
                        {format(t.deadline, "dd MMM yyyy", { locale: id })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <span className="text-green-600 font-medium">{t.sudahMengumpulkan}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{t.totalSiswa}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${(t.sudahMengumpulkan / t.totalSiswa) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      t.status === "aktif" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                    }`}>
                      {t.status === "aktif" ? "Aktif" : "Selesai"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => router.push(`/guru/tugas/${t.id}`)}
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" weight="duotone" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleEdit(t)}
                      >
                        <PencilSimple className="w-4 h-4 text-blue-600" weight="duotone" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                        <Trash className="w-4 h-4 text-red-600" weight="duotone" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
