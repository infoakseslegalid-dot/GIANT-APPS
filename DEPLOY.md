# Deploy GIANT-APPS ke VPS (Traefik + Supabase)

Domain: **ali-dev.web.id** — dipatok langsung di label Traefik pada
[docker-compose.prod.yml](docker-compose.prod.yml), bukan lewat environment.

Database: **Supabase** — tidak ada container Postgres di stack produksi.

File yang dipakai: [Dockerfile](Dockerfile), [docker-compose.prod.yml](docker-compose.prod.yml),
[.env.example](.env.example), [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

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

## 2. Clone repo private di VPS (deploy key)

Repo ini private, jadi VPS butuh identitas sendiri untuk membacanya. Cara yang
tepat adalah **deploy key**: satu kunci SSH khusus repo ini, read-only. Lebih
aman daripada Personal Access Token — token akan tersimpan apa adanya di
`.git/config` dan biasanya berlaku untuk semua repo Anda, sedangkan deploy key
hanya bisa membaca satu repo dan gampang dicabut.

### a. Cek dulu kunci yang sudah ada di VPS

VPS ini kemungkinan sudah menyimpan kunci dari project lain (`github_deploy_key`,
`id_velloscript`, dan seterusnya). Sebelum membuat yang baru, periksa jenis
kunci yang sudah ada — jawabannya menentukan apakah bisa dipakai ulang:

```bash
ssh -T -i ~/.ssh/github_deploy_key git@github.com
```

- Balasan **`Hi <username>!`** → itu **kunci akun** (terdaftar di Settings →
  SSH and GPG keys), berlaku untuk semua repo milik Anda. Pakai ulang saja:
  lewati langkah (b) dan (c), lalu clone dengan alamat `git@github.com:...`
  biasa di langkah (d).
- Balasan **`Hi <owner>/<repo>!`** → itu **deploy key** milik repo lain.
  GitHub hanya mengizinkan satu public key dipakai sebagai deploy key di satu
  repo; mendaftarkannya lagi di repo kedua ditolak dengan *"Key is already in
  use"*. Jadi buat kunci baru di langkah berikut.

Lihat juga isi `~/.ssh/config` yang sekarang supaya blok baru tidak bentrok
dengan entri yang sudah ada:

```bash
cat ~/.ssh/config
```

### b. Buat kunci baru untuk repo ini

```bash
ssh-keygen -t ed25519 -C "giant-apps-vps" -f ~/.ssh/giant_apps_deploy -N ""
cat ~/.ssh/giant_apps_deploy.pub
```

### c. Daftarkan di GitHub

Buka repo → **Settings** → **Deploy keys** → **Add deploy key**:

- Title: `VPS ali-dev`
- Key: tempel isi `giant_apps_deploy.pub` tadi
- **Jangan** centang *Allow write access* — VPS cuma perlu membaca.

### d. Beri tahu SSH kunci mana yang dipakai

VPS ini juga menampung project lain yang mungkin punya deploy key sendiri,
jadi pakai alias host supaya tidak tertukar. **Tambahkan** blok berikut ke
`~/.ssh/config` — jangan mengubah blok `Host github.com` yang sudah ada di
sana, karena itu yang dipakai project lain. Keduanya tidak bentrok: pencocokan
`Host` memakai nama yang Anda tulis di perintah git, bukan `HostName`.

```
Host github.com-giant-apps
  HostName github.com
  User git
  IdentityFile ~/.ssh/giant_apps_deploy
  IdentitiesOnly yes
```

Uji:

```bash
ssh -T git@github.com-giant-apps
# Balasan yang benar:
# Hi infoakseslegalid-dot/GIANT-APPS! You've successfully authenticated,
# but GitHub does not provide shell access.
```

### e. Clone

```bash
sudo mkdir -p /opt/giant-apps
sudo chown "$USER":"$USER" /opt/giant-apps
git clone git@github.com-giant-apps:infoakseslegalid-dot/GIANT-APPS.git /opt/giant-apps
cd /opt/giant-apps
```

Path `/opt/giant-apps` dipakai juga oleh workflow GitHub Actions di bagian 6 —
kalau Anda memilih path lain, sesuaikan juga di sana.

---

## 3. Siapkan environment

```bash
cd /opt/giant-apps
cp .env.example .env
nano .env
```

Yang dibaca stack produksi dari `.env` hanya tiga:

| Variabel | Isi |
|---|---|
| `DATABASE_URL` | Connection string Supabase (transaction pooler 6543 `?pgbouncer=true`, atau session pooler 5432) |
| `DIRECT_URL` | Session pooler, port 5432 — dipakai `prisma db push` |
| `JWT_SECRET` | Nilai acak |

Sisanya — domain, `NODE_ENV`, `PORT`, `COOKIE_SECURE` — sudah dipatok di
`docker-compose.prod.yml`, jadi tidak perlu diurus di `.env`.

Bikin secret:

```bash
openssl rand -hex 32
```

Amankan filenya — isinya kredensial database:

```bash
chmod 600 .env
```

`.env` untracked dan ter-gitignore, jadi `git reset --hard` saat deploy tidak
akan menghapusnya.

---

## 4. Deploy manual (pertama kali)

```bash
cd /opt/giant-apps
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

## 5. Update versi (manual)

```bash
cd /opt/giant-apps
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Atau biarkan GitHub Actions yang mengerjakannya — lihat bagian berikut.

---

## 6. CI/CD: deploy otomatis dari GitHub Actions

Workflow ada di [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
Setiap push ke `main` (atau klik **Run workflow** di tab Actions) memicu SSH ke
VPS, `git reset --hard origin/main`, rebuild container, tunggu sampai healthy,
lalu bersihkan image lama.

### a. Kunci SSH untuk GitHub Actions

Perhatikan bedanya dengan bagian 2 — ini kunci yang berbeda dan arahnya
terbalik:

| Kunci | Arah | Untuk apa |
|---|---|---|
| Deploy key (bagian 2) | VPS → GitHub | VPS membaca repo private |
| `SSH_PRIVATE_KEY` (di sini) | GitHub Actions → VPS | Runner login ke VPS |

Berbeda dengan deploy key, kunci ini **boleh dipakai bersama** beberapa repo —
ia hanya sebuah kunci login SSH biasa ke VPS, dan GitHub tidak membatasi satu
private key untuk satu repo. Jadi kalau VPS sudah punya `~/.ssh/github_actions_key`
dari project lain, cukup pakai ulang:

```bash
cat ~/.ssh/github_actions_key   # salin SELURUH isinya, termasuk baris
                                # -----BEGIN ... dan -----END ...
```

Pastikan public key-nya memang ada di `authorized_keys` (biasanya sudah, kalau
workflow project lain berjalan normal):

```bash
# cek dulu
grep -qF "$(cat ~/.ssh/github_actions_key.pub)" ~/.ssh/authorized_keys && echo "sudah terpasang" || echo "belum terpasang"

# hanya kalau hasilnya "belum terpasang":
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Kalau memang belum ada kunci untuk Actions sama sekali, buat baru:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key -N ""
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_actions_key
```

### b. Daftarkan secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nama | Isi |
|---|---|
| `VPS_HOST` | IP atau hostname VPS |
| `VPS_USERNAME` | user SSH (mis. `root` atau `deploy`) |
| `SSH_PRIVATE_KEY` | isi lengkap `github_actions_key` tadi |
| `VPS_PORT` | *opsional*, hanya kalau SSH bukan di port 22 — dan buka komentar baris `port:` di workflow |

Secrets bersifat per-repo. Kalau VPS-nya sama dengan project Anda yang lain,
nilainya boleh persis sama, tapi tetap harus didaftarkan ulang di repo ini.

### c. Uji

Tab **Actions** → **Deploy to VPS** → **Run workflow**. Jalankan manual dulu
sebelum mengandalkan push otomatis, supaya kalau ada yang salah Anda tahu
sebelum kode masuk.

### Catatan atas dua penyimpangan dari template contoh

- **`cancel-in-progress: false`.** Kalau `true`, push kedua yang datang cepat
  akan membunuh deploy pertama yang mungkin sedang di tengah
  `docker compose up` — stack bisa tertinggal setengah jadi. Diantrekan lebih
  aman.
- **`docker image prune -af --filter "until=72h"`, bukan `docker system prune -af`.**
  `system prune -a` ikut membuang build cache (deploy berikutnya jauh lebih
  lambat karena `yarn install` dan `next build` mulai dari nol) dan image milik
  stack lain di VPS yang containernya kebetulan sedang mati.

---

## 7. Catatan penting

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

## 8. Troubleshooting

**`Permission denied (publickey)` saat clone di VPS**
Deploy key belum terdaftar, atau `~/.ssh/config` belum menunjuk ke kunci yang
benar. Uji dengan `ssh -T git@github.com-giant-apps`.

**`Repository not found` saat clone**
Biasanya bukan soal repo hilang, melainkan kunci yang dipakai tidak punya akses
— GitHub menyamarkan repo private sebagai "tidak ada" untuk identitas yang
tidak berhak.

**Workflow gagal di langkah SSH**
Cek `SSH_PRIVATE_KEY` disalin utuh (termasuk baris `-----BEGIN` dan `-----END`
serta baris kosong di akhir), dan public key-nya benar-benar ada di
`~/.ssh/authorized_keys` milik user `VPS_USERNAME`.

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
Pastikan VPS bisa menjangkau host Supabase di port 6543 dan 5432 (tidak
diblokir firewall keluar):

```bash
for p in 6543 5432; do
  timeout 5 bash -c "</dev/tcp/aws-0-ap-southeast-1.pooler.supabase.com/$p" \
    && echo "port $p OK" || echo "port $p TERBLOKIR"
done
```
