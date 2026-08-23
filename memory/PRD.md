# PRD — ALI Workspace (Trello-like Work Management System)

## Problem Statement (Ringkasan)
User meminta aplikasi seperti Trello untuk operasional internal ALI (legalitas). Berevolusi menjadi Work Management System: **Work Item sentral** sebagai sumber data tunggal; Board adalah tampilan/view. Fitur: Board/List/Card kanban + drag & drop, labels, due dates, checklists, comments @mention, attachments (Emergent Object Storage), multi-user share board, activity log, **card mirroring 2 arah antar board** (mirror = penampakan work item yang sama, sinkron real-time), **otomasi Butler-like**, notifikasi in-app, real-time WebSocket. Tema: Trello klasik. Bahasa UI: Indonesia.

## Keputusan User (terkunci)
1. Claim: anggota divisi boleh claim; supervisor bisa override.
2. Multi-PIC: bebas banyak PIC setara.
3. Multi-divisi: satu pekerjaan bisa di-assign ke banyak divisi.
4. Lintas divisi: assignment baru di Work Item yang sama, riwayat tersimpan.
5. Selesai: staff submit → supervisor approve → FINISH (hanya pekerjaan tertentu, via `needs_approval`).
6. Bank data: Active + Archive, tidak dihapus permanen.
7. Client: teks di card (bukan entitas CRM terpisah).
8. Board: default 1 board per divisi; Super Admin boleh tambah board bebas.
9. Visibility: user melihat pekerjaan di board divisinya + board di mana dia anggota (+ yang di-assign ke dia).
10. Notifikasi in-app: ya (assign, claim, mention, komentar, approval).

## Arsitektur
- **Backend**: FastAPI, `/api` prefix, MongoDB (motor) via MONGO_URL/DB_NAME.
  - `server.py` (app, WS `/api/ws`, CORS, startup: index + storage init + seed)
  - `deps.py` (auth helpers JWT/bcrypt, RBAC, WS manager, log_activity, notify, run_automation)
  - `routes_auth.py` (login/logout/me/refresh/change-password, brute-force lockout 5x/15m)
  - `routes_admin.py` (users, divisions, boards, lists, labels, automation rules, activities, stats)
  - `routes_work.py` (work-items CRUD, move, claim/release, assign, submit/approve/reopen, archive, mirror/unmirror, checklists, comments+mention, attachments via object storage, notifications, my-work, all-work, search)
  - `seed.py` (idempotent via `settings.demo_seeded`), `storage.py` (Emergent Object Storage)
- **Frontend**: React 19 + Tailwind + shadcn + @tanstack/react-query + @dnd-kit (drag & drop), sonner toast.
  - Pages: Login, Dashboard (statistik + workload), BoardView (kanban), MyWork, AllWork (tabel, supervisor+), AdminPanel (users/divisions/boards/aktivitas)
  - Components: AppLayout (header+sidebar+search+notif), Kanban (column+tile), CardModal (detail lengkap), AutomationModal, NotificationsMenu
  - Realtime: WebSocket `/api/ws` → invalidasi query react-query + toast notifikasi.
- **Auth**: JWT httpOnly cookie (access 12 jam + refresh 7 hari), Bearer fallback. Roles: super_admin, admin, supervisor, staff, viewer.

## User Personas
- **Super Admin (owner)**: info.akseslegal.id@gmail.com — kelola user/divisi/board, lihat semua.
- **Supervisor** (misal Andi, Admin Perizinan): approve penyelesaian, assign/override PIC, atur otomasi.
- **Staff** (Dedes/Devi/Dewi/Julia/Elis/Anti/Amel/Rina): claim & kerjakan pekerjaan, drag kartu, komentar, upload.
- **Viewer**: hanya melihat (role tersedia).

## Status Implementasi

### Iterasi 3 (23 Agu 2026 — Trello Feature Parity + Bank Data v3; lulus 75/75 backend, 100% UI)
- [x] **Bank Data v3 (Inbox Divisi)**: tabel Menunggu Diambil (Sumber, List, Umur 🟢🟡🔴, AMBIL PEKERJAAN khusus anggota divisi) + tabel Sedang Dikerjakan (✓ Pekerjaan Anda / 🔒 Dikerjakan X / ⚔ Ambil Alih supervisor+); form "Kirim Pekerjaan" 3 lapis (wajib → distribusi → opsi tambahan), divisi tujuan menggantikan pilihan board
- [x] **Kirim/Mirror ke Divisi** dari card modal (`POST /work-items/{id}/send`): mirror ke board divisi + bank data + notifikasi anggota divisi; radio "divisi memilih sendiri / user tertentu"
- [x] **Card v3**: cover (warna + gambar dari lampiran), start date, custom fields bebas, Watch/Pantau (notifikasi perubahan ke watcher), salin link kartu, lepas pekerjaan dengan alasan → notifikasi pembuat
- [x] **Komentar lengkap**: edit (penulis), emoji reaction 👍❤️😂✅ (toggle + notifikasi), lampiran file di komentar, lampiran tautan/URL
- [x] **Advanced Checklist**: rename checklist, item assignee + due date, reorder naik/turun, convert item → kartu baru
- [x] **List ops**: collapse/expand, urutkan (manual/terbaru/judul/tenggat), salin list + kartu, pindah ke board lain, arsipkan semua kartu, arsipkan list
- [x] **Board ops**: salin board (± kartu, checklist di-reset), arsipkan/buka kembali (Admin Panel), template SKOR 1-7, deskripsi & visibility field, salin link board
- [x] **Filter board**: label multi-select + anggota + filter status
- [x] **Kalender** `/calendar`: grid bulanan kartu by due date
- [x] **Cron harian**: advance HARI + reminder due date hari ini/besok (idempoten) ke PIC+watcher+pembuat
- [x] Keyboard: `/` fokus search, Esc tutup modal
- [x] Seed self-healing: password demo di-reset otomatis jika berubah
- **SKIP (per instruksi user, perlu integrasi eksternal)**: Email→Card, AI checklist, Google Drive/Dropbox/OneDrive, mobile native, API/Webhook publik

