# PROMPT — Migrasi KPI Dashboard ke GIANT APPS

> **Cara pakai:** Berikan dokumen ini utuh ke AI coding assistant atau programmer.
> Dokumen memuat seluruh fitur, aturan bisnis, dan rumus dari dashboard KPI yang sudah berjalan,
> beserta pemetaannya ke arsitektur GIANT Apps.

---

# 0. KONTEKS & TUJUAN

## 0.1 Apa yang dipindahkan

Ada dashboard KPI berbasis HTML satu file yang **sudah berjalan** di `analytics-akses-legal.vercel.app`. Dashboard ini membaca CSV dari beberapa Google Spreadsheet dan menampilkan KPI untuk Divisi Admin, CS, Desain, Finance, dan sebaran klien.

Tugasnya: **membangun ulang seluruh fungsi itu sebagai modul di dalam GIANT Apps**, dengan sumber data PostgreSQL, bukan Google Sheets.

## 0.2 Perbedaan mendasar yang harus dipahami

| | Dashboard sekarang | Di GIANT Apps |
|---|---|---|
| Sumber data | CSV Google Sheets (gviz) | PostgreSQL via Prisma |
| Perhitungan | Seluruhnya di browser | Di server (API), browser hanya menampilkan |
| Kesegaran data | Fetch tiap 5 menit | Real-time / on-demand |
| Identitas lead | Nomor HP + nama perusahaan (rawan) | `job_id` / `client_id` (pasti) |
| Riwayat skor | Tab `LOG_SKOR` di spreadsheet | Tabel event di database |
| Autentikasi | Tidak ada (PIN hanya untuk Finance) | Auth.js v5 + role/permission |

⚠️ **Jangan menyalin arsitektur lama.** Dashboard lama menghitung semuanya di browser karena terpaksa — sumbernya CSV. Di GIANT, perhitungan harus di server agar tidak mengirim seluruh riwayat ke klien.

## 0.3 Tech stack yang dipakai

```
Framework      Next.js 16 (App Router) + React 19 + TypeScript
Styling        Tailwind CSS v4  (+ Base UI / Radix UI)
Ikon           lucide-react
API            Hono
Database       PostgreSQL + Prisma
Auth           Auth.js / NextAuth v5
Deploy         Docker
Aplikasi       ali-app
```

**Grafik:** dashboard lama memakai Chart.js 4. Boleh dipertahankan (`react-chartjs-2`) atau diganti Recharts/Visx — bebas, asalkan mendukung: bar bertumpuk, kombinasi bar+garis dua sumbu, doughnut, garis area, dan gauge setengah lingkaran.

---

# 1. STRUKTUR HALAMAN

Dashboard punya **7 halaman**. Semua berbagi satu filter rentang tanggal global di kanan atas.

```
DIVISI ADMIN
├── Overview Admin
├── Per Orang
├── Per Divisi
└── Desain

DIVISI CS
└── Data CS          ← 4 sub-tab di dalamnya

KEUANGAN
└── Finance          ← terkunci PIN

DATA KLIEN
└── Data Goal        ← peta sebaran
```

## 1.1 Filter global

Terletak di header, berlaku untuk **semua halaman**:

- **Rentang tanggal** — dropdown dengan preset: Hari ini, Kemarin, Minggu ini, Bulan ini, Kuartal ini, Tahun ini, 7/14/30/90 hari terakhir, Semua tanggal. Plus isian manual dari–sampai.
- **Filter divisi** — hanya tampil di halaman Overview, Per Orang, Per Divisi.

---

# 2. MODEL DATA — PEMETAAN

## 2.1 Dari mana data berasal sekarang

| Sumber sekarang | Isi | Jadi apa di GIANT |
|---|---|---|
| Spreadsheet CS × 4, tab `LOG_SKOR` | Riwayat perubahan skor lead | Tabel `LeadScoreEvent` |
| Spreadsheet CS × 4, tab `LOG_BAYAR` | Riwayat status & nominal bayar | Tabel `PaymentEvent` |
| Spreadsheet CS × 4, tab `LOG_FU` | Riwayat follow-up harian | Tabel `FollowUpEvent` |
| Spreadsheet CS × 4, tab `export_kpi` | Rekap bulanan manual | ⚠️ **Dihapus** — lihat 2.4 |
| `LIST KERJAAN` (3 tab admin) | Pekerjaan admin bulan berjalan | Tabel `Task` / `Job` |
| `ARSIP KERJAAN` | Pekerjaan admin bulan lalu | Tabel yang sama (tidak perlu arsip terpisah) |
| `LIST KERJAAN` tab `Desain` | Order desain | Tabel `Job` (kategori Desain) |
| Spreadsheet FINANCE | Kas harian & rekap bulanan | Tabel `FinanceEntry` |
| Spreadsheet GOAL | Lokasi klien | Field di tabel `Client` |

## 2.2 Skema Prisma yang dibutuhkan

