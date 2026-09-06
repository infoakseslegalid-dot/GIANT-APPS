# Menjalankan GIANT-APPS di Mesin Sendiri

Panduan lengkap dari repo yang baru di-`clone` sampai aplikasi jalan, dengan
database **Supabase** dan data dari `ali_db_dump.sql`.

Ada dua cara menjalankan, dan keduanya memakai `.env` serta database yang sama:

| Cara | Perintah | Kapan dipakai |
|---|---|---|
| **Manual** (tanpa Docker) | `yarn dev` | Sehari-hari. Paling cepat, HMR paling responsif. |
| **Docker** | `yarn docker:dev` | Kalau ingin lingkungan seragam antar mesin / tidak mau pasang Node & Yarn di host. |

---

## Stack singkat

- **Next.js 16** (App Router, bundler Turbopack) — UI di `src/app` & `src/views`
- **Hono** — seluruh REST API di `/api`, kodenya di `src/server/`
- **Prisma 6** → **PostgreSQL (Supabase)** — skema di `prisma/schema.prisma`
- **Realtime** lewat Server-Sent Events di `GET /api/events` (bukan WebSocket),
  jadi jalan normal baik di `next dev` maupun di custom server
- **Upload lampiran**: kalau `EMERGENT_LLM_KEY` kosong, file otomatis disimpan ke
  folder `./local_storage` (lihat `src/server/storage.ts`)

---

## 0. Prasyarat

| Kebutuhan | Cara manual | Cara Docker |
|---|---|---|
| Node.js 22 LTS | wajib | tidak perlu |
| Yarn 1.22.22 | wajib (`corepack enable`) | tidak perlu |
| Docker Desktop | tidak perlu | wajib, dan harus dalam keadaan **running** |
| `psql` | opsional (untuk impor dump) | opsional — script bisa pinjam psql dari Docker |

Aktifkan Yarn versi yang dipakai project (tercatat di `package.json` →
`packageManager`):

```bash
corepack enable
```

---

## 1. Siapkan database di Supabase

1. Buat project baru di <https://supabase.com/dashboard>. **Catat password
   database** yang dibuat di langkah ini — Supabase hanya menampilkannya sekali.
2. Setelah project siap, klik tombol **Connect** di header dashboard.
3. Ambil connection string di tab **ORMs → Prisma**, atau salin URI dari
   bagian **Session pooler**. Bentuknya kira-kira:

   ```
   postgresql://postgres.abcdefghijklmnopqrst:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

**Pilih yang mana — Direct, Session pooler, atau Transaction pooler?**

| Opsi | Port | Catatan |
|---|---|---|
| **Session pooler** ← pakai ini | 5432 | Rekomendasi untuk project ini. Koneksi persisten, semua fitur Postgres aktif, dan jalan di jaringan IPv4. |
| Direct connection | 5432 | Butuh IPv6 (atau add-on IPv4). Fungsional, tapi banyak jaringan rumah/kantor belum siap. |
| Transaction pooler | 6543 | Untuk serverless. Kalau dipakai, `DATABASE_URL` **wajib** ditambah `?pgbouncer=true`, dan `DIRECT_URL` tetap harus port 5432. |

---

## 2. Isi `.env`

```bash
cp .env.example .env          # Git Bash / Linux / macOS
Copy-Item .env.example .env   # PowerShell
```

Lalu buka `.env` dan isi:

- **`DATABASE_URL`** dan **`DIRECT_URL`** — tempel connection string dari langkah 1.
  Kalau memakai Session pooler, isi keduanya dengan nilai yang sama.
  Ganti `[YOUR-PASSWORD]` dengan password database.
  Kalau password mengandung `@ : / ? # & %`, URL-encode dulu
  (`p@ss` → `p%40ss`), kalau tidak string koneksinya salah parse.
- **`JWT_SECRET`** — wajib diganti. Bikin nilai acak:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

  Kalau dibiarkan kosong, kode jatuh ke literal `"default_secret"`
  (`src/server/deps.ts`) — token siapa pun bisa dipalsukan.
- **`COOKIE_SECURE`** — biarkan `false` selama dev di `http://localhost`.
  Kalau `true`, browser menolak menyimpan cookie login di koneksi non-HTTPS
  dan Anda akan terlempar ke halaman login terus.

`.env` sudah masuk `.gitignore`, jadi tidak akan ikut ter-commit.

---

## 3. Impor `ali_db_dump.sql` ke Supabase

