"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FloppyDisk, Percent, Warning, ToggleLeft, ToggleRight } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface GradeWeightConfig {
  pilihanGanda: {
    name: string;
    weight: number;
    active: boolean;
  };
  essay: {
    name: string;
    weight: number;
    active: boolean;
  };
}

export default function GuruSettingsPage() {
  const [config, setConfig] = useState<GradeWeightConfig>({
    pilihanGanda: {
      name: "Pilihan Ganda",
      weight: 50,
      active: true,
    },
    essay: {
      name: "Essay",
      weight: 50,
      active: true,
    },
  });

  const [tempConfig, setTempConfig] = useState<GradeWeightConfig>(config);

  useEffect(() => {
    // Load config from API
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/guru/settings/grade-config');
        const result = await response.json();
        
        if (result.success && result.data) {
          setConfig(result.data);
          setTempConfig(result.data);
        }
      } catch (error) {
        console.error('Error loading config:', error);
        toast.error('Gagal memuat konfigurasi');
      }
    };
    
    loadConfig();
  }, []);

  const totalWeight = 
    (tempConfig.pilihanGanda.active ? tempConfig.pilihanGanda.weight : 0) +
    (tempConfig.essay.active ? tempConfig.essay.weight : 0);
  const activeComponentCount = 
    (tempConfig.pilihanGanda.active ? 1 : 0) +
    (tempConfig.essay.active ? 1 : 0);
  const isValidWeight = totalWeight === 100 && activeComponentCount > 0;

  const handleSave = async () => {
    if (!isValidWeight) {
      toast.error("Total persentase harus 100%");
      return;
    }

    // Validate names
    const activeComponents = [];
    if (tempConfig.pilihanGanda.active) activeComponents.push(tempConfig.pilihanGanda.name);
    if (tempConfig.essay.active) activeComponents.push(tempConfig.essay.name);
    
    if (activeComponents.some(name => !name)) {
      toast.error("Semua nama komponen aktif harus diisi");
      return;
    }

    // Save to database via API
    try {
      const response = await fetch('/api/guru/settings/grade-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempConfig),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setConfig(tempConfig);
        toast.success("Pengaturan berhasil disimpan");
      } else {
        toast.error(result.error || "Gagal menyimpan pengaturan");
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error("Terjadi kesalahan saat menyimpan");
    }
  };

  const handleReset = () => {
    const defaultConfig: GradeWeightConfig = {
      pilihanGanda: {
        name: "Pilihan Ganda",
        weight: 50,
        active: true,
      },
      essay: {
        name: "Essay",
        weight: 50,
        active: true,
      },
    };
    setTempConfig(defaultConfig);
    toast.info("Pengaturan dikembalikan ke default");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pengaturan</h1>
        <p className="text-muted-foreground">Kelola konfigurasi penilaian siswa</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi Bobot Penilaian</CardTitle>
          <CardDescription>
            Atur nama dan persentase untuk setiap komponen penilaian. Total persentase harus 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Komponen 1 - Pilihan Ganda */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Percent className="w-4 h-4 text-blue-600" weight="duotone" />
                </div>
                <h3 className="font-semibold">Komponen 1 - Pilihan Ganda</h3>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="pg-active" className="text-sm text-muted-foreground">
                  {tempConfig.pilihanGanda.active ? "Aktif" : "Nonaktif"}
                </Label>
                <Switch
                  id="pg-active"
                  checked={tempConfig.pilihanGanda.active}
                  onCheckedChange={(checked) =>
                    setTempConfig({
                      ...tempConfig,
                      pilihanGanda: { ...tempConfig.pilihanGanda, active: checked },
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pg-name">Nama Komponen</Label>
                <Input
                  id="pg-name"
                  placeholder="Pilihan Ganda"
                  value={tempConfig.pilihanGanda.name}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      pilihanGanda: { ...tempConfig.pilihanGanda, name: e.target.value },
                    })
                  }
                  disabled={!tempConfig.pilihanGanda.active}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pg-weight">Persentase (%)</Label>
                <Input
                  id="pg-weight"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="50"
                  value={tempConfig.pilihanGanda.weight}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      pilihanGanda: { ...tempConfig.pilihanGanda, weight: parseInt(e.target.value) || 0 },
                    })
                  }
                  disabled={!tempConfig.pilihanGanda.active}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Komponen 2 - Essay */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-50">
                  <Percent className="w-4 h-4 text-green-600" weight="duotone" />
                </div>
                <h3 className="font-semibold">Komponen 2 - Essay</h3>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="essay-active" className="text-sm text-muted-foreground">
                  {tempConfig.essay.active ? "Aktif" : "Nonaktif"}
                </Label>
                <Switch
                  id="essay-active"
                  checked={tempConfig.essay.active}
                  onCheckedChange={(checked) =>
                    setTempConfig({
                      ...tempConfig,
                      essay: { ...tempConfig.essay, active: checked },
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="essay-name">Nama Komponen</Label>
                <Input
                  id="essay-name"
                  placeholder="Essay"
                  value={tempConfig.essay.name}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      essay: { ...tempConfig.essay, name: e.target.value },
                    })
                  }
                  disabled={!tempConfig.essay.active}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="essay-weight">Persentase (%)</Label>
                <Input
                  id="essay-weight"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="50"
                  value={tempConfig.essay.weight}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      essay: { ...tempConfig.essay, weight: parseInt(e.target.value) || 0 },
                    })
                  }
                  disabled={!tempConfig.essay.active}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Total Weight Display */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-muted-foreground" weight="duotone" />
              <span className="font-semibold">Total Persentase</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${isValidWeight ? "text-green-600" : "text-red-600"}`}>
                {totalWeight}%
              </span>
              {!isValidWeight && (
                <Warning className="w-5 h-5 text-red-600" weight="duotone" />
              )}
            </div>
          </div>

          {!isValidWeight && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <Warning className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" weight="duotone" />
              <div className="text-sm text-red-600">
                <p className="font-semibold">
                  {activeComponentCount === 0 
                    ? "Minimal satu komponen harus aktif" 
                    : "Total persentase harus 100%"}
                </p>
                <p className="text-red-500">
                  {activeComponentCount === 0
                    ? "Aktifkan minimal satu komponen penilaian."
                    : `Saat ini total: ${totalWeight}%. Silakan sesuaikan persentase komponen yang aktif.`}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleReset}>
              Reset ke Default
            </Button>
            <Button onClick={handleSave} disabled={!isValidWeight}>
              <FloppyDisk className="w-4 h-4 mr-2" weight="bold" />
              Simpan Pengaturan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preview Konfigurasi</CardTitle>
          <CardDescription>
            Pratinjau bagaimana konfigurasi ini akan ditampilkan di halaman penilaian
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tempConfig.pilihanGanda.active && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="font-medium">{tempConfig.pilihanGanda.name}</span>
                <span className="text-muted-foreground">{tempConfig.pilihanGanda.weight}%</span>
              </div>
            )}
            {tempConfig.essay.active && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="font-medium">{tempConfig.essay.name}</span>
                <span className="text-muted-foreground">{tempConfig.essay.weight}%</span>
              </div>
            )}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">
              Rumus perhitungan nilai akhir ujian:
            </p>
            <p className="font-mono text-sm mt-1">
              Nilai Akhir = {[
                tempConfig.pilihanGanda.active && `(${tempConfig.pilihanGanda.name} × ${tempConfig.pilihanGanda.weight / 100})`,
                tempConfig.essay.active && `(${tempConfig.essay.name} × ${tempConfig.essay.weight / 100})`
              ].filter(Boolean).join(' + ') || 'Tidak ada komponen aktif'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