```prisma
// ─────────── LEAD SCORING (CS) ───────────

model LeadScoreEvent {
  id           String   @id @default(cuid())
  jobId        String                    // ⚠️ BUKAN nomor HP
  job          Job      @relation(fields: [jobId], references: [id])
  csUserId     String
  cs           User     @relation(fields: [csUserId], references: [id])
  scoreBefore  Int?                      // null = lead baru / baseline
  scoreAfter   Int                       // 1..7
  direction    ScoreDirection
  step         Int?                      // scoreAfter - scoreBefore
  activity     String?                   // catatan CS
  followUpDate DateTime?                 // TGL FU
  occurredAt   DateTime                  // tanggal kejadian
  createdAt    DateTime @default(now())

  @@index([jobId, occurredAt])
  @@index([csUserId, occurredAt])
}

enum ScoreDirection {
  NAIK
  FINISH
  MATI
  AKTIF_KEMBALI
  TURUN
  LEAD_BARU
  BASELINE          // hanya untuk migrasi data lama
}

// ─────────── PEMBAYARAN ───────────

model PaymentEvent {
  id             String   @id @default(cuid())
  orderId        String                  // ⚠️ melekat ke ORDER, bukan JOB
  order          Order    @relation(fields: [orderId], references: [id])
  csUserId       String?
  statusBefore   PaymentStatus?
  statusAfter    PaymentStatus
  amountBefore   Decimal? @db.Decimal(15,2)
  amountAfter    Decimal  @db.Decimal(15,2)
  amountIn       Decimal  @db.Decimal(15,2)   // selisih = uang masuk hari itu
  price          Decimal? @db.Decimal(15,2)   // harga total
  direction      PaymentDirection
  occurredAt     DateTime
  createdAt      DateTime @default(now())

  @@index([orderId, occurredAt])
}

enum PaymentStatus { BELUM_BAYAR  DP  LUNAS }

enum PaymentDirection {
  DP_MASUK
  TERMIN
  CLOSING
  LAYANAN_TAMBAH
}

// ─────────── FOLLOW-UP ───────────

model FollowUpEvent {
  id           String   @id @default(cuid())
  jobId        String
  csUserId     String
  scoreAtTime  Int?
  activity     String?
  followUpDate DateTime?
  raisedScore  Boolean  @default(false)  // apakah FU ini juga menaikkan skor
  occurredAt   DateTime
  createdAt    DateTime @default(now())

  @@index([jobId, occurredAt])
  @@index([csUserId, occurredAt])
}
```

## 2.3 ⚠️ Aturan wajib yang lahir dari bug nyata

```
1. IDENTITAS PEKERJAAN
   Sistem lama mengenali lead dari nomor HP saja. Satu klien punya dua
   pekerjaan berbeda (PT Analan Rp3.999.000 dan PT Orum Rp8.220.000) —
   sistem menggabungkannya, uang masuk 8,2jt terbaca 4,2jt.

   → Di GIANT: SELALU pakai jobId / orderId. Nomor HP hanya atribut Client.

2. UANG MASUK = SELISIH, BUKAN NOMINAL
   DP 2,5jt lalu lunas 5jt → uang masuk saat closing = 2,5jt, bukan 5jt.
   Kalau dihitung penuh, total jadi 7,5jt padahal aslinya 5jt.

   → amountIn = amountAfter - (amountBefore ?? 0)

3. DP DAN PELUNASAN ADALAH DUA BARIS
   Keduanya peristiwa uang nyata dan punya tanggal berbeda.
   Jangan menimpa baris DP saat pelunasan masuk.

4. CLOSING TIDAK BOLEH GANDA
   Kalau order sudah pernah LUNAS dengan nominal ≥ nominal sekarang,
   status LUNAS yang muncul lagi BUKAN closing baru.

   → Di GIANT masalah ini hilang sendiri karena status pembayaran
     adalah state di tabel Order, bukan hasil membaca ulang spreadsheet.
```

## 2.4 ⚠️ `export_kpi` dihapus, jangan dibawa

Dashboard lama punya **dua sumber keuangan CS** yang sering memberi angka berbeda:

- `LOG_BAYAR` — otomatis, akurat, tapi baru mulai mencatat sejak skrip dipasang
- `export_kpi` — rekap bulanan manual, sudah lebih lama tapi rawan salah ketik

Sampai perlu kotak penjelasan khusus di dashboard: *"kenapa angkanya beda"*.

**Di GIANT ini tidak boleh ada.** Satu sumber kebenaran: tabel `PaymentEvent`. Halaman "Keuangan per CS" yang lama (berbasis `export_kpi`) **tidak dipindahkan** — datanya digantikan oleh agregasi `PaymentEvent`.

---

# 3. KONSTANTA & ATURAN BISNIS

Semua nilai ini **wajib sama persis** dengan sistem sekarang. Simpan di satu file konstanta bersama, jangan disebar.

## 3.1 Sistem Skor Lead (1–7)

```typescript
export const SKOR = {
  1: { nama: 'Cool',   warna: '#3b82f6', bg: '#dbeafe', teks: '#1e40af' },
  2: { nama: 'Warm',   warna: '#f59e0b', bg: '#fef3c7', teks: '#92400e' },
  3: { nama: 'Hot',    warna: '#ea580c', bg: '#ffedd5', teks: '#9a3412' },
  4: { nama: 'Deal',   warna: '#8b5cf6', bg: '#ede9fe', teks: '#5b21b6' },
  5: { nama: 'Proses', warna: '#0891b2', bg: '#cffafe', teks: '#155e75' },
  6: { nama: 'Finish', warna: '#15803d', bg: '#dcfce7', teks: '#14532d' },
  7: { nama: 'Dorman', warna: '#94a3b8', bg: '#f1f5f9', teks: '#475569' },
} as const;
```