Dump ini berisi 26 tabel + datanya, dan diawali dengan `DROP TABLE` untuk
setiap tabel. Jadi **impor menimpa** isi tabel-tabel aplikasi di schema
`public`. Aman untuk project Supabase yang masih kosong.

> **Jangan lewat SQL Editor di dashboard Supabase.** Dump memakai perintah
> `COPY ... FROM stdin` yang hanya dimengerti klien `psql`, bukan editor web.

### Cara termudah — pakai script yang disediakan

```powershell
# PowerShell (Windows)
powershell -ExecutionPolicy Bypass -File scripts\db-import.ps1
```

```bash
# Git Bash / Linux / macOS
yarn db:import
# sama dengan: bash scripts/db-import.sh
```

Script akan membaca `DIRECT_URL`/`DATABASE_URL` dari `.env`, menampilkan host
tujuan, minta konfirmasi, lalu menjalankan `psql`. Kalau `psql` tidak terpasang,
script otomatis meminjamnya dari image `postgres:17-alpine` via Docker.

Tambahkan `--yes` (bash) atau `-Yes` (PowerShell) untuk melewati konfirmasi.

### Cara manual — kalau sudah punya `psql`

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ali_db_dump.sql
```

Kalau muncul `unrecognized configuration parameter "transaction_timeout"`,
artinya server Postgres-nya versi < 17 sementara dump dibuat oleh `pg_dump 18`.
Buang baris itu dulu (script di atas sudah melakukannya otomatis):

```bash
grep -v '^SET transaction_timeout' ali_db_dump.sql > /tmp/dump.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/dump.sql
```

### Verifikasi

```bash
psql "$DATABASE_URL" -c 'select count(*) from "User";'
```

Atau buka **Table Editor** di dashboard Supabase — harusnya muncul tabel
`User`, `Board`, `WorkItem`, `MasterCard`, dan seterusnya.

> **Catatan RLS.** Tabel dibuat lewat `psql` sebagai role `postgres`, jadi Row
> Level Security-nya mati dan dashboard Supabase akan menandainya "Unrestricted".
> Untuk aplikasi ini itu memang yang diinginkan: seluruh akses database lewat
> Prisma di server, bukan lewat Supabase client dari browser. Jangan pernah
> membagikan `service_role` key atau connection string ke sisi klien.

---

## 4A. Menjalankan secara manual (tanpa Docker)

```bash
corepack enable          # sekali saja per mesin
yarn install             # pasang dependency
yarn prisma generate     # bikin Prisma Client dari schema (baca .env)
yarn dev                 # http://localhost:3000
```

`next dev` otomatis membaca `.env`, jadi tidak perlu tool tambahan.
Hot reload aktif untuk perubahan di `src/` (UI maupun route API Hono).

Mau port lain: `yarn dev --port 3100`.

---

## 4B. Menjalankan dengan Docker (hot reload)

Pastikan Docker Desktop sudah jalan dan `.env` sudah terisi, lalu:

```bash
yarn docker:dev:build    # build image + jalankan (pertama kali)
yarn docker:dev          # jalankan lagi setelahnya
yarn docker:dev:down     # hentikan & bersihkan container
```

Tanpa yarn di host, perintah panjangnya:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Buka <http://localhost:3000>. Mengubah port host cukup lewat `PORT` di `.env`
(di dalam container tetap 3000).

### Cara kerjanya

- `Dockerfile.dev` — Node 22 + Yarn (via corepack) + `openssl` (dibutuhkan
  query engine Prisma di image `-slim`). `yarn install` dan `prisma generate`
  dijalankan saat build.
- `docker-compose.dev.yml` — folder project di-**bind mount** ke `/app`, jadi
  file yang Anda simpan di editor langsung terlihat oleh container. Itulah
  sumber hot reload-nya.
- `node_modules` dan `.next` dipetakan ke **named volume** terpisah supaya
  binary Linux di dalam container tidak tertimpa `node_modules` milik Windows
  (dan sebaliknya).
- Container menjalankan `next dev --webpack`, bukan Turbopack. Alasannya:
  bind mount dari Windows/macOS tidak meneruskan event `inotify` ke container,
  sehingga file watcher harus mode *polling*. Webpack menghormati
  `WATCHPACK_POLLING=true`; Turbopack di Next 16 belum punya opsi setara.
  Konsekuensinya start awal sedikit lebih lambat dibanding Turbopack.
- `docker/dev-entrypoint.sh` — jaring pengaman: kalau volume `node_modules`
  kosong atau Prisma Client belum ada, keduanya dibuat ulang otomatis sebelum
  server start.

### Setelah menambah dependency baru

`node_modules` di container ada di volume, bukan di folder host. Jadi setelah
mengubah `package.json`:

```bash
docker compose -f docker-compose.dev.yml exec app yarn install
# atau rebuild dari nol:
docker compose -f docker-compose.dev.yml down -v
yarn docker:dev:build
```

### Setelah mengubah `prisma/schema.prisma`

```bash
docker compose -f docker-compose.dev.yml exec app yarn prisma generate
```

### Catatan performa

Dokumentasi Next.js sendiri menyarankan development langsung di host untuk
Windows/macOS: akses filesystem lintas-VM bikin HMR terasa lebih lambat.
Jadi pakai cara Docker kalau butuh keseragaman lingkungan, dan cara manual
(4A) untuk iterasi harian.

---

## 5. Login

Akun ikut terbawa dari `ali_db_dump.sql`. Yang ada di dump antara lain
`admin@example.com` (role `super_admin`) dan sejumlah akun `@ali.id`.

Kalau tidak ada password yang cocok, ganti hash-nya langsung di database —
`passwordHash` memakai bcrypt cost 10, sama seperti `prisma/seed.ts`:

```bash
node -e "console.log(require('bcryptjs').hashSync('PasswordBaruAnda', 10))"
psql "$DATABASE_URL" -c "update \"User\" set \"passwordHash\" = '<hash-tadi>' where email = 'admin@example.com';"
```

Alternatif lain: **jangan** impor dump, dan pakai data contoh saja —
`yarn prisma db push && yarn tsx prisma/seed.ts`. Seed membuat
`admin@example.com` / `admin123`. Perlu diingat `db push` akan menyesuaikan
skema database dengan `schema.prisma`, jadi jangan campur dengan hasil impor
dump tanpa dicek dulu.

---

## 6. Perintah yang sering dipakai

| Perintah | Fungsi |
|---|---|
| `yarn dev` | Dev server (Turbopack), port 3000 |
| `yarn dev:webpack` | Dev server dengan webpack — pakai kalau ada masalah Turbopack |
| `yarn dev:custom-server` | Custom server `server.mjs` (Next + Hono + WebSocket `/api/ws`) |
| `yarn build && yarn start` | Build & jalankan mode produksi |
| `yarn db:generate` | `prisma generate` |
| `yarn db:push` | Sinkronkan skema database dengan `schema.prisma` |
| `yarn db:import` | Impor `ali_db_dump.sql` |
| `yarn docker:dev` / `:build` / `:down` | Stack dev di Docker |
| `yarn lint` | ESLint |

---

## 7. Troubleshooting

**`Environment variable not found: DIRECT_URL`**
`prisma/schema.prisma` memakai `directUrl` supaya Supabase transaction pooler
tetap bisa dipakai. Isi `DIRECT_URL` di `.env` — boleh sama persis dengan
`DATABASE_URL`.

**`Can't reach database server` / `P1001`**
Cek connection string: password sudah diganti dan sudah di-URL-encode? Kalau
memakai *Direct connection* (`db.<ref>.supabase.co`) dan jaringan Anda IPv4
saja, pindah ke **Session pooler**.

**`prepared statement "s0" already exists`**
Muncul kalau `DATABASE_URL` menunjuk transaction pooler (port 6543) tanpa
`?pgbouncer=true`. Tambahkan parameter itu.

**Halaman jalan tapi login gagal terus**
`COOKIE_SECURE=true` di `http://localhost`. Ubah ke `false`.

**Hot reload tidak jalan di Docker**
Pastikan `docker-compose.dev.yml` tidak diubah bagian `WATCHPACK_POLLING` dan
command-nya masih `next dev --webpack`. Kalau container dijalankan tanpa bind
mount `.:/app`, perubahan file di host memang tidak akan sampai ke container.

**`ENOTEMPTY` saat `yarn install` di Windows**
Cache Yarn 1 rusak (biasanya karena dua proses `yarn install` jalan bersamaan
atau antivirus mengunci file). Hapus folder cache paket yang disebut di pesan
error, lalu ulangi `yarn install --check-files`.

**Port 3000 sudah dipakai**
`yarn dev --port 3100`, atau ubah `PORT` di `.env` untuk stack Docker.
