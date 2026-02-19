# Dokumentasi Simulasi Load Testing
## Aplikasi Ujian Online - E-Learning

**Tanggal:** 19 Februari 2026  
**Versi:** 2.2.0

---

## 📊 Skenario Simulasi

| Parameter | Nilai |
|-----------|-------|
| **Jumlah User Concurrent** | 1,000 siswa |
| **Jumlah Ujian per User** | 12 ujian |
| **Jumlah Soal per Ujian** | 40 soal |
| **Durasi Ujian** | 90 menit (estimasi) |

---

## 🔄 Alur Request per Siswa (1 Ujian)

### Phase 1: Login & Validasi
| No | Endpoint | Method | Deskripsi | Request/User |
|----|----------|--------|-----------|--------------|
| 1 | `/api/auth/siswa-login` | POST | Login siswa | 1 |
| 2 | `/api/auth/session` | GET | Validasi session | 1 |
| 3 | `/api/siswa/ujian/validate-token` | POST | Validasi token ujian | 1 |

**Subtotal Phase 1:** 3 requests

### Phase 2: Load Ujian
| No | Endpoint | Method | Deskripsi | Request/User |
|----|----------|--------|-----------|--------------|
| 4 | `/api/siswa/ujian` | GET | Daftar ujian tersedia | 1 |
| 5 | `/api/siswa/ujian/[id]` | GET | Detail ujian + 40 soal | 1 |

**Subtotal Phase 2:** 2 requests

### Phase 3: Mengerjakan Ujian (40 Soal)
| No | Endpoint | Method | Deskripsi | Request/User |
|----|----------|--------|-----------|--------------|
| 6 | `/api/siswa/ujian/[id]/save-answer` | POST | Auto-save jawaban (per soal) | 40 |
| 7 | `/api/siswa/ujian/[id]/time-remaining` | GET | Sync waktu (setiap 5 menit) | 18* |

*Asumsi: 90 menit ujian ÷ 5 menit sync = 18 requests (OPTIMIZED dari 180!)

**Subtotal Phase 3:** 58 requests

> **⚡ OPTIMASI CLIENT-SIDE TIMER:**
> - Countdown berjalan di browser (JavaScript)
> - Server sync hanya setiap 5 menit (bukan 30 detik)
> - Validasi final tetap di server saat submit
> - **Penghematan: 162 requests per siswa per ujian (90%)**

### Phase 4: Submit & Hasil
| No | Endpoint | Method | Deskripsi | Request/User |
|----|----------|--------|-----------|--------------|
| 8 | `/api/siswa/ujian/[id]/submit` | POST | Submit ujian | 1 |
| 9 | `/api/siswa/ujian/[id]/hasil` | GET | Lihat hasil | 1 |

**Subtotal Phase 4:** 2 requests

---

## 📈 Total Request per User per Ujian

| Phase | Requests (Before) | Requests (After Optimization) |
|-------|-------------------|-------------------------------|
| Login & Validasi | 3 | 3 |
| Load Ujian | 2 | 2 |
| Mengerjakan (40 soal + polling) | 220 | **58** |
| Submit & Hasil | 2 | 2 |
| **TOTAL per Ujian** | **227** | **65** |

> ✅ **Penghematan: 162 requests per siswa per ujian (71% lebih efisien)**

---

## 🔢 Kalkulasi Total (1,000 User × 12 Ujian)

### Skenario A: Semua User Mengerjakan Bersamaan

```
SEBELUM OPTIMASI:
Total Requests = 1,000 users × 12 ujian × 227 requests
              = 2,724,000 requests

SETELAH OPTIMASI (Client-side Timer):
Total Requests = 1,000 users × 12 ujian × 65 requests
              = 780,000 requests

PENGHEMATAN = 1,944,000 requests (71% lebih efisien!)
```

### Distribusi Request per Menit (Peak Load)

Asumsi: 1,000 user mengerjakan 1 ujian bersamaan selama 90 menit

| Tipe Request | Before | After Optimization |
|--------------|--------|-------------------|
| **Save Answer** | 444/menit (~7.4/detik) | 444/menit (~7.4/detik) |
| **Time Polling** | 2,000/menit (~33.3/detik) | **200/menit (~3.3/detik)** |
| **Session Check** | ~100/menit (~1.7/detik) | ~100/menit (~1.7/detik) |
| **TOTAL PEAK** | **~2,544/menit (~42.4/detik)** | **~744/menit (~12.4/detik)** |