⚠️ **Aturan warna yang tidak boleh diubah:**

> **Merah murni dipesan KHUSUS untuk arah `MATI`.**
> Karena itu skor 3 (Hot) memakai **oranye**, bukan merah — supaya "panas" dan "mati" tidak pernah tertukar di mata pembaca.

⚠️ **Skor 7 bukan puncak tangga.** Skor 6 (Finish) adalah puncak. Skor 7 (Dorman) adalah **keluar dari tangga** — lead berhenti merespon. Jangan pernah menghitung `7 > 6` sebagai kemajuan.

**Label tampilan:** `Skor 3 (Hot)` — angka jadi identitas utama, nama hanya keterangan dalam kurung. Versi pendek untuk sumbu grafik: `3 (Hot)`.

## 3.2 Arah pergerakan skor

```typescript
export const ARAH = {
  NAIK:          { warna: '#15803d', label: 'Naik' },
  FINISH:        { warna: '#065f46', label: 'Finish' },
  AKTIF_KEMBALI: { warna: '#0891b2', label: 'Aktif kembali' },
  LEAD_BARU:     { warna: '#3b82f6', label: 'Lead baru' },
  TURUN:         { warna: '#f59e0b', label: 'Turun' },
  MATI:          { warna: '#b91c1c', label: 'Mati' },
} as const;

export const ARAH_POSITIF = ['NAIK', 'FINISH', 'AKTIF_KEMBALI'];
```

**Cara menentukan arah — urutan pemeriksaan WAJIB seperti ini:**

```typescript
function tentukanArah(lama: number | null, baru: number): ScoreDirection {
  if (baru === 7)          return 'MATI';           // ⚠️ diperiksa DULUAN
  if (lama === null)       return 'LEAD_BARU';
  if (baru === 6)          return 'FINISH';
  if (lama === 7)          return 'AKTIF_KEMBALI';
  if (baru > lama)         return 'NAIK';
  if (baru < lama)         return 'TURUN';
  return 'TETAP';
}
```

⚠️ **Kenapa `MATI` diperiksa paling awal:** `3 → 7` angkanya naik, tapi artinya lead mati. Kalau urutan dibalik, lead mati akan terhitung sebagai kemajuan.

⚠️ **`7 → 6` adalah `FINISH`, bukan `AKTIF_KEMBALI`.** Lead yang bangkit dari dorman langsung ke Finish berarti benar-benar selesai.

## 3.3 Ambang Lead Mandek

Dari SOP — berapa hari sebuah lead boleh diam di satu skor:

```typescript
export const MANDEK_AMBANG: Record<number, number> = {
  1: 8,   // Cool
  2: 8,   // Warm
  3: 3,   // Hot — paling ketat, SOP menyebutnya prioritas utama
  4: 4,   // Deal
  5: 2,   // Proses — paling ketat kedua, sudah dibayar
  // 6 (Finish) & 7 (Dorman) tidak dihitung mandek
};
```

## 3.4 Jendela konversi

```typescript
export const KONVERSI_JENDELA = 7; // hari
```

## 3.5 Normalisasi status pekerjaan Admin

Status di spreadsheet ditulis bebas oleh admin. Harus dipetakan ke 3 status baku:

```typescript
function normalisasiStatus(raw: string): 'Done' | 'On Progress' | 'Pending' {
  const s = raw.toUpperCase().trim();
  if (!s) return 'Pending';
  if (/FINISH|SELESAI|DONE|TERBIT|LUNAS|SIAP KIRIM|BERHASIL|^OK$/.test(s))
    return 'Done';
  if (/^LIST$|EROR|ERROR|MINUS|TO BE CONFIRM|MENUN|BELUM|NIHIL|HOLD|BATAL|ANTRI|GAGAL|TOLAK|PENDING/.test(s))
    return 'Pending';
  if (/DOING|PROSES|VERIF|PKKPR|AMDAL|WAIT|REVIEW|CEK|PROGRESS|DRAFT|PENGAJUAN|CONFIRM|BUTUH|ON GOING/.test(s))
    return 'On Progress';
  return 'On Progress';
}
```

⚠️ Fungsi ini dibutuhkan **hanya saat migrasi data lama**. Di GIANT, status adalah enum yang dipilih dari dropdown — tidak ada teks bebas lagi.

**Label tampilan:**
```
Done         → FINISH   (#15803d)
On Progress  → DOING    (#f59e0b)
Pending      → LIST     (#cbd5e1)
```

---

# 4. RUMUS PERHITUNGAN

Ini bagian paling penting. Setiap rumus di bawah sudah teruji di sistem berjalan — **jangan disederhanakan**.

## 4.1 Kondisi lead saat ini

Kondisi terakhir tiap lead = hasil **memutar ulang seluruh riwayat** secara berurutan, bukan mengambil baris terakhir saja.

