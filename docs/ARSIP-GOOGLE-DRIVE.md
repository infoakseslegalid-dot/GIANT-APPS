# Arsip → Google Drive: pengaturan sekali jalan

Setelah langkah ini, setiap file yang diupload di kartu **otomatis tersalin ke Google Drive**
dengan susunan rapi, dan dokumen hasil (Akta, SK, NPWP, NIB, …) langsung punya link untuk
dashboard klien.

## Susunan folder yang dibuat aplikasi

```
AKSES LEGAL - ARSIP/
├─ A. DATA MENTAH (INTERNAL)/            🔒 tidak pernah dibagikan
│   ├─ _SEDANG BERJALAN/
│   │   └─ PT Maju Mundur - PT Umum [AL-9CC77D]/
│   └─ 2026/
│       └─ 02 - Februari/                ← dipindah otomatis saat pekerjaan FINISH
│           └─ PT Maju Mundur - PT Umum [AL-9CC77D]/
│               ├─ Catatan Klien          (Google Docs: no. WA, email, alamat, catatan)
│               ├─ KTP - ....pdf
│               ├─ NPWP Pribadi - ....pdf
│               ├─ Foto TTD/
│               └─ Belum Dipilah/         (file yang belum ditandai jenisnya)
└─ B. DOKUMEN HASIL (DASHBOARD KLIEN)/
    └─ 2026/02 - Februari/PT Maju Mundur - PT Umum [AL-9CC77D]/
        ├─ Akta Pendirian - PT Maju Mundur.pdf   🔗 siapa saja yang punya link bisa melihat
        ├─ SK Kemenkumham - PT Maju Mundur.pdf
        ├─ NPWP Perusahaan - PT Maju Mundur.pdf
        └─ NIB - PT Maju Mundur.pdf
```

- **Bulan = bulan pekerjaan finish.** Sebelum finish, folder ada di `_SEDANG BERJALAN`.
- Memindahkan file di Google Drive **tidak mengubah link-nya**, jadi link yang sudah masuk dashboard tetap berlaku.
- Kalau jenis sebuah file diubah dari dokumen hasil menjadi dokumen lain, file dipindah ke folder A dan **link publiknya ditutup**.
- Lampiran yang dihapus di aplikasi tidak dihapus dari Drive (tetap jadi arsip). Kalau file itu dokumen hasil, link-nya ditutup dan namanya diberi awalan `[DIHAPUS]`.

## Langkah 1: Buat kredensial di Google Cloud (±10 menit, gratis)

Gunakan akun **info.akseslegal.id@gmail.com**.

1. Buka <https://console.cloud.google.com/> → pilih project di kiri atas → **New Project** → beri nama `GIANT-APPS Arsip` → **Create**.
2. Menu **APIs & Services → Library** → cari **Google Drive API** → **Enable**.
3. Menu **Google Auth Platform** (atau **OAuth consent screen**):
   - **Branding**: App name `GIANT-APPS Arsip`, support email `info.akseslegal.id@gmail.com`, developer email yang sama → Save.
   - **Audience**: User type **External**. Lalu klik **Publish app** sampai statusnya **In production**.
     > Penting: kalau dibiarkan "Testing", Google memutus akses setiap 7 hari.
     > Aplikasi ini hanya memakai izin `drive.file` (file buatan aplikasi sendiri), jadi **tidak perlu verifikasi Google**.
   - **Data access** (Scopes): tambahkan `.../auth/drive.file` dan `.../auth/userinfo.email`.
4. Menu **Clients** (atau **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**, nama bebas.
   - **Authorized redirect URIs**, tambahkan:
     - `https://ali-dev.web.id/api/integrations/google/callback` (server produksi)
     - `http://localhost:3000/api/integrations/google/callback` (untuk mencoba di komputer)
   - **Create** → salin **Client ID** dan **Client secret**.

## Langkah 2: Isi `.env` server lalu deploy ulang

```
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxx"
PUBLIC_BASE_URL="https://ali-dev.web.id"
```

Di VPS, variabel ini sudah diteruskan ke container lewat `docker-compose.prod.yml`.

## Langkah 3: Hubungkan dari aplikasi

1. Login sebagai super admin → **Arsip Dokumen → tab "Integrasi Drive & Dashboard"**.
2. Klik **Hubungkan Google Drive** → login `info.akseslegal.id@gmail.com`.
3. Kalau muncul "Google hasn't verified this app": klik **Advanced → Go to GIANT-APPS Arsip**. Ini wajar untuk aplikasi internal milik sendiri.
4. Centang izin → **Continue**. Anda kembali ke aplikasi dengan status **Terhubung**.
5. Folder `AKSES LEGAL - ARSIP` muncul di My Drive, dan **semua file lama langsung mulai dikirim** (bertahap, tiap 5 menit).

Folder `AKSES LEGAL - ARSIP` boleh dipindah ke folder mana pun di Drive Anda; aplikasi tetap bisa menulis ke dalamnya.
**Jangan hapus atau ganti namanya.** Kalau terhapus, aplikasi membuat folder baru dan mengirim ulang.

## Cara kerja sehari-hari

| Kejadian | Yang terjadi otomatis |
|---|---|
| Staff upload file di kartu | ±5 detik kemudian tersalin ke Drive |
| Staff menandai jenis dokumen | File dipindah ke folder yang benar dan diberi nama rapi |
| CS mengisi "Data Klien & Perusahaan" di kartu | Dokumen "Catatan Klien" di Drive ikut diperbarui |
| Pekerjaan FINISH | Folder dipindah dari `_SEDANG BERJALAN` ke `Tahun/Bulan`; dashboard klien dikirimi daftar dokumen dan link-nya |
| Sesuatu gagal (internet putus, kuota penuh) | Dicoba lagi tiap 5 menit; terlihat di tab Integrasi dan ikon awan merah |

## Keamanan

- Aktifkan **verifikasi 2 langkah** di akun info.akseslegal.id@gmail.com, karena isinya KTP klien.
- Jangan pernah membagikan folder **A. DATA MENTAH**. Folder **B** pun tidak perlu dibagikan; yang dibuka publik hanya file per file lewat link.
- Untuk memutus akses aplikasi: tab Integrasi → **Putuskan**, atau <https://myaccount.google.com/permissions>.
