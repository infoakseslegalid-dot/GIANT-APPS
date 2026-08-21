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

## Status Implementasi (21 Agu 2026 — MVP selesai & lulus testing 100%)
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
- **P0**: — (kosong, MVP stabil)
- **P1**: Notifikasi due-date mendekat/overdue terjadwal (cron harian via .emergent/crons.yml); tampilan Table/List selain Kanban di board; filter board by label/PIC; pagination aktivitas
- **P2**: Client sebagai entitas CRM terpisah (jika user berubah pikiran), integrasi WhatsApp/email, laporan advanced & export, template pekerjaan, lampiran versi, komentar autocomplete mention

## Next Tasks
1. Konfirmasi ke user: apakah P1 (reminder due date via cron, view table/list) diinginkan berikutnya.
2. Setelah dipakai: kumpulkan feedback UX dari tim CS/Admin.

## Kredensial
Lihat `/app/memory/test_credentials.md`. Testing playbook: `/app/auth_testing.md`.