```typescript
function kondisiSekarang(events: LeadScoreEvent[]) {
  const state = new Map<string, LeadState>();
  events
    .sort((a, b) => a.occurredAt - b.occurredAt || a.id - b.id)
    .forEach(e => {
      const prev = state.get(e.jobId);
      state.set(e.jobId, {
        jobId: e.jobId,
        csUserId: e.csUserId,
        skor: e.scoreAfter,
        tglUbah: e.occurredAt,
        arah: e.direction,
        // pertahankan nilai lama bila event ini tidak membawanya
        aktivitas: e.activity ?? prev?.aktivitas,
        followUpDate: e.followUpDate ?? prev?.followUpDate,
      });
    });
  return [...state.values()];
}
```

## 4.2 Lead mandek — berapa lama diam

⚠️ **Ini rumus dengan sejarah.** Baris `BASELINE` (foto kondisi awal saat sistem dipasang) selalu bertanggal hari perekaman. Kalau tanggal itu dipakai apa adanya, **tidak akan pernah ada lead yang terhitung mandek** — dashboard berbohong di hari pertama.

Solusinya: untuk lead yang belum pernah berubah sejak baseline, pakai `followUpDate` dari sheet sebagai perkiraan terbaik.

```typescript
function tanggalAcuanDiam(k: LeadState): Date {
  if (k.arah === 'BASELINE' && k.followUpDate && k.followUpDate <= hariIni())
    return k.followUpDate;
  return k.tglUbah;
}

function lamaDiam(k: LeadState): number {
  return selisihHari(tanggalAcuanDiam(k), hariIni());
}

function apakahMandek(k: LeadState): boolean {
  const ambang = MANDEK_AMBANG[k.skor];
  if (!ambang) return false;              // skor 6 & 7 tidak dihitung
  return lamaDiam(k) >= ambang;
}
```

**Di UI:** lead yang tanggalnya berasal dari `followUpDate` diberi chip `≈ TGL FU`, supaya pembaca tahu itu perkiraan, bukan hasil pengukuran.

⚠️ **Untuk GIANT:** setelah data lama dimigrasi, `BASELINE` tidak akan pernah muncul lagi. Tapi logikanya tetap harus ada agar data historis terbaca benar.

## 4.3 Komposisi skor harian

Berapa lead berada di tiap skor, hari demi hari — untuk grafik batang bertumpuk.

```typescript
function komposisiHarian(events: LeadScoreEvent[]) {
  const urut = events.sort(byWaktu);
  if (!urut.length) return [];

  const mulai = urut[0].occurredAt;
  const akhir = max(urut.at(-1).occurredAt, hariIni());

  const state = new Map<string, number>();   // jobId → skor
  const hasil = [];
  let i = 0;

  for (let d = mulai; d <= akhir; d = tambahHari(d, 1)) {
    // terapkan semua event sampai tanggal d
    while (i < urut.length && urut[i].occurredAt <= d) {
      state.set(urut[i].jobId, urut[i].scoreAfter);
      i++;
    }
    const cnt = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 };
    state.forEach(s => { if (cnt[s] !== undefined) cnt[s]++; });
    hasil.push({ tgl: d, cnt });
  }
  return hasil;
}
```

**Di UI:** skor 6 dan 7 **disembunyikan secara default** (klik legenda untuk menampilkan). Alasannya: keduanya akumulatif dan terus bertambah, sehingga menutupi cerita prospek yang sedang berjalan.

## 4.4 Konversi antar skor

Dari lead yang masuk ke skor X, berapa persen naik ke skor berikutnya dalam 7 hari.

```typescript
function konversi(events: LeadScoreEvent[], dari: number, jendela: number) {
  const perJob = groupBy(events.sort(byWaktu), e => e.jobId);
  let denom = 0, num = 0;

  perJob.forEach(list => {
    const i = list.findIndex(e => e.scoreAfter === dari);
    if (i === -1) return;

    const t0 = list[i].occurredAt;
    const umur = selisihHari(t0, hariIni());

    // ⚠️ KEADILAN: lead yang belum genap `jendela` hari TIDAK DIHITUNG.
    // Mereka belum punya kesempatan penuh — memasukkannya akan
    // menekan angka CS secara tidak adil.
    if (umur < jendela) return;

    denom++;
    const batas = tambahHari(t0, jendela);
    const naik = list.slice(i + 1).some(
      e => e.occurredAt <= batas && e.scoreAfter > dari && e.scoreAfter !== 7
    );
    if (naik) num++;
  });

  return { denom, num, rate: denom ? Math.round(num / denom * 100) : 0 };
}
```

⚠️ Perhatikan `e.scoreAfter !== 7` — naik ke Dorman **bukan** konversi berhasil.

**Di UI:** kalau `denom === 0`, tampilkan `—` dengan keterangan *"belum cukup data"*, jangan `0%`. Nol persen dan belum-ada-data adalah dua hal berbeda.

## 4.5 Kecepatan naik level

Median hari yang dibutuhkan untuk naik satu skor.

```typescript
function kecepatan(events: LeadScoreEvent[]) {
  const perJob = groupBy(events.sort(byWaktu), e => e.jobId);
  const bucket: Record<number, number[]> = { 1:[], 2:[], 3:[], 4:[], 5:[] };

  perJob.forEach(list => {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i-1], cur = list[i];
      if (!ARAH_POSITIF.includes(cur.direction)) continue;
      if (cur.direction === 'AKTIF_KEMBALI') continue;   // bukan kemajuan normal
      const dari = prev.scoreAfter;
      if (!bucket[dari]) continue;
      const hari = selisihHari(prev.occurredAt, cur.occurredAt);
      if (hari >= 0) bucket[dari].push(hari);
    }
  });

  return mapValues(bucket, median);
}
```