### Peak Concurrent Requests

```
SEBELUM OPTIMASI:
Peak RPS = ~42-50 requests/detik
Peak RPM = ~2,500-3,000 requests/menit

SETELAH OPTIMASI (Client-side Timer):
Peak RPS = ~12-15 requests/detik
Peak RPM = ~700-900 requests/menit

PENGHEMATAN PEAK LOAD = ~70% lebih ringan!
```

---

## 💾 Database Load

### Query per Request

| Endpoint | Queries/Request | Complexity |
|----------|-----------------|------------|
| `save-answer` | 4-6 queries | Medium (transaction) |
| `time-remaining` | 2-3 queries | Low |
| `ujian/[id]` | 3-5 queries | Medium (includes soal) |
| `submit` | 5-10 queries | High (transaction) |

### Estimasi Database Connections

```
Peak Concurrent DB Connections = Peak RPS × Avg Query Time
                               = 50 × 0.1s (100ms avg)
                               = 5 concurrent connections (minimum)

Recommended Pool Size = Peak × 2 (buffer)
                      = 10-20 connections
```

### Database Write Operations (1,000 User × 1 Ujian)

| Operation | Count |
|-----------|-------|
| INSERT JawabanSoal | 40,000 (40 soal × 1,000 user) |
| UPDATE JawabanSoal | ~80,000 (avg 2 revisi per soal) |
| INSERT UjianSubmission | 1,000 |
| UPDATE UjianSubmission | 1,000 |
| **TOTAL WRITES** | **~122,000** |

---

## 🌐 Bandwidth Estimation

### Request Size

| Endpoint | Request Size | Response Size |
|----------|--------------|---------------|
| `save-answer` | ~500 bytes | ~200 bytes |
| `time-remaining` | ~100 bytes | ~300 bytes |
| `ujian/[id]` | ~100 bytes | ~50-100 KB (40 soal) |
| `submit` | ~2-5 KB | ~1 KB |

### Total Bandwidth per Ujian (1,000 User)

```
Load Ujian: 1,000 × 100 KB = 100 MB
Save Answers: 1,000 × 40 × 700 bytes = 28 MB
Time Polling: 1,000 × 180 × 400 bytes = 72 MB
Submit: 1,000 × 6 KB = 6 MB

TOTAL per Ujian = ~206 MB
TOTAL 12 Ujian = ~2.5 GB
```

---

## ☁️ Rekomendasi Cloud/Server

### Option 1: Vercel (Recommended for Simplicity)

| Tier | Specs | Capacity | Cost |
|------|-------|----------|------|
| **Hobby (Free)** | 100GB bandwidth, Edge Functions | ~500 concurrent users | $0 |
| **Pro** | 1TB bandwidth, Priority Edge | ~2,000 concurrent users | $20/month |
| **Enterprise** | Unlimited, Dedicated | 10,000+ concurrent users | Custom |

**Verdict:** Pro tier cukup untuk 1,000 concurrent users

### Option 2: Cloudflare Workers + Pages

| Tier | Specs | Capacity | Cost |
|------|-------|----------|------|
| **Free** | 100K req/day, 3MB worker | ❌ Bundle terlalu besar | $0 |
| **Paid** | 10M req/month, 10MB worker | ❌ Bundle 18MB | $5/month |

**Verdict:** ❌ Tidak cocok - bundle size melebihi limit

### Option 3: Self-Hosted VPS

| Provider | Specs | Capacity | Cost |
|----------|-------|----------|------|
| **DigitalOcean** | 4 vCPU, 8GB RAM | ~1,500 concurrent | $48/month |
| **AWS EC2** | t3.large (2 vCPU, 8GB) | ~1,000 concurrent | ~$60/month |
| **Hetzner** | CPX31 (4 vCPU, 8GB) | ~1,500 concurrent | €15/month |

**Verdict:** Hetzner paling cost-effective untuk self-hosted

### Option 4: Railway / Render

| Tier | Specs | Capacity | Cost |
|------|-------|----------|------|
| **Railway Pro** | Auto-scaling | ~2,000 concurrent | ~$20-50/month |
| **Render** | Auto-scaling | ~1,500 concurrent | ~$25/month |

