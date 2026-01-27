"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
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
import { Plus, Upload, Download, Eye, Trash, FilePdf, VideoCamera, Image as ImageIconPhosphor, Folder } from "@phosphor-icons/react";
import { FileText, Video, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Materi {
  id: string;
  judul: string;
  deskripsi: string;
  kelas: string;
  mapel: string;
  tipe: "pdf" | "video" | "image" | "link";
  fileUrl?: string;
  tanggalUpload: Date;
  ukuranFile?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function MateriGuruPage() {
  const { isLoading: authLoading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [filterTipe, setFilterTipe] = useState<string>("all");
  const [formData, setFormData] = useState({
    judul: "",
    deskripsi: "",
    kelas: "7A",
    mapelId: "",
    tipe: "pdf" as "pdf" | "video" | "image" | "link",
    fileUrl: "",
    ukuran: "",
  });

  const { data, error, isLoading, mutate } = useSWR(
    `/api/guru/materi?kelas=${filterKelas}&tipe=${filterTipe}`,
    fetcher
  );

  if (authLoading || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data materi</p>
      </div>
    );
  }

  const materi = data?.data?.materi || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/guru/materi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        await mutate();
        toast.success("Materi berhasil ditambahkan");
        setIsDialogOpen(false);
        resetForm();
      } else {
        toast.error(result.error || "Gagal menambahkan materi");
      }
    } catch (error) {
      console.error('Error adding materi:', error);
      toast.error("Terjadi kesalahan saat menambahkan materi");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus materi ini?")) {
      try {
        const response = await fetch(`/api/guru/materi?id=${id}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (response.ok && result.success) {
          await mutate();
          toast.success("Materi berhasil dihapus");
        } else {
          toast.error(result.error || "Gagal menghapus materi");
        }
      } catch (error) {
        console.error('Error deleting materi:', error);
        toast.error("Terjadi kesalahan saat menghapus materi");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      judul: "",
      deskripsi: "",
      kelas: "7A",
      mapelId: "",
      tipe: "pdf",
      fileUrl: "",
      ukuran: "",
    });
  };

  const filteredMateri = materi;

  const getTipeIcon = (tipe: string) => {
    switch (tipe) {
      case "pdf":
        return <FilePdf className="w-4 h-4 text-red-600" weight="duotone" />;
      case "video":
        return <VideoCamera className="w-4 h-4 text-purple-600" weight="duotone" />;
      case "image":
        return <ImageIconPhosphor className="w-4 h-4 text-green-600" weight="duotone" />;
      default:
        return <FilePdf className="w-4 h-4 text-gray-600" weight="duotone" />;
    }
  };

  const stats = {
    total: materi.length,
    pdf: materi.filter((m: any) => m.tipe === "pdf").length,
    video: materi.filter((m: any) => m.tipe === "video").length,
    image: materi.filter((m: any) => m.tipe === "image").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Materi Pembelajaran</h1>
          <p className="text-muted-foreground">Kelola materi pembelajaran untuk siswa</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Upload Materi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Materi Baru</DialogTitle>
              <DialogDescription>
                Isi form di bawah untuk menambahkan materi pembelajaran
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="judul">Judul Materi</Label>
                <Input
                  id="judul"
                  placeholder="Masukkan judul materi"
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deskripsi">Deskripsi</Label>
                <Textarea
                  id="deskripsi"
                  placeholder="Deskripsi singkat tentang materi"
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  required
                  className="w-full"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kelas">Kelas</Label>
                  <Select
                    value={formData.kelas}
                    onValueChange={(value) => setFormData({ ...formData, kelas: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7A">Kelas 7A</SelectItem>
                      <SelectItem value="7B">Kelas 7B</SelectItem>
                      <SelectItem value="8A">Kelas 8A</SelectItem>
                      <SelectItem value="8B">Kelas 8B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mapel">Mata Pelajaran</Label>
                  <Select
                    value={formData.mapelId}
                    onValueChange={(value) => setFormData({ ...formData, mapelId: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Matematika">Matematika</SelectItem>
                      <SelectItem value="Bahasa Indonesia">Bahasa Indonesia</SelectItem>
                      <SelectItem value="IPA">IPA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipe">Tipe Materi</Label>
                <Select
                  value={formData.tipe}
                  onValueChange={(value) => setFormData({ ...formData, tipe: value as any })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="image">Gambar</SelectItem>
                    <SelectItem value="link">Link External</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">File/Link</Label>
                {formData.tipe === "link" ? (
                  <Input
                    id="file"
                    type="url"
                    placeholder="https://..."
                    value={formData.fileUrl}
                    onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                    required
                    className="w-full"
                  />
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="file"
                      type="file"
                      accept={
                        formData.tipe === "pdf" ? ".pdf" :
                        formData.tipe === "video" ? "video/*" :
                        "image/*"
                      }
                      className="w-full"
                    />
                    <Button type="button" size="icon" variant="outline">
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit">
                  Upload Materi
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          title="Total Materi"
          value={stats.total}
          icon={Folder}
          iconColor="text-gray-600"
          iconBg="bg-gray-50"
        />
        <StatCard
          title="PDF"
          value={stats.pdf}
          icon={FilePdf}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
        <StatCard
          title="Video"
          value={stats.video}
          icon={VideoCamera}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <StatCard
          title="Gambar"
          value={stats.image}
          icon={ImageIconPhosphor}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Daftar Materi ({filteredMateri.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  <SelectItem value="7A">Kelas 7A</SelectItem>
                  <SelectItem value="7B">Kelas 7B</SelectItem>
                  <SelectItem value="8A">Kelas 8A</SelectItem>
                  <SelectItem value="8B">Kelas 8B</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTipe} onValueChange={setFilterTipe}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Semua Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="image">Gambar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Ukuran</TableHead>
                <TableHead>Tanggal Upload</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMateri.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.judul}</TableCell>
                  <TableCell className="max-w-xs truncate">{m.deskripsi}</TableCell>
                  <TableCell>{m.kelas}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTipeIcon(m.tipe)}
                      <span className="capitalize">{m.tipe}</span>
                    </div>
                  </TableCell>
                  <TableCell>{m.ukuranFile}</TableCell>
                  <TableCell>{m.tanggalUpload.toLocaleDateString("id-ID")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
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