## 4.6 ⚠️ Normalisasi per 100 lead aktif

**Ini rumus keadilan yang paling penting di seluruh dashboard.**

```typescript
function per100(nilai: number, leadAktif: number): number {
  return leadAktif > 0 ? Math.round(nilai / leadAktif * 1000) / 10 : 0;
}
```

**Kenapa wajib ada:** jumlah mentah menyesatkan. Contoh nyata dari pengujian:

| CS | Lead aktif | Kenaikan | Per 100 lead |
|---|---|---|---|
| Julia | 412 | 31 | 7,5 |
| Devi | 286 | 24 | 8,4 |
| Dewi | 198 | 22 | 11,1 |
| Dedes | 96 | 14 | **14,6** |

```
Peringkat jumlah mentah : Julia > Devi > Dewi > Dedes
Peringkat per 100 lead  : Dedes > Dewi > Devi > Julia   ← TERBALIK TOTAL
```

Dedes juru kunci pada hitungan mentah, tapi **teratas** setelah dibagi bebannya. Kalau Bos menilai dari jumlah mentah, orang yang paling produktif justru ditegur.

**Lead aktif = lead dengan skor 1–5** (di luar Finish dan Dorman).

## 4.7 Uang masuk

```typescript
// Per peristiwa
amountIn = amountAfter - (amountBefore ?? 0)

// Total pada rentang
totalUangMasuk = sum(paymentEvents.map(e => e.amountIn))

// Total closing
totalClosing = paymentEvents.filter(e => e.direction === 'CLOSING').length
```

⚠️ **Jangan pernah menjumlahkan `amountAfter`.** Itu akan menghitung uang yang sama berkali-kali.

---

# 5. SPESIFIKASI HALAMAN

## 5.1 Halaman: Overview Admin

### KPI Utama (4 kartu)
```
📝 Total Pekerjaan        + delta % vs bulan lalu
✅ Tingkat Penyelesaian   + delta % vs bulan lalu
⚙️ DOING (dikerjakan)     + delta (turun = baik)
⏳ LIST (antri)           + delta (turun = baik)
```

### Target vs Realisasi
- **Gauge setengah lingkaran** — % penyelesaian vs target
  - Target dapat diatur lewat slider (50–100%), **default 85%**, tersimpan per pengguna
  - Warna: `≥ target` hijau · `≥ target-15` amber · sisanya merah
  - Angka besar di tengah + selisih vs target
- **Daftar pencapaian per divisi** — bar horizontal dengan penanda garis target

### Sinyal Utama (4 kartu)
```
🏆 Divisi performa terbaik      (% selesai tertinggi)
⚠️ Divisi perlu perhatian       (% selesai terendah)
🔥 Beban kerja tertinggi        (orang dengan tugas terbanyak)
🐢 Bottleneck terbesar          (divisi dengan tugas belum selesai terbanyak)
```

### Grafik
1. **Volume & penyelesaian per divisi** — kombinasi: batang = jumlah tugas, garis = % selesai (dua sumbu)
2. **Beban kerja per orang** — batang bertumpuk per status
3. **Tren pekerjaan harian** — garis area
4. **Distribusi kategori** — doughnut

### Tabel
1. **Bottleneck** — tugas belum selesai, diurut dari yang paling lama. Kolom: Umur (pil berwarna: ≥14 hari merah, ≥7 amber), Tanggal, Nama, Divisi, Nama Kerjaan, Kategori, Status
2. **Rekap harian karyawan** — dengan kotak pencarian

## 5.2 Halaman: Per Orang

### Leaderboard
Dua mode: **Selesai terbanyak** / **% tertinggi**. Kolom: peringkat (🥇🥈🥉 untuk 3 teratas), Nama, Divisi, Total, FINISH, bar Completion, delta vs bulan lalu.

### Kartu karyawan
Grid kartu — avatar inisial berwarna, nama, divisi, bar progres, statistik (total / selesai / %). Klik untuk membuka detail.

### Detail per orang
```
Statistik   Total · FINISH · DOING · LIST · Completion
Grafik      Doughnut status
            Kombinasi kategori (batang jumlah + garis % selesai)
            Tren harian
Tabel       Detail kerjaan + pencarian
```

## 5.3 Halaman: Per Divisi

### Kartu divisi
Per divisi: nama, badge % finish (hijau ≥80, amber ≥60, merah sisanya), jumlah tugas, jumlah orang, bar progres, rincian FINISH/DOING/LIST.

### Heatmap Kategori × Divisi
- Dua mode: **Volume** / **% Selesai**
- Sel makin pekat = makin banyak. Ada baris & kolom Total.
- Kolom nama kategori **sticky** saat digulir horizontal
- Tooltip: `Kategori · Divisi: N tugas` atau `X/Y selesai`

### Status per divisi
Batang bertumpuk FINISH/DOING/LIST.

## 5.4 Halaman: Desain

