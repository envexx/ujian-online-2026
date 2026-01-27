"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { id } from "date-fns/locale";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/useAuth";

interface JadwalMengajar {
  id: string;
  hari: string;
  waktuMulai: string;
  waktuSelesai: string;
  kelas: string;
  mapel: string;
  ruangan: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function JadwalGuruPage() {
  const { isLoading: authLoading } = useAuth();
  const { data, error, isLoading } = useSWR('/api/guru/jadwal', fetcher);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [filterKelas, setFilterKelas] = useState<string>("all");

  if (authLoading || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Gagal memuat data jadwal</p>
      </div>
    );
  }

  const jadwal = data?.data?.jadwal || [];
  const kelasList = data?.data?.kelasList || [];

  const hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const filteredJadwal = jadwal.filter((j: any) => 
    filterKelas === "all" || j.kelasId === filterKelas
  );

  const getJadwalByHari = (hari: string) => {
    return filteredJadwal.filter((j: any) => j.hari === hari);
  };

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jadwal Mengajar</h1>
          <p className="text-muted-foreground">Jadwal mengajar mingguan Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 py-2 border rounded-lg min-w-[200px] text-center">
            <p className="text-sm font-medium">
              {format(weekStart, "d MMM", { locale: id })} -{" "}
              {format(addDays(weekStart, 6), "d MMM yyyy", { locale: id })}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Jadwal Mingguan</CardTitle>
            <Select value={filterKelas} onValueChange={setFilterKelas}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {kelasList.map((kelas: any) => (
                  <SelectItem key={kelas.id} value={kelas.id}>
                    Kelas {kelas.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {hariList.map((hari) => {
              const jadwalHari = getJadwalByHari(hari);
              return (
                <div key={hari} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">{hari}</h3>
                    <span className="text-sm text-muted-foreground">
                      ({jadwalHari.length} sesi)
                    </span>
                  </div>
                  {jadwalHari.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {jadwalHari.map((j: any) => (
                        <Card key={j.id} className="hover:bg-accent transition-colors">
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{j.mapel}</span>
                                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                                  {j.kelas}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {j.waktuMulai} - {j.waktuSelesai}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span>{j.ruangan}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center border rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        Tidak ada jadwal mengajar
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Jadwal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Total Sesi Mengajar</p>
              <p className="text-2xl font-bold">{filteredJadwal.length}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Kelas Diampu</p>
              <p className="text-2xl font-bold">
                {new Set(filteredJadwal.map((j: any) => j.kelas)).size}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Jam Mengajar/Minggu</p>
              <p className="text-2xl font-bold">
                {filteredJadwal.length * 1.5} jam
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