### Iterasi 2 (21 Agu 2026 — Bank Data + Board Harian + Peta Skor + Validasi Syarat; lulus testing 49/49 backend, 100% UI)
- [x] **Bank Data per divisi** (`/bank-data/:divisionId`): tabel No|Pekerjaan|List|PIC|Tenggat|Status|Aksi; semua user bisa lihat semua divisi, hanya anggota divisi bisa Klaim; Tambah Pekerjaan lintas divisi (assign divisi otomatis + opsional pilih PIC); panel beban kerja per anggota dengan rincian per list (S1:5, dll)
- [x] **Card Modal ala Trello**: pane kiri konten (PIC jelas avatar+nama, divisi, label, tenggat, prioritas, klien, deskripsi, checklist, lampiran), pane kanan rail Komentar & Aktivitas (feed gabungan + toggle detail)
- [x] **Board Harian** (`/global/hari`): kolom HARI 1-7 + FINISH; kartu CS yang masuk SKOR 5 otomatis `hari_stage=1`; auto-maju harian via cron platform (`/api/cron/advance-hari`, Bearer secret, idempoten); admin bisa maju manual lebih cepat; gate checklist: HARI 4 = AKTA+SK, HARI 6 = NPWP+Coretax+Suket, FINISH = NIB; LOGO hanya warning; badge "Mandek" merah ≥2 hari; permission draf/pajak/perizinan/desain + admin
- [x] **Peta Skor Global** (`/global/skor`): read-only agregasi SKOR 1-6 lintas board (CS + Admin Draf + HARI), badge Mandek ≥3 hari; permission CS + supervisor/admin
- [x] **Validasi syarat pindah list**: `entry_requirements` per list (default CS: S3=KTP+NPWP, S4=Pembayaran, S5=Konfirmasi Klien, S6=Penyerahan), admin/supervisor bisa ubah via menu list "Atur syarat masuk"; staff diblokir 400, supervisor boleh dengan catatan di activity log; checklist "Syarat <list>" otomatis dibuat di kartu

### Iterasi 1 (21 Agu 2026 — MVP; lulus testing 27/27 backend, 100% UI)
- [x] Auth JWT lengkap + brute force protection + seed admin idempoten
- [x] 8 board seed (CS ×4, Admin Draf, Pajak, Perizinan, Desain) + list + labels + 18 sample cards + 9 user demo
- [x] Kanban drag & drop antar list + reorder list + reorder kartu (posisi float)
- [x] Card modal: judul/deskripsi/klien, label editor + buat label, due date, prioritas, PIC assign, divisi assign, checklist + progress bar, lampiran (upload/download/delete via object storage), komentar + @mention + highlight, aktivitas
- [x] Claim/Lepas, Submit/Approve/Reopen, Archive/Unarchive (modal arsip di board)
- [x] Card mirroring 2 arah + automation seed (TER-MIRROR label saat mirror/unmirror)
- [x] Otomasi custom (trigger: kartu dibuat/dipindah/di-mirror/mirror dihapus → aksi: label/prioritas/divisi)
- [x] Notifikasi in-app real-time (bell + badge + navigasi ke kartu)
- [x] Global search (board + pekerjaan), Dashboard statistik, MyWork, AllWork (supervisor+), Admin Panel
- [x] Testing: backend 27/27 pytest lolos, semua flow UI lolos (iteration_1.json)

## Backlog Prioritas
- **P0**: — (kosong)
- **P1**: Notifikasi due-date mendekat/overdue terjadwal; tampilan Table/List selain Kanban di board; filter board by label/PIC; hari kerja vs hari kalender untuk auto-advance (saat ini 20 jam)
- **P2**: Client sebagai entitas CRM terpisah, integrasi WhatsApp/email, laporan advanced & export, template pekerjaan, autocomplete mention

## Next Tasks
1. Konfirmasi ke user: apakah mapping kolom Peta Skor untuk Admin Draf (SKOR 2 = PRATINJAU/PESAN NAMA/INPUTAN, SKOR 3 = FU NOTARIS/SIAP KIRIM/VIA WA) sudah sesuai proses aslinya.
2. Pertimbangkan jadwal cron hanya hari kerja (Senin-Jumat) jika diperlukan.

## Kredensial
Lihat `/app/memory/test_credentials.md`. Testing playbook: `/app/auth_testing.md`.