```
KPI      🎨 Total Order · ✅ FINISH · ⚙️ DOING · ⏳ LIST
Grafik   Doughnut status
         Batang horizontal jenis order
         Batang bertumpuk status per jenis order
Tabel    Detail pekerjaan desain (dengan kolom Link yang bisa diklik)
```

## 5.5 Halaman: Data CS — 4 SUB-TAB

Di atas sub-tab: **legenda skor 1–7** dan **4 kartu KPI**:
```
🎯 Lead Aktif (skor 1–5)
⬆️ Kenaikan Skor          (+ berapa di antaranya Finish)
🐢 Lead Mandek            (melewati ambang SOP)
💀 Lead Mati (→ Dorman)
```

---

### SUB-TAB 1 — 📓 Jurnal Harian

**Tujuan:** menggantikan rekap notepad yang selama ini ditulis manual oleh CS.

#### Filter rentang tanggal
Dari–sampai, plus preset: Hari ini · Kemarin · Minggu ini · Bulan ini · Semua. Default: hari ini.

#### Kalimat otomatis
Kotak teks yang **dirakit sendiri oleh sistem**, bukan grafik:

> *"Pada **Jumat, 10 Juli 2026**, 3 CS mencatat total **36** aktivitas. **21** lead berhasil dinaikkan skornya, dan **2** deal berhasil di-closing. Uang masuk hari itu **Rp5.000.000**. Kontributor terbanyak: **Julia** (11 pergerakan positif). **7 lead ditandai mati** — perlu ditinjau apakah bisa diselamatkan."*
>
> *⚠️ Saat ini ada **5** lead Hot yang sudah melewati batas diam — sebaiknya diprioritaskan hari ini.*

Aturan penyusunan:
```
1. Selalu: tanggal, jumlah CS, total aktivitas
2. Bila ada kenaikan     → sebutkan, gabung dengan closing bila ada
3. Bila ada uang masuk   → sebutkan totalnya
4. Kontributor terbanyak → kenaikan + closing, hanya bila > 0
5. Bila ada lead mati    → sebutkan dengan warna merah
6. Peringatan lead Hot mandek → selalu dicek, terpisah dari tanggal jurnal
```

#### Kartu ringkas per CS
Avatar, nama, jumlah aktivitas, skor naik, closing, uang masuk.

#### Tabel rincian aktivitas
Gabungan event skor dan bayar, diurut per tanggal lalu per CS.
Kolom: Jenis (titik berwarna: skor/bayar) · CS · Nama Perusahaan · Kejadian (badge `3 (Hot) → 4 (Deal)` atau `closing (Lunas)`) · Nominal Masuk · Aktivitas.

#### 🔁 Follow-up Hari Ini
**Menjawab pertanyaan yang tidak bisa dijawab log skor:** *"CS follow-up siapa saja hari ini, walau skornya belum naik."*

```
Kartu per CS   → berapa follow-up, berapa berhasil naik, berapa belum
Tabel          → CS · Nama Perusahaan · Skor · Hasil · Aktivitas · TGL FU
                 Hasil: badge "✔ skor naik" (hijau) / "follow-up saja" (abu)
```

⚠️ **Dua tanggal yang mudah tertukar** — beri penjelasan di UI:
- **Tanggal jurnal** = hari CS melakukan follow-up
- **Kolom TGL FU** = tanggal follow-up berikutnya yang dijadwalkan

#### 💰 Closing & Uang Masuk
```
KPI      ✅ Total Closing · 💵 Total Uang Masuk · 🧾 DP Masuk · 📊 Rata-rata per Transaksi
Grafik   Closing per hari (batang hijau)
         Uang masuk per hari (batang cyan)
         Closing & uang masuk per CS (kombinasi batang + garis)
```

---

### SUB-TAB 2 — 📈 Prospek

```
Komposisi Prospek per Hari
  Batang bertumpuk, warna = skor. Skor 6 & 7 tersembunyi default.
  Narasi: "kalau kerja CS berjalan, batang oranye (Hot) menyusut
           dan ungu (Deal) tumbuh"

━━ PERBANDINGAN ANTAR-CS ━━

Lead mandek per CS
  Batang bertumpuk per skor. Oranye = paling mendesak (Hot dibiarkan diam).

Kenaikan per 100 lead aktif
  Batang: kenaikan & mati, dinormalkan.
  Tooltip menampilkan angka mentah: "8,4 per 100 (24 dari 286 lead aktif)"

Corong Konversi
  Bar horizontal skor 1–6. Dorman (7) DI LUAR corong, dipisah garis putus.

Kualitas follow-up per CS
  Tabel: CS × (1→2, 2→3, 3→4, 4→5, 5→6)
  Sel: persentase besar + "N dari M" kecil di bawahnya
  Warna: ≥60% hijau · ≥30% amber · sisanya merah
  Bila belum cukup data: "—" + "belum cukup data"

Tabel Lead Mandek
  Diam (pil berwarna) · CS · Nama · Skor · Terakhir Disentuh · Aktivitas
  Diurut dari yang paling jauh melewati ambang
```

---

### SUB-TAB 3 — 💰 Keuangan

⚠️ Di sistem lama sub-tab ini membaca `export_kpi`. **Di GIANT, ganti dengan agregasi `PaymentEvent`:**

