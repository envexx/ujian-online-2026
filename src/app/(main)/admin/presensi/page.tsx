"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { QrCode, Search, Users, UserCheck, UserX, Clock, CalendarIcon, Plus, Edit, FileSpreadsheet, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useKelas, usePresensi, useSiswa } from "@/hooks/useSWR";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatIndonesiaDate } from "@/lib/date-utils";
import * as XLSX from 'xlsx';

export default function PresensiPage() {
  const router = useRouter();
  const [date, setDate] = useState<Date>(new Date());
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [manualDialog, setManualDialog] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [selectedPresensi, setSelectedPresensi] = useState<any>(null);
  const [manualForm, setManualForm] = useState({
    siswaId: "",
    siswaName: "",
    status: "hadir",
    keterangan: "",
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [siswaSearch, setSiswaSearch] = useState("");
  
  // Export date range state
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(new Date());
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(new Date());
  const [isExporting, setIsExporting] = useState(false);
  
  const tanggal = format(date, "yyyy-MM-dd");
  const { data: kelasData, isLoading: kelasLoading } = useKelas();
  const { data: presensiData, isLoading: presensiLoading, mutate } = usePresensi(tanggal);
  const { data: siswaData } = useSiswa("all");

  const kelasList = (kelasData as any)?.data || [];
  const presensiList = (presensiData as any)?.data || [];
  const siswaList = (siswaData as any)?.data || [];

  // Filter siswa for search - MUST be before any conditional returns
  const filteredSiswaForSearch = useMemo(() => {
    return siswaList.filter((s: any) =>
      s.nama?.toLowerCase().includes(siswaSearch.toLowerCase()) ||
      s.nis?.includes(siswaSearch)
    );
  }, [siswaList, siswaSearch]);

  // Conditional rendering AFTER all hooks
  if (kelasLoading || presensiLoading) {
    return <LoadingSpinner />;
  }

  // Filter presensi by kelas and search
  const filteredPresensi = presensiList.filter((p: any) => {
    const matchKelas = filterKelas === "all" || p.siswa?.kelasId === filterKelas;
    const matchSearch = !searchQuery || 
      p.siswa?.nama?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchKelas && matchSearch;
  });

  // Calculate stats
  const stats = {
    total: filteredPresensi.length,
    hadir: filteredPresensi.filter((p: any) => p.status === "hadir").length,
    izin: filteredPresensi.filter((p: any) => p.status === "izin").length,
    sakit: filteredPresensi.filter((p: any) => p.status === "sakit").length,
    alpha: filteredPresensi.filter((p: any) => p.status === "alpha").length,
  };

  const handleEdit = (presensi: any) => {
    setSelectedPresensi(presensi);
    setEditDialog(true);
  };

  const handleUpdateStatus = async (newStatus: string, keterangan: string) => {
    if (!selectedPresensi) return;

    try {
      const response = await fetch('/api/presensi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPresensi.id,
          status: newStatus,
          keterangan: keterangan || `Update status menjadi ${newStatus}`,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Status ${selectedPresensi.siswa.nama} berhasil diubah`);
        mutate();
        setEditDialog(false);
        setSelectedPresensi(null);
      } else {
        toast.error(result.error || "Gagal memperbarui status");
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error("Terjadi kesalahan saat memperbarui status");
    }
  };

  const handleManualInput = async () => {
    if (!manualForm.siswaId) {
      toast.error("Pilih siswa terlebih dahulu");
      return;
    }

    try {
      const response = await fetch('/api/presensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: manualForm.siswaId,
          tanggal: date.toISOString(),
          status: manualForm.status,
          keterangan: manualForm.keterangan || `Input manual - ${manualForm.status}`,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Presensi berhasil ditambahkan");
        mutate();
        setManualDialog(false);
        setManualForm({ siswaId: "", siswaName: "", status: "hadir", keterangan: "" });
        setSiswaSearch("");
      } else {
        toast.error(result.error || "Gagal menambahkan presensi");
      }
    } catch (error) {
      console.error('Error adding presensi:', error);
      toast.error("Terjadi kesalahan saat menambahkan presensi");
    }
  };

  const exportToExcel = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast.error("Pilih tanggal mulai dan akhir");
      return;
    }

    // Validate date range - max 3 years back
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    
    if (exportStartDate < threeYearsAgo) {
      toast.error("Maksimal export data 3 tahun ke belakang");
      return;
    }

    if (exportStartDate > exportEndDate) {
      toast.error("Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
      return;
    }

    setIsExporting(true);

    try {
      // Fetch data for date range
      const startDateStr = format(exportStartDate, "yyyy-MM-dd");
      const endDateStr = format(exportEndDate, "yyyy-MM-dd");
      
      const response = await fetch(`/api/presensi?startDate=${startDateStr}&endDate=${endDateStr}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Gagal mengambil data presensi");
        return;
      }

      const presensiData = result.data || [];

      // Filter by kelas if needed
      const filteredData = filterKelas === "all" 
        ? presensiData 
        : presensiData.filter((p: any) => p.siswa?.kelasId === filterKelas);

      if (filteredData.length === 0) {
        toast.error("Tidak ada data untuk diexport");
        return;
      }

      const exportData = filteredData.map((p: any, index: number) => ({
        No: index + 1,
        Nama: p.siswa?.nama || "-",
        Kelas: p.siswa?.kelas?.nama || "-",
        Tanggal: formatIndonesiaDate(p.tanggal, "dd/MM/yyyy"),
        Waktu: formatIndonesiaDate(p.createdAt, "HH:mm"),
        Status: p.status.toUpperCase(),
        Keterangan: p.keterangan || "-",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Presensi");

      // Auto-size columns
      const maxWidth = exportData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => {
          const cellValue = r[k]?.toString() || '';
          return Math.max(w[i] || 10, cellValue.length);
        });
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      const fileName = `Presensi_${startDateStr}_${endDateStr}_${filterKelas === "all" ? "Semua" : kelasList.find((k: any) => k.id === filterKelas)?.nama || "Unknown"}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Data berhasil diexport (${filteredData.length} record)`);
      setExportDialog(false);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error("Terjadi kesalahan saat export data");
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      hadir: { variant: "default", icon: UserCheck, color: "text-green-600" },
      izin: { variant: "secondary", icon: Clock, color: "text-blue-600" },
      sakit: { variant: "outline", icon: UserX, color: "text-yellow-600" },
      alpha: { variant: "destructive", icon: UserX, color: "text-red-600" },
    };

    const config = variants[status] || variants.alpha;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Daftar Presensi</h1>
          <p className="text-muted-foreground">
            {format(date, "EEEE, d MMMM yyyy", { locale: id })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/presensi/scan')}>
            <QrCode className="mr-2 h-4 w-4" />
            Scan QR
          </Button>
          <Button variant="outline" onClick={() => setManualDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Input Manual
          </Button>
          <Button variant="outline" onClick={() => setExportDialog(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hadir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{stats.hadir}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Izin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">{stats.izin}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sakit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-yellow-600" />
              <span className="text-2xl font-bold text-yellow-600">{stats.sakit}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alpha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{stats.alpha}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Presensi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: id }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Kelas Filter */}
            <Select value={filterKelas} onValueChange={setFilterKelas}>
              <SelectTrigger className="w-full sm:w-[200px]">
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

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPresensi.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Tidak ada data presensi untuk tanggal ini
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPresensi.map((presensi: any) => (
                    <TableRow key={presensi.id}>
                      <TableCell className="font-medium">{presensi.siswa?.nama}</TableCell>
                      <TableCell>{presensi.siswa?.kelas?.nama}</TableCell>
                      <TableCell>
                        {formatIndonesiaDate(presensi.tanggal, "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {formatIndonesiaDate(presensi.createdAt, "HH:mm")} WIB
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {presensi.keterangan || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(presensi.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(presensi)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Status Presensi</DialogTitle>
            <DialogDescription>
              Ubah status kehadiran {selectedPresensi?.siswa?.nama}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status Kehadiran</Label>
              <Select
                defaultValue={selectedPresensi?.status}
                onValueChange={(value) => {
                  const keterangan = `Update status menjadi ${value}`;
                  handleUpdateStatus(value, keterangan);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hadir">Hadir</SelectItem>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="alpha">Alpha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Data Presensi</DialogTitle>
            <DialogDescription>
              Pilih rentang tanggal untuk export data (maksimal 3 tahun ke belakang)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportStartDate ? format(exportStartDate, "PPP", { locale: id }) : "Pilih tanggal mulai"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={exportStartDate}
                    onSelect={setExportStartDate}
                    disabled={(date) => {
                      const threeYearsAgo = new Date();
                      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
                      return date < threeYearsAgo || date > new Date();
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Akhir</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportEndDate ? format(exportEndDate, "PPP", { locale: id }) : "Pilih tanggal akhir"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={exportEndDate}
                    onSelect={setExportEndDate}
                    disabled={(date) => {
                      const threeYearsAgo = new Date();
                      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
                      return date < threeYearsAgo || date > new Date();
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Filter Kelas</Label>
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger>
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

            <Button onClick={exportToExcel} className="w-full" disabled={isExporting}>
              {isExporting ? "Mengexport..." : "Export ke Excel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Input Dialog with Search */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Input Presensi Manual</DialogTitle>
            <DialogDescription>
              Cari dan tambahkan presensi siswa secara manual
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cari Siswa</Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="w-full justify-between"
                  >
                    {manualForm.siswaName || "Cari nama siswa..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Ketik nama siswa..." 
                      value={siswaSearch}
                      onValueChange={setSiswaSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Siswa tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {filteredSiswaForSearch.slice(0, 50).map((siswa: any) => (
                          <CommandItem
                            key={siswa.id}
                            value={siswa.nama}
                            onSelect={() => {
                              setManualForm({
                                ...manualForm,
                                siswaId: siswa.id,
                                siswaName: `${siswa.nama} - ${siswa.kelas?.nama}`,
                              });
                              setSearchOpen(false);
                              setSiswaSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                manualForm.siswaId === siswa.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{siswa.nama}</span>
                              <span className="text-xs text-muted-foreground">
                                {siswa.kelas?.nama} • {siswa.nis}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={manualForm.status}
                onValueChange={(value) => setManualForm({ ...manualForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hadir">Hadir</SelectItem>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="alpha">Alpha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Keterangan (Opsional)</Label>
              <Input
                placeholder="Masukkan keterangan..."
                value={manualForm.keterangan}
                onChange={(e) => setManualForm({ ...manualForm, keterangan: e.target.value })}
              />
            </div>

            <Button onClick={handleManualInput} className="w-full">
              Simpan Presensi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
