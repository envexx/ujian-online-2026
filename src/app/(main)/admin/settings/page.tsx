"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Building, Image as ImageIcon, Phone, MapPin, FloppyDisk, Upload } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useSekolahInfo } from "@/hooks/useSWR";
import { LoadingSpinner, ErrorState } from "@/components/ui/loading-spinner";

export default function AdminSettingsPage() {
  const { data: sekolahData, isLoading, mutate } = useSekolahInfo();
  const sekolah = (sekolahData as any)?.data;

  const [formData, setFormData] = useState({
    namaSekolah: "",
    alamat: "",
    noTelp: "",
    email: "",
    website: "",
    logo: "",
    namaKepsek: "",
    nipKepsek: "",
    tahunAjaran: "",
    semester: "",
  });

  const [logoPreview, setLogoPreview] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Load data from API when available
  React.useEffect(() => {
    if (sekolah) {
      setFormData({
        namaSekolah: sekolah.namaSekolah || "",
        alamat: sekolah.alamat || "",
        noTelp: sekolah.noTelp || "",
        email: sekolah.email || "",
        website: sekolah.website || "",
        logo: sekolah.logo || "",
        namaKepsek: sekolah.namaKepsek || "",
        nipKepsek: sekolah.nipKepsek || "",
        tahunAjaran: sekolah.tahunAjaran || "",
        semester: sekolah.semester || "",
      });
      setLogoPreview(sekolah.logo || "");
    }
  }, [sekolah]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 2MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setFormData({ ...formData, logo: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const method = sekolah?.id ? 'PUT' : 'POST';
      const payload = sekolah?.id ? { id: sekolah.id, ...formData } : formData;

      const response = await fetch('/api/sekolah-info', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || "Pengaturan berhasil disimpan");
        mutate(); // Refresh data
      } else {
        toast.error(result.error || "Gagal menyimpan pengaturan");
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Pengaturan Sekolah</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Kelola informasi sekolah untuk kartu pelajar dan dokumen resmi
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none">
          <FloppyDisk className="w-4 h-4 mr-2" weight="bold" />
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      </div>

      {/* Informasi Sekolah */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" weight="duotone" />
            Informasi Sekolah
          </CardTitle>
          <CardDescription>
            Informasi ini akan ditampilkan di halaman login, kartu pelajar, dan dokumen resmi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Sekolah */}
          <div className="space-y-4">
            <Label>Logo Sekolah</Label>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-muted-foreground" weight="duotone" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload">
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <span>
                      <Upload className="w-4 h-4 mr-2" weight="bold" />
                      Upload Logo
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">
                  Format: PNG, JPG, atau SVG. Maksimal 2MB. Rekomendasi: 512x512px
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Nama Sekolah */}
          <div className="space-y-2">
            <Label htmlFor="namaSekolah">Nama Sekolah *</Label>
            <Input
              id="namaSekolah"
              value={formData.namaSekolah}
              onChange={(e) => setFormData({ ...formData, namaSekolah: e.target.value })}
              placeholder="Contoh: SMP Negeri 1 Jakarta"
              required
            />
          </div>

          {/* Alamat */}
          <div className="space-y-2">
            <Label htmlFor="alamat">Alamat Lengkap *</Label>
            <Textarea
              id="alamat"
              value={formData.alamat}
              onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
              placeholder="Alamat lengkap sekolah"
              rows={3}
              required
            />
          </div>

          {/* Kontak */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="noTelp">
                <Phone className="w-4 h-4 inline mr-1" weight="duotone" />
                No. Telepon *
              </Label>
              <Input
                id="noTelp"
                value={formData.noTelp}
                onChange={(e) => setFormData({ ...formData, noTelp: e.target.value })}
                placeholder="(021) 1234-5678"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@sekolah.sch.id"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="www.sekolah.sch.id"
            />
          </div>
        </CardContent>
      </Card>

      {/* Kepala Sekolah */}
      <Card>
        <CardHeader>
          <CardTitle>Kepala Sekolah</CardTitle>
          <CardDescription>
            Informasi kepala sekolah untuk dokumen resmi dan surat keterangan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="namaKepsek">Nama Kepala Sekolah *</Label>
            <Input
              id="namaKepsek"
              value={formData.namaKepsek}
              onChange={(e) => setFormData({ ...formData, namaKepsek: e.target.value })}
              placeholder="Dr. Budi Santoso, M.Pd"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nipKepsek">NIP Kepala Sekolah *</Label>
            <Input
              id="nipKepsek"
              value={formData.nipKepsek}
              onChange={(e) => setFormData({ ...formData, nipKepsek: e.target.value })}
              placeholder="196501011990031001"
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Tahun Ajaran */}
      <Card>
        <CardHeader>
          <CardTitle>Tahun Ajaran</CardTitle>
          <CardDescription>
            Pengaturan tahun ajaran dan semester aktif
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tahunAjaran">Tahun Ajaran *</Label>
              <Input
                id="tahunAjaran"
                value={formData.tahunAjaran}
                onChange={(e) => setFormData({ ...formData, tahunAjaran: e.target.value })}
                placeholder="2024/2025"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">Semester *</Label>
              <select
                id="semester"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                required
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Penting */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">📌 Informasi Penting</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Pengaturan ini akan digunakan di berbagai tempat seperti:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Halaman login dan header aplikasi</li>
            <li>Kartu pelajar siswa</li>
            <li>Surat keterangan dan dokumen resmi</li>
            <li>Laporan dan transkrip nilai</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