```
Ringkasan per CS   DP · Lunas · % Lunas · Harga · Nominal · % Tertagih
Grafik             Status bayar per CS (batang bertumpuk DP/Lunas)
                   Harga vs Nominal per CS (batang + garis % tertagih)
Filter             Periode bulan
```

---

### SUB-TAB 4 — 🔎 Fokus 1 CS

Chip pemilih CS, lalu semua yang tampil **hanya milik CS itu**:

```
Statistik   Lead Aktif · Hot · Finish · Dorman · Kenaikan · Konversi 3→4
Grafik      Distribusi skor (batang, warna per skor)
            Kecepatan naik level (median hari, tooltip: "Median N hari (M lead)")
Tabel       Riwayat perubahan skor — Tanggal · Nama · Dari · Ke · Arah · Aktivitas
```

⚠️ **Chip pemilih harus mencakup semua CS yang punya data di sumber MANA PUN.** Di sistem lama, chip dibangun hanya dari `LOG_SKOR` — akibatnya CS yang belum punya riwayat skor (Dedes) hilang dari daftar meski punya data keuangan. Kalau CS terpilih belum punya data skor, tampilkan catatan penjelasan, bukan grafik kosong tanpa keterangan.

## 5.6 Halaman: Finance

⚠️ **Terkunci.** Di sistem lama pakai PIN 6 digit di browser. **Di GIANT: ganti dengan permission Auth.js** — hanya role Owner, Manajer, dan Finance yang bisa membuka. PIN dihapus.

### Target bulanan
Dua isian: Omset dan Laba (dalam juta). Nilai berjalan sekarang: **Omset Rp500 juta/bulan, Laba Rp150 juta/bulan**. Di GIANT disimpan di database, bukan localStorage.

```
KPI          💵 Total Omset · 💸 Total Pengeluaran · 📈 Total Laba · 🎯 Margin Laba
             (masing-masing dengan delta bulan terakhir vs sebelumnya)

Sorotan      🎯 Capai target omset (N/M bulan)
             💰 Capai target laba (N/M bulan)
             🏆 Bulan omset tertinggi
             💎 Bulan laba tertinggi
             📆 Hari omset tertinggi
             📊 Rata-rata omset per hari

Grafik       Tren per bulan — 3 garis (masuk/keluar/laba) + garis putus target
                              label nilai di tiap titik
             Pertumbuhan omset bulan-ke-bulan (batang hijau/merah)
             Uang masuk vs keluar per bulan
             Omset & laba mingguan (batang warna mengikuti naik/turun + garis laba)
             Pergerakan harian (3 garis)
             Akumulasi laba (area kumulatif)

Tabel        Bulan · Hari Tercatat · Omset · Pengeluaran · Laba · Margin ·
             Pertumbuhan · vs Target
```

## 5.7 Halaman: Data Goal (Peta)

```
KPI      Total Perusahaan · Total Wilayah
Peta     Leaflet + CartoDB Voyager
         Marker per kota, popup: nama kota, jumlah klien, daftar perusahaan
```

⚠️ **Di sistem lama koordinat kota di-hardcode** dalam objek `koordinatKota`. Di GIANT: simpan `latitude`/`longitude` di tabel `Client` atau tabel `City` terpisah, jangan hardcode.

---

# 6. SISTEM DESAIN

```css
--bg:       #f4f6fb    /* latar halaman */
--sb-bg:    #0f172a    /* sidebar */
--card:     #ffffff
--txt:      #0f172a
--muted:    #64748b
--faint:    #94a3b8
--border:   #e6e9f0
--accent:   #3b5bdb
--accent-l: #eef2ff
--green:    #15803d    --green-l: #dcfce7
--amber:    #b45309    --amber-l: #fef3c7
--red:      #b91c1c    --red-l:   #fee2e2
```

**Komponen yang perlu dibuat ulang:**
```
KpiCard          strip warna 3px di kiri (biru/hijau/amber/merah), label, nilai besar, delta
SignalCard       ikon dalam kotak berwarna + label + nilai + subteks
ChartCard        judul, subjudul penjelas, legenda kustom, wadah grafik
DataTable        header sticky, hover baris, kotak pencarian, penghitung baris
SkorBadge        pil berwarna sesuai skor
ArahBadge        pil bulat berwarna sesuai arah
AgePill          pil umur — merah ≥14 hari, amber ≥7, abu sisanya
FunnelRow        nama + bar + persentase
Heatmap          tabel dengan sel bergradasi
```

## 6.1 Responsif — wajib

Bos membuka dashboard di **tablet Samsung**. Titik henti yang sudah teruji:

```
≤1024px   Sidebar menyusut jadi 180px
≤820px    Sidebar jadi BAR ATAS (bukan samping) — ini yang paling penting
          Grafik 2 kolom jadi 1 kolom
≤700px    Tabel diberi lebar minimum 620px + geser horizontal
≤560px    Tinggi grafik dibatasi 220px, KPI 2 kolom
≤380px    KPI 1 kolom
```

⚠️ Sidebar tetap 224px di layar sempit adalah **penyebab utama tampilan berantakan** di tablet. Harus jadi bar atas.