---

## 🗄️ Database Recommendations

### Neon (Current - Serverless PostgreSQL)

| Tier | Specs | Capacity | Cost |
|------|-------|----------|------|
| **Free** | 0.5GB storage, 1 compute | ~500 concurrent | $0 |
| **Launch** | 10GB storage, auto-scale | ~2,000 concurrent | $19/month |
| **Scale** | 50GB storage, dedicated | 5,000+ concurrent | $69/month |

**Verdict:** Launch tier untuk 1,000 concurrent users

### Alternative: Supabase

| Tier | Specs | Capacity | Cost |
|------|-------|----------|------|
| **Free** | 500MB, 50K requests | ~200 concurrent | $0 |
| **Pro** | 8GB, unlimited | ~3,000 concurrent | $25/month |

---

## 📋 Recommended Stack untuk 1,000 Concurrent Users

### Budget Option (~$20-40/month)

```
┌─────────────────────────────────────────┐
│           RECOMMENDED STACK             │
├─────────────────────────────────────────┤
│ Frontend + API: Vercel Pro      $20/mo  │
│ Database: Neon Launch           $19/mo  │
│ Storage: Cloudflare R2          ~$1/mo  │
│ Email: Resend Free              $0      │
├─────────────────────────────────────────┤
│ TOTAL                          ~$40/mo  │
└─────────────────────────────────────────┘
```

### Performance Option (~$70-100/month)

```
┌─────────────────────────────────────────┐
│         HIGH PERFORMANCE STACK          │
├─────────────────────────────────────────┤
│ Frontend + API: Vercel Pro      $20/mo  │
│ Database: Neon Scale            $69/mo  │
│ Storage: Cloudflare R2          ~$5/mo  │
│ CDN: Cloudflare Pro             $20/mo  │
├─────────────────────────────────────────┤
│ TOTAL                         ~$114/mo  │
└─────────────────────────────────────────┘
```

### Self-Hosted Option (~$30-50/month)

```
┌─────────────────────────────────────────┐
│           SELF-HOSTED STACK             │
├─────────────────────────────────────────┤
│ VPS: Hetzner CPX31              €15/mo  │
│ Database: Managed PostgreSQL    €10/mo  │
│ Storage: Hetzner Object Storage €5/mo   │
├─────────────────────────────────────────┤
│ TOTAL                          ~€30/mo  │
└─────────────────────────────────────────┘
```

---

## ⚡ Optimizations untuk High Load

### 1. Rate Limiting (Already Implemented)
```typescript
// save-answer: 1 request per 2 seconds per question
const rateLimitKey = `${siswa.id}-${questionId}`;
```

### 2. Reduce Polling Frequency
```typescript
// Current: 30 seconds
// Recommended for high load: 60 seconds
const POLLING_INTERVAL = 60000; // 60 seconds
```

### 3. Batch Save Answers
```typescript
// Instead of saving each answer individually,
// batch save every 5 answers or every 30 seconds
PUT /api/siswa/ujian/[id]/save-answer
{ answers: [...] }
```

### 4. Connection Pooling
```typescript
// Neon serverless with connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
});
```

### 5. CDN for Static Assets
- Enable Vercel Edge Network
- Cache static pages
- Use Cloudflare for additional caching

---

## 📊 Monitoring Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|----------|
| Response Time (p95) | > 500ms | > 2000ms |
| Error Rate | > 1% | > 5% |
| Database Connections | > 80% pool | > 95% pool |
| Memory Usage | > 70% | > 90% |
| CPU Usage | > 70% | > 90% |

---

## 🎯 Kesimpulan

Untuk **1,000 concurrent users** dengan **12 ujian × 40 soal**:

1. **Total Requests:** ~2.7 juta requests selama periode ujian
2. **Peak Load:** ~50 requests/detik
3. **Bandwidth:** ~2.5 GB total
4. **Database Writes:** ~122,000 per ujian

**Rekomendasi:**
- **Vercel Pro + Neon Launch** (~$40/bulan) - Paling mudah dan reliable
- Atau **Hetzner + Self-managed** (~€30/bulan) - Paling hemat tapi perlu maintenance

---

*Dokumentasi ini dibuat untuk membantu perencanaan infrastruktur aplikasi ujian online.*
