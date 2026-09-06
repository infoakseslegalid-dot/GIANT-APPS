# Deploy GIANT-APPS ke VPS (Traefik + Supabase)

Domain: **ali-dev.web.id** — dipatok langsung di label Traefik pada
[docker-compose.prod.yml](docker-compose.prod.yml), bukan lewat environment.

Database: **Supabase** — tidak ada container Postgres di stack produksi.

File yang dipakai: [Dockerfile](Dockerfile), [docker-compose.prod.yml](docker-compose.prod.yml),
[.env.example](.env.example).

---

## 1. Prasyarat di VPS

- Docker Engine + Compose v2.
- Traefik sudah berjalan, punya entrypoint bernama `websecure`, dan resolver
  TLS-nya sudah dipasang di konfigurasi statis Traefik.
- Network eksternal `proxy` sudah ada (Traefik ikut tersambung ke sana):

  ```bash
  docker network create proxy   # kalau belum ada
  ```

- DNS: A record `ali-dev.web.id` menunjuk ke IP VPS.
- Database Supabase sudah terisi. Kalau memakai project Supabase yang sama
  dengan yang dipakai di laptop, **datanya sudah ada** — jangan impor ulang
  `ali_db_dump.sql` (dump itu diawali `DROP TABLE`). Kalau produksi memakai
  project Supabase terpisah, jalankan impornya sekali sesuai
  [DEV-SETUP.md](DEV-SETUP.md) bagian 3.

---

## 2. Siapkan environment

```bash
git clone <repo> giant-apps && cd giant-apps
cp .env.example .env
nano .env
```

Yang dibaca stack produksi dari `.env` hanya tiga:

| Variabel | Isi |
|---|---|
| `DATABASE_URL` | Connection string Supabase (Session pooler, port 5432) |
| `DIRECT_URL` | Sama dengan `DATABASE_URL` kalau memakai Session pooler |
| `JWT_SECRET` | Nilai acak |

Sisanya — domain, `NODE_ENV`, `PORT`, `COOKIE_SECURE` — sudah dipatok di
`docker-compose.prod.yml`, jadi tidak perlu diurus di `.env`.

Bikin secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# atau tanpa Node:
openssl rand -hex 32
```

> Mengganti `JWT_SECRET` otomatis me-logout semua sesi yang sedang berjalan.
> Kalau memakai `.env` yang sama dengan laptop, pakai nilai yang sama supaya
> tidak saling melempar logout.

Amankan filenya — isinya kredensial database:

```bash
chmod 600 .env
```

---

## 3. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Compose otomatis membaca `.env` di folder yang sama, jadi tidak perlu flag
tambahan.

Urutan yang terjadi:

1. `migrate` menjalankan `prisma db push --skip-generate` — menyamakan skema
   database dengan `prisma/schema.prisma`. Sengaja tanpa `--accept-data-loss`:
   kalau ada perubahan yang berpotensi menghapus data, perintahnya gagal dan
   deploy berhenti di sini. Pada database yang sudah diisi dari
   `ali_db_dump.sql`, langkah ini tidak mengubah apa pun — Prisma menjawab
   *"The database is already in sync with the Prisma schema"*.
2. `giant-apps` baru start setelah `migrate` selesai dengan status sukses.
3. Traefik membaca label container dan mulai meneruskan trafik dari
   `https://ali-dev.web.id` ke port 3000 di container.

Cek hasilnya:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f giant-apps
curl -I https://ali-dev.web.id
```

Container punya healthcheck bawaan, jadi kolom `STATUS` di `ps` akan
menunjukkan `healthy` kalau aplikasinya benar hidup.

---

## 4. Update versi

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Bersihkan image lama sesekali:

```bash
docker image prune -f
```

---

## 5. Catatan penting

**Satu Supabase dipakai bersama dev.** Kalau `.env` di VPS memakai
connection string yang sama dengan laptop, keduanya menulis ke database yang
sama: percobaan di laptop langsung mengubah data yang dilihat pengguna
produksi. Begitu ali-dev.web.id dipakai orang lain, bikin project Supabase
kedua khusus dev dan pisahkan `.env`-nya.

**Jalankan satu replica saja.** Bus realtime (`/api/events`, SSE) hidup di
memori proses — lihat `realtimeBus` di `src/server/deps.ts` — dan penjadwal
cron internal juga `setInterval` di dalam proses yang sama
(`src/server/index.ts`). Menjalankan dua container berarti klien hanya
menerima event dari container yang kebetulan melayaninya, dan cron jalan dobel.
Jadi jangan pakai `--scale`.

**SSE dan timeout Traefik.** Koneksi `/api/events` bersifat long-lived, dan
server mengirim ping tiap 25 detik — di bawah `idleTimeout` bawaan Traefik
(180 detik), jadi tidak perlu setelan khusus.

**Lampiran.** Selama `EMERGENT_LLM_KEY` kosong, file unggahan disimpan di
volume `uploads_data` (`/app/local_storage` di dalam container). File ini
tersimpan di VPS, bukan di Supabase, jadi ikutkan saat backup:

```bash
docker run --rm -v giant-apps_uploads_data:/data -v "$PWD:/backup" \
  alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

**Backup database** diurus dari sisi Supabase (dashboard → Database → Backups),
atau manual dengan `pg_dump "$DATABASE_URL" > backup.sql`.

**Kalau Traefik Anda butuh resolver TLS eksplisit**, tambahkan satu label lagi
di `docker-compose.prod.yml` (sesuaikan nama resolvernya):

```yaml
      - traefik.http.routers.giant-apps.tls.certresolver=letsencrypt
```

---

## 6. Troubleshooting

**`network proxy declared as external, but could not be found`**
`docker network create proxy`.

**Deploy berhenti di service `migrate`**
Lihat pesannya, lalu jalankan manual untuk detail:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

Kalau Prisma menolak karena perubahan skema akan menghapus data, jangan
langsung menambah `--accept-data-loss` — periksa dulu selisihnya, karena itu
database produksi.

**Traefik 404 di `https://ali-dev.web.id`**
Cek container ada di network `proxy` dan labelnya terbaca:

```bash
docker inspect giant-apps --format '{{json .Config.Labels}}' | tr ',' '\n'
docker network inspect proxy --format '{{range .Containers}}{{.Name}} {{end}}'
```

**Login gagal terus padahal kredensial benar**
Stack produksi mengirim cookie dengan `Secure`, jadi domainnya harus benar-benar
diakses lewat HTTPS. Pastikan Traefik sudah menerbitkan sertifikat untuk
ali-dev.web.id dan Anda tidak membukanya lewat `http://`.

**Prisma error `Can't reach database server`**
Pastikan VPS bisa menjangkau host Supabase di port 5432 (tidak diblokir
firewall keluar), dan `DATABASE_URL` memakai Session pooler. Direct connection
`db.<ref>.supabase.co` butuh IPv6.
