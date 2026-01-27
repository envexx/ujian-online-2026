"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Download, Eye, Search, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { useSiswa, useKelas, useSekolahInfo } from "@/hooks/useSWR";
import { LoadingSpinner, ErrorState } from "@/components/ui/loading-spinner";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import JSZip from "jszip";

export default function KartuPelajarPage() {
  const [selectedKelas, setSelectedKelas] = useState<string>("all");
  const { data: siswaData, isLoading, mutate } = useSiswa(selectedKelas);
  const { data: kelasData, isLoading: kelasLoading } = useKelas();
  const { data: sekolahData, isLoading: sekolahLoading } = useSekolahInfo();
  
  const [previewSiswa, setPreviewSiswa] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const siswa = (siswaData as any)?.data || [];
  const kelasList = (kelasData as any)?.data || [];
  const sekolah = (sekolahData as any)?.data;

  // Debug: Log sekolah data - MUST be before any early returns
  React.useEffect(() => {
    console.log('=== KARTU PELAJAR DEBUG ===');
    console.log('Sekolah Data:', sekolah);
    console.log('Sekolah Logo:', sekolah?.logo);
    console.log('Sekolah Nama:', sekolah?.namaSekolah);
    console.log('SekolahData Raw:', sekolahData);
    console.log('===========================');
  }, [sekolah, sekolahData]);

  if (isLoading || kelasLoading || sekolahLoading) {
    return <LoadingSpinner />;
  }

  const generateQRCode = async (nisn: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(nisn, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const exportCardAsPNG = async (siswa: any) => {
    if (!cardRef.current) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      const fileName = `${siswa.nama.replace(/\s+/g, '-').toLowerCase()}-${siswa.nisn}.png`;
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success(`Kartu pelajar ${siswa.nama} berhasil diexport`);
    } catch (error) {
      console.error('Error exporting card:', error);
      toast.error(`Gagal export kartu pelajar: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAllCardsAsZIP = async () => {
    const filteredSiswa = siswa.filter((s: any) =>
      s.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn?.includes(searchQuery)
    );

    if (filteredSiswa.length === 0) {
      toast.error('Tidak ada kartu untuk diexport');
      return;
    }

    setIsExporting(true);
    toast.info(`Mengexport ${filteredSiswa.length} kartu pelajar...`);

    try {
      const zip = new JSZip();
      const folder = zip.folder('kartu-pelajar');

      for (let i = 0; i < filteredSiswa.length; i++) {
        const s = filteredSiswa[i];
        
        // Set preview untuk render card
        setPreviewSiswa(s);
        
        // Wait longer for render, QR code generation, and image loading
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (cardRef.current) {
          try {
            // Ensure all images are loaded
            const images = cardRef.current.getElementsByTagName('img');
            await Promise.all(
              Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
              })
            );

            const canvas = await html2canvas(cardRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              logging: false,
              useCORS: true,
              allowTaint: true,
            });

            const blob = await new Promise<Blob>((resolve) => {
              canvas.toBlob((blob) => resolve(blob!), 'image/png');
            });

            const fileName = `${s.nama.replace(/\s+/g, '-').toLowerCase()}-${s.nisn}.png`;
            folder?.file(fileName, blob);
            
            toast.info(`Progress: ${i + 1}/${filteredSiswa.length}`);
          } catch (err) {
            console.error(`Error exporting card for ${s.nama}:`, err);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      
      const kelasName = selectedKelas === 'all' 
        ? 'semua-kelas' 
        : kelasList.find((k: any) => k.id === selectedKelas)?.nama || 'kelas';
      
      link.download = `kartu-pelajar-${kelasName}.zip`;
      link.href = URL.createObjectURL(content);
      link.click();

      toast.success(`${filteredSiswa.length} kartu pelajar berhasil diexport`);
      setPreviewSiswa(null);
    } catch (error) {
      console.error('Error exporting cards:', error);
      toast.error(`Gagal export kartu pelajar: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = (s: any) => {
    setPreviewSiswa(s);
  };

  const filteredSiswa = siswa.filter((s: any) =>
    s.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nisn?.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kartu Pelajar</h1>
          <p className="text-muted-foreground">Kelola dan cetak kartu pelajar siswa</p>
        </div>
        <Button 
          onClick={exportAllCardsAsZIP} 
          disabled={isExporting || filteredSiswa.length === 0}
        >
          <FileArchive className="mr-2 h-4 w-4" />
          {isExporting ? 'Mengexport...' : 'Export Semua (ZIP)'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Siswa</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedKelas} onValueChange={setSelectedKelas}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {kelasList.map((k: any) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NISN</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSiswa.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Tidak ada data siswa
                  </TableCell>
                </TableRow>
              ) : (
                filteredSiswa.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.nisn}</TableCell>
                    <TableCell className="font-medium">{s.nama}</TableCell>
                    <TableCell>{s.kelas?.nama}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(s)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewSiswa} onOpenChange={(open) => !open && setPreviewSiswa(null)}>
        <DialogContent style={{ maxWidth: '672px' }}>
          <DialogHeader>
            <DialogTitle>Preview Kartu Pelajar</DialogTitle>
            <DialogDescription>
              Kartu pelajar untuk {previewSiswa?.nama}
            </DialogDescription>
          </DialogHeader>

          {previewSiswa && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <StudentCard 
                siswa={previewSiswa} 
                sekolah={sekolah} 
                cardRef={cardRef as React.RefObject<HTMLDivElement>}
                generateQRCode={generateQRCode}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="outline" onClick={() => setPreviewSiswa(null)}>
                  Tutup
                </Button>
                <Button onClick={() => exportCardAsPNG(previewSiswa)} disabled={isExporting}>
                  <Download style={{ marginRight: '8px', width: '16px', height: '16px' }} />
                  {isExporting ? 'Mengexport...' : 'Cetak Kartu'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Student Card Component
function StudentCard({ 
  siswa, 
  sekolah, 
  cardRef, 
  generateQRCode 
}: { 
  siswa: any; 
  sekolah: any; 
  cardRef: React.RefObject<HTMLDivElement>;
  generateQRCode: (nisn: string) => Promise<string>;
}) {
  const [qrCode, setQrCode] = useState<string>('');

  React.useEffect(() => {
    console.log('=== STUDENT CARD RENDER ===');
    console.log('Siswa:', siswa);
    console.log('Sekolah in Card:', sekolah);
    console.log('Sekolah Logo in Card:', sekolah?.logo);
    console.log('Sekolah Nama in Card:', sekolah?.namaSekolah);
    console.log('===========================');
    
    if (siswa?.nisn) {
      generateQRCode(siswa.nisn).then((qr) => {
        console.log('QR Code generated:', qr ? 'Success' : 'Failed');
        setQrCode(qr);
      });
    }
  }, [siswa?.nisn, sekolah]);

  const today = new Date();
  const validUntil = new Date(today.getFullYear() + 1, 5, 30); // 30 Juni tahun depan

  return (
    <div 
      ref={cardRef}
      style={{
        width: '100%',
        maxWidth: '600px',
        aspectRatio: '600/350',
        background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
        borderRadius: '12px',
        padding: 'clamp(16px, 4vw, 24px)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}
    >
      {/* Background Pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          right: 0, 
          width: '256px', 
          height: '256px', 
          background: 'white', 
          borderRadius: '50%',
          transform: 'translate(128px, -128px)'
        }}></div>
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          width: '192px', 
          height: '192px', 
          background: 'white', 
          borderRadius: '50%',
          transform: 'translate(-96px, 96px)'
        }}></div>
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          {/* Logo */}
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: 'rgba(255,255,255,0.2)', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            {sekolah?.logo ? (
              <img src={sekolah.logo} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.3)', borderRadius: '8px' }}></div>
            )}
          </div>

          {/* School Name */}
          <div style={{ textAlign: 'right', flex: 1, marginLeft: '16px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: '1.2' }}>
              {sekolah?.namaSekolah || 'SMP NEGERI 1'}
            </h2>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>Kartu Pelajar</p>
          </div>
        </div>

        {/* Student Info & QR Code */}
        <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
          {/* Student Info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '12px', opacity: 0.75 }}>NISN</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{siswa.nisn}</p>
            </div>

            <div>
              <p style={{ fontSize: '12px', opacity: 0.75 }}>Nama</p>
              <p style={{ fontSize: '20px', fontWeight: '600' }}>{siswa.nama}</p>
            </div>

            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <p style={{ fontSize: '12px', opacity: 0.75 }}>Kelas</p>
                <p style={{ fontSize: '18px', fontWeight: '600' }}>{siswa.kelas?.nama}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', opacity: 0.75 }}>Berlaku s/d</p>
                <p style={{ fontSize: '18px', fontWeight: '600' }}>
                  {validUntil.toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ 
              width: '128px', 
              height: '128px', 
              background: 'white', 
              borderRadius: '8px', 
              padding: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              {qrCode ? (
                <img src={qrCode} alt="QR Code" style={{ width: '100%', height: '100%' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#e5e7eb', borderRadius: '4px' }}></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