⚠️ Saat tablet diputar, grafik harus digambar ulang. Di React: pakai `ResizeObserver` atau `useEffect` pada perubahan ukuran.

---

# 7. API YANG DIBUTUHKAN

```
GET  /api/kpi/admin/overview?from=&to=&divisi=
GET  /api/kpi/admin/per-orang?from=&to=&divisi=
GET  /api/kpi/admin/per-divisi?from=&to=
GET  /api/kpi/desain?from=&to=

GET  /api/kpi/cs/ringkasan?from=&to=
GET  /api/kpi/cs/jurnal?from=&to=
GET  /api/kpi/cs/prospek?from=&to=
GET  /api/kpi/cs/keuangan?bulan=
GET  /api/kpi/cs/detail/:csUserId?from=&to=

GET  /api/kpi/finance/ringkasan?from=&to=      🔒 role terbatas
GET  /api/kpi/finance/bulanan?from=&to=        🔒
POST /api/kpi/finance/target                   🔒

GET  /api/kpi/klien/sebaran
GET  /api/kpi/target                           // target penyelesaian admin
POST /api/kpi/target
```

⚠️ **Semua perhitungan di server.** Jangan mengirim seluruh riwayat event ke browser lalu menghitung di sana — itu warisan keterbatasan CSV, bukan desain yang benar.

💡 Pertimbangkan **cache** untuk agregasi berat (komposisi harian, konversi). Data KPI tidak perlu real-time per detik; cache 1–5 menit sudah cukup.

---

# 8. URUTAN PENGERJAAN

```
TAHAP 1  Fondasi
         Skema Prisma · konstanta · fungsi perhitungan + unit test
         ⚠️ Uji rumus dengan data contoh SEBELUM membangun UI

TAHAP 2  Komponen bersama
         KpiCard · ChartCard · DataTable · badge · filter tanggal

TAHAP 3  Halaman Admin
         Overview → Per Orang → Per Divisi → Desain

TAHAP 4  Halaman CS
         Jurnal Harian (termasuk kalimat otomatis) → Prospek
         → Keuangan → Fokus 1 CS

TAHAP 5  Finance + permission
TAHAP 6  Peta sebaran klien
TAHAP 7  Responsif + pengujian di tablet
```

## 8.1 Uji rumus yang wajib lulus

```
✓ tentukanArah(3, 7)  = 'MATI'            bukan 'NAIK'
✓ tentukanArah(7, 6)  = 'FINISH'          bukan 'AKTIF_KEMBALI'
✓ tentukanArah(7, 3)  = 'AKTIF_KEMBALI'
✓ tentukanArah(null, 5) = 'LEAD_BARU'

✓ Uang masuk: DP 2,5jt → Lunas 5jt  ⇒  amountIn = 2,5jt   bukan 5jt
✓ Total uang = jumlah amountIn, bukan jumlah amountAfter

✓ Konversi: lead berumur < 7 hari TIDAK masuk penyebut
✓ Konversi: naik ke skor 7 TIDAK dihitung berhasil

✓ Mandek: lead BASELINE dengan followUpDate lama ⇒ terhitung mandek
✓ Mandek: skor 6 & 7 TIDAK PERNAH terhitung mandek

✓ per100(24, 286) = 8.4
✓ Peringatan per-100 berbeda dari peringkat mentah (uji dengan tabel di 4.6)
```

---

# 9. YANG SENGAJA TIDAK DIPINDAHKAN

| Fitur lama | Alasan |
|---|---|
| Tab `export_kpi` sebagai sumber keuangan CS | Sumber ganda, angka sering beda — diganti `PaymentEvent` |
| PIN 6 digit Finance | Diganti permission Auth.js |
| Sistem arsip `ARSIP KERJAAN` | Database tidak perlu dipecah per bulan |
| `normalisasiStatus` regex | Hanya untuk migrasi; status jadi enum |
| Koordinat kota hardcode | Pindah ke database |
| Fetch CSV + `parseCSV` | Diganti Prisma |
| Auto-refresh 5 menit | Diganti fetch on-demand / revalidate |
| `localStorage` untuk target | Pindah ke database per pengguna |

---

# 10. CATATAN PENUTUP UNTUK PENGEMBANG

Tiga hal yang paling sering salah dipahami saat membaca dashboard lama:

**1. Skor 7 bukan puncak.** Setiap perbandingan `skor > skor` harus mengecualikan 7. Ini kesalahan yang paling sering terjadi dan paling sulit terlihat — angkanya tetap keluar, hanya salah.

**2. Uang masuk adalah selisih.** Menjumlahkan nominal akan melipatgandakan pendapatan. Sudah pernah terjadi di sistem lama.

**3. Angka mentah tidak adil.** Setiap metrik yang membandingkan orang harus dinormalkan terhadap bebannya. Kalau tidak, dashboard akan membuat Bos menegur orang yang paling produktif.

Dan satu prinsip yang menaungi semuanya:

> **Dashboard harus mencerminkan keadaan sebenarnya, bukan keadaan yang enak dilihat.**
> Kalau data belum cukup, tulis "belum cukup data" — jangan tampilkan 0% seolah hasilnya buruk.
> Kalau tanggal hanya perkiraan, beri tanda `≈` — jangan sembunyikan ketidakpastiannya.
