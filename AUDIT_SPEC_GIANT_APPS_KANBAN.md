# AUDIT SPEC — Modul Kanban/Work Management "Giant Apps" (Akseslegal.id)

> **Untuk Agy (coding agent):** Dokumen ini adalah kompilasi SEMUA requirement yang Ali berikan ke Emergent.sh lewat serangkaian prompt, termasuk hasil klarifikasi (Q&A) yang mengunci keputusan final. Tugas Anda: **audit codebase lokal hasil migrasi dari Emergent terhadap setiap poin di bawah**, lalu laporkan hanya bagian yang **berbeda/kurang/tidak sesuai** — jangan list ulang yang sudah sesuai secara detail, cukup ringkas "sesuai" di sana. Format laporan wajib ada di bagian paling bawah dokumen ini — ikuti persis.

---

## 0. PRINSIP ARSITEKTUR UTAMA (WAJIB DICEK PALING AWAL)

Ini adalah keputusan desain paling fundamental — kalau ini salah, banyak fitur lain otomatis salah juga.

- **Work Item = entitas tunggal**, BUKAN card yang di-duplicate ke tiap board. Satu pekerjaan hanya ada 1 baris data di database.
- Board/Bank Data/My Work/dsb adalah **VIEW/FILTER** dari Work Item yang sama, bukan copy data.
- `WorkAssignment` adalah entitas **terpisah** dari `WorkItem`, dengan field minimal: `division_id`, `user_id`, `assigned_by`, `assigned_at`, `claimed_at`, `status`, `completed_at`.
- Satu Work Item bisa punya **banyak WorkAssignment** sepanjang waktu (riwayat perpindahan divisi tersimpan semua, tidak ditimpa).
- `Client` adalah entitas terpisah (CRM-lite), 1 Client → banyak Work Item.

**Cek:** apakah implementasi lokal benar-benar pakai pola ini, atau malah balik ke pola "card per board" (duplicate row) ala Trello asli? Ini kemungkinan besar sumber bug utama kalau ada.

---

## 1. BOARD & LIST — fitur dasar

- CRUD board (create/edit/delete/archive/close/reopen/duplicate)
- Board: background (warna/gambar), description, members, invite/remove member, admin board, visibility (Private/Workspace/Public), activity log, search, filter, template, share link, copy link card/list/board
- CRUD list (create/rename/delete/archive/move antar board/copy/drag-drop/collapse/sort cards)
- Add card langsung dari list, archive semua card sekaligus, automation berbasis list

**Board yang harus ada (seed data):**
`ADMIN DRAF INPUT`, `ADMIN PAJAK`, `ADMIN PERIZINAN`, `DESAIN & KONTEN`, `CS DEDES`, `CS DEVI`, `CS DEWI`, `CS JULIA`

**List per divisi (referensi awal dari prompt — cek apakah sudah dipakai atau sudah diganti skema baru di §8/§9):**
- CS: KOMPLAIN, SKOR 1-2, SKOR 3, SKOR 4, SKOR 5, SKOR 6, SKOR 7
- Admin Draf Input: PRATINJAU, FU NOTARIS, SIAP KIRIM NOTARIS, VIA WA/GC ADMIN, PESAN NAMA, INPUTAN, FINISH, ADMIN
- Admin Pajak: LIST SPT TAHUNAN, LIST PENGURUSAN PAJAK, DOING, FINISH, KONTRAK PAJAK, EMAIL NOTARIS, ADMIN
- Admin Perizinan: PERIZINAN LANJUTAN, PRODUK LAINNYA, MEREK, MENUNGGU HASIL VERIFIKASI, TINDAK LANJUT MEREK, DONE TODAY, FINISH, NOTARIS SOPPENG
- Desain & Konten: Daily Rutin, LIST LOGO/COMPRO, DOING, FINISH, REVISI, REFERENSI, AKSES LEGAL INDONESIA & KHAL, KONTEN LAYANAN, INFLUENCER, RE-DESAIN

> ⚠️ **FLAG untuk konfirmasi ke Ali:** List "SKOR 7 (Follow Up Kembali)" disebut di prompt awal, tapi definisi Skor final (§8) hanya sampai Skor 6. Agy perlu cek: apakah Skor 7 masih dipakai di code, atau sudah usang?

---

## 2. WORK ITEM / CARD — field wajib

- Judul, description, Client (relasi, bukan teks bebas), jenis pekerjaan, members/PIC (multi — lihat §5), labels, due date, start date, cover, attachment, checklist, comment, activity log, custom fields, status/completion, priority

**Custom field contoh (harus configurable dari Admin Panel, bukan hardcode):**
Client Name, No. HP, Produk, Harga, CS, Status

---

## 3. DRAG & DROP
- Drag card antar list, antar board (sesuai permission)
- Reorder card dalam list
- Reorder item checklist
- Setiap drag WAJIB tercatat di Activity Log

---

## 4. COMMENT SYSTEM
- Text comment, edit, delete (sesuai permission)
- `@mention` user → user dapat notifikasi; dukung `@card`, `@board`
- Attachment di dalam comment (gambar/PDF/dokumen)
- Emoji reaction pada comment
- Notifikasi comment: saat di-mention, saat ada comment baru di card yang di-watch

---

## 5. ATTACHMENT
- Upload dari device, drag & drop, paste image dari clipboard
- Preview, download, delete
- Jadi cover card
- Link attachment (simpan URL tanpa upload)
- Metadata wajib: `filename`, `size`, `mime_type`, `uploaded_by`, `uploaded_at`, `version` — **tidak boleh hard delete, harus soft-delete/versioning**
- Storage: (cek implementasi lokal — versi Emergent pakai Emergent Object Storage, pastikan sudah diganti ke storage lokal yang setara)

---

## 6. CHECKLIST — DUA FUNGSI PENTING
1. Checklist biasa: CRUD item, assign item ke user, due date per item, convert item jadi card baru, progress % otomatis
2. **Checklist sebagai mekanisme syarat wajib per tahap** (KEPUTUSAN FINAL, lihat §8 dan §9) — setiap kartu punya item syarat per tahap yang harus dicentang sebelum boleh pindah tahap. Default syarat mengikuti definisi skor/hari di bawah, **tapi admin bisa override/custom per kasus**.

---

## 7. LABEL, DUE DATE, PRIORITY
- Label: CRUD, warna custom, multi-label per card, filter by label, jadi trigger automation
- Due date: start date + due date + reminder + status overdue otomatis
- Priority: Normal (default) / Tinggi / Urgent — **jangan wajib diisi user**, biarkan default Normal

---

## 8. SISTEM SKOR CS (definisi resmi — HARUS PERSIS)

| Skor | Definisi |
|---|---|
| 1 | Hanya kata pembuka, belum jawab pertanyaan dari AI |
| 2 | Isi form (belum ada data KTP & NPWP) — data: nama usaha/domisili/bidang usaha/nama pengurus |
| 3 | Sudah ada KTP & NPWP, menuju draft final, sudah bisa dijadwalkan tanda tangan |
| 4 | Sudah bayar DP/lunas, butuh konfirmasi atau revisi ke klien |
| 5 | Bisnis proses, update tiap hari (1–7 hari kerja), penyerahan |
| 6 | Finish |

**Rule wajib:** CS **tidak bisa** pindahkan card ke skor berikutnya sebelum syarat skor tersebut terpenuhi.

**Mekanisme validasi (KEPUTUSAN FINAL):** checklist wajib per kartu, item syarat per tahap harus dicentang. Isi syarat per skor = **default sistem, tapi admin bisa ubah/override** (gabungan, bukan hardcode permanen).

---

## 9. BOARD GLOBAL ADMIN — Halaman 1 (Kanban Hari 1–7)

**Permission:** semua user Admin Legal/Draft, Admin Perizinan, Admin Pajak, dan Desain & Konten bisa **melihat** board gabungan ini (bukan cuma divisinya sendiri).

**Struktur list (per hari kerja):**
- **Hari 1, 2, 3** — dikerjakan tim **ADMIN DRAF INPUT** — berlaku untuk Work Item yang statusnya Skor 5 di board CS
- **Hari 4, 5** — dikerjakan tim **ADMIN PAJAK** + **DESAIN & KONTEN** — Work Item Skor 5 di CS
- **Hari 6, 7** — dikerjakan tim **ADMIN PERIZINAN** + **DESAIN & KONTEN** — Work Item Skor 5 di CS

**Mekanisme perpindahan hari (KEPUTUSAN FINAL):** otomatis maju setiap hari (berbasis jadwal/tanggal) **DAN** admin bisa mempercepat maju secara manual **jika syarat dokumen sudah terpenuhi**.

**Syarat dokumen per transisi (validasi via checklist wajib):**
- Hari 1–3 → Hari 4: wajib ada dokumen **AKTA & SK**
- Hari 4–5 → Hari berikutnya: wajib ada dokumen **NPWP, AKUN CORETAX, SUKET**
  > ⚠️ **FLAG typo di prompt asli Ali:** teks aslinya "hari 4 dan 5 syarat bisa di pindahkan ke hari 5" — kemungkinan besar maksudnya **ke Hari 6**. Agy: cek implementasi mana yang dipakai, dan tanyakan ke Ali kalau ragu, jangan asumsi sendiri.
- Hari 6–7 → Finish: wajib ada dokumen **NIB**
- **Logo/desain**: kalau belum ada, tetap **boleh lanjut pindah** (non-blocking), TAPI wajib muncul **alert/notifikasi peringatan** bahwa file logo/desain belum lengkap.

**Tujuan bisnis (harus tercermin di dashboard/reporting):** supervisor bisa lihat progres global dan **otomatis mendeteksi pekerjaan yang mandek/overdue di hari mana**.

---

## 10. BOARD GLOBAL SKOR — Halaman 2 (Agregasi Semua CS, Read-only)

**Permission:** semua CS bisa melihat. **Sifat: read-only pantauan** (KEPUTUSAN FINAL) — tidak bisa drag/edit langsung dari board ini, hanya cerminan dari board asal.

**Mapping tampilan per skor:**
- Skor 1: posisi board CS Skor 1
- Skor 2: posisi board Admin Legal, list Draft/Revisi Draft
- Skor 3: posisi board Admin Legal (Draft/Revisi Draft) **DAN** tetap tampil paralel di board CS
- Skor 4: posisi board CS Skor 4
- Skor 5: posisi Board Global Admin (Hari 1–7, lihat §9)
- Skor 6: Finish

**Tujuan bisnis:** CS Lead bisa lihat lead mana yang tidak pernah di-follow-up / mandek.

---

## 11. BANK DATA / WORK BANK (mekanisme distribusi pekerjaan)

**Konsep:** Bank Data BUKAN tempat kerja dibuat — ia "ruang tunggu" setelah pekerjaan dikirim ke divisi tujuan, sebelum diambil PIC.

**Akses (KEPUTUSAN FINAL):** SEMUA user bisa **melihat** Bank Data semua divisi. HANYA **anggota divisi terkait** yang boleh **claim**.

**Dua level assignment:**
1. **Assign ke Divisi saja** — belum ada PIC, semua anggota divisi bisa claim
2. **Assign ke Divisi + User tertentu** — harus pilih divisi dulu, baru bisa pilih user dari anggota divisi tsb; tetap tampil di Bank Data dengan PIC sudah terisi

**Multi-divisi (KEPUTUSAN FINAL):** satu Work Item **boleh** di-assign ke beberapa divisi sekaligus (mis. Admin Draf + Admin Pajak + Admin Perizinan bersamaan).

**Claim (KEPUTUSAN FINAL):** siapa saja anggota divisi boleh claim; supervisor boleh override/ambil alih pekerjaan yang sudah diklaim orang lain.

**Multi-PIC (KEPUTUSAN FINAL — ini override rekomendasi lama "1 PIC utama + kolaborator"):** satu Work Item boleh punya **banyak PIC yang statusnya setara** (bukan 1 utama + kolaborator).

**Unclaim:** PIC bisa lepas pekerjaan → hilang dari Board/My Work milik dia secara otomatis → status kembali "Belum ada PIC" → kembali available untuk anggota divisi lain claim.

**Form "Kirim Pekerjaan ke Bank Data" — field:**
- Wajib: Judul pekerjaan; Divisi Tujuan (jika dikirim ke divisi lain)
- Optional: Client (relasi), Catatan, List Awal
- Radio Penanggung Jawab: "Biarkan anggota divisi mengambil sendiri" / "Tentukan user tertentu" (baru muncul dropdown user setelah opsi ini dipilih)
- Bagian "Opsi Tambahan" (collapsed by default): Prioritas (default Normal), Deadline, Label, Attachment, Checklist
- Field otomatis dari sistem (jangan diisi user): pembuat, waktu dibuat, **sumber pekerjaan** (CS/divisi asal atau "Client Offline"), status, ID pekerjaan unik

**UI penting:** jangan tampilkan istilah "Board Tujuan" ke user — cukup "Kirim ke Divisi [dropdown]" lalu sistem yang resolve ke board yang tepat di belakang layar.

**Tabel Bank Data — kolom wajib:** Pekerjaan, Sumber/Dari, List, **Umur** (durasi menunggu sejak dikirim, dengan indikator warna: 🟢 <2 jam, 🟡 2–8 jam, 🔴 >8 jam), PIC, tombol aksi kontekstual:
- `[ AMBIL PEKERJAAN ]` — kalau belum ada PIC
- `🔒 Sudah diambil oleh [nama]` — kalau sudah diklaim orang lain
- `✓ Pekerjaan Anda` — kalau milik user login
- `[ Ambil Alih ]` — khusus supervisor/admin tertentu

**Status ganda (dua field terpisah, jangan digabung jadi satu status):**
- Status Distribusi: `MENUNGGU DIAMBIL` / `DIAMBIL` / `DILEPASKAN` / `DIRECT ASSIGNED`
- Status Pekerjaan: `BARU` / `PROSES` / `MENUNGGU` / `REVISI` / `SELESAI`

**Dua jalur sumber pekerjaan (mesin sama, titik awal beda):**
- Pekerjaan lama (sudah punya CS): `CS → Mirror/Kirim → Bank Data divisi tujuan → Claim → Board PIC`
- Pekerjaan baru/client offline (belum ada CS): `Admin → Bank Data CS → Claim → Board CS`

---

## 12. WORKFLOW LINTAS DIVISI (KEPUTUSAN FINAL)

Saat Work Item berpindah divisi (CS → Admin Draf → Admin Pajak → dst), setiap perpindahan dicatat sebagai **`WorkAssignment` baru** pada **Work Item yang sama** (bukan card/row baru) — riwayat lengkap harus tersimpan: siapa assign, kapan, dari divisi/user mana ke divisi/user mana.

---

## 13. STATUS SELESAI / APPROVAL FLOW (KEPUTUSAN FINAL)

Untuk pekerjaan **tertentu saja** (bukan semua): Staff klik "Selesai" → masuk status **menunggu approval** → Supervisor approve → baru masuk `FINISH`.

> ⚠️ **FLAG untuk konfirmasi ke Ali:** yang mana definisi "pekerjaan tertentu" ini belum eksplisit di prompt manapun. Agy perlu cek apakah ada aturan ini di kode (field `requires_approval` per jenis pekerjaan/board?), dan kalau tidak ada, tanyakan ke Ali kriteria pastinya sebelum implementasi.

---

## 14. NOTIFIKASI

**Trigger wajib:** mention, di-assign, di-claim, di-reassign/ambil alih, unclaim (dengan alasan), comment baru pada card yang di-watch, due date mendekat, overdue, checklist item ter-assign, invite ke board.

**Contoh format (bisa dipakai sebagai acuan copy):**
- `📨 Pekerjaan dikirim — [Judul]. Tujuan: [Divisi]`
- `✅ Pekerjaan diambil — [Nama] telah mengambil pekerjaan: [Judul]`
- `↩️ Pekerjaan dilepaskan — [Nama] telah melepaskan pekerjaan: [Judul]. Alasan: [teks]`

Sumber pekerjaan (CS asal) HARUS menerima notifikasi ini juga, bukan cuma penerima.

---

## 15. ACTIVITY LOG (audit trail)

Wajib mencatat dengan timestamp presisi menit: pembuatan card, upload file, comment, mention, pindah list/skor/hari, assign ke divisi/user, claim, unclaim (+alasan), reassign/ambil alih, checklist tercentang, perubahan PIC, approval selesai.

---

## 16. WATCH / FOLLOW
Bisa watch di level Card, List, maupun Board — user yang watch dapat notifikasi walau bukan PIC.

---

## 17. SEARCH, FILTER, SORT

- **Search global**: nama client, PIC, nomor pekerjaan, jenis pekerjaan
- **Filter**: member, label, due date, keyword, status pekerjaan, list, board, divisi, urgent, overdue, belum ada PIC, punya PIC, "pekerjaan saya"
- **Sort**: due date, oldest/newest, alfabetis, priority

---

## 18. AUTOMATION (Butler-like, trigger → action)

Contoh rule minimal yang harus bisa dibuat dari Admin Panel (bukan hardcode):
- WHEN card masuk Skor 4 → THEN assign/alert ke Notaris
- WHEN card masuk status Selesai/Finish → THEN tambah label "Finish"
- WHEN Work Item di-assign ke divisi lain → THEN tambah label "Ter-sync ke [Divisi]" di tampilan asal; WHEN unassign/dilepas → THEN hapus label tsb
- Automation berbasis List (per-list rules)

---

## 19. MULTI-VIEW PER USER (navigasi wajib)

- 🏠 Dashboard/Home
- 👤 **My Work / Pekerjaan Saya** — hanya Work Item yang di-assign ke user login
- 🏢 **My Division / Divisi Saya** — board gabungan SEMUA anggota divisi yang sama (union semua board user dalam 1 divisi)
- 📥 **Bank Data** — per divisi, lihat §11
- 📋 **All Work / Semua Pekerjaan** — sesuai permission
- Board Global Admin (Hari 1–7) — §9
- Board Global Skor (read-only, semua CS) — §10
- Halaman **Client Detail**
- Switch tampilan: Kanban / Table / List (minimal Kanban wajib MVP, Table/List nice-to-have)

---

## 20. CLIENT ENTITY (CRM-lite)

**Field:** nama badan usaha, jenis badan (PT/CV/Yayasan/Perkumpulan/PT Perorangan/dll), PIC client, WhatsApp, email, alamat, NPWP, NIB.

**Relasi:** 1 Client → banyak Work Item (Pendirian PT, NPWP, NIB, Merek, Logo, dll — masing-masing Work Item terpisah tapi terhubung ke Client yang sama).

**Halaman Client Detail:** daftar semua Work Item milik client, dokumen, riwayat/timeline, contact person.

---

## 21. RBAC / PERMISSION

**Role:** `SUPER ADMIN`, `ADMIN`, `SUPERVISOR`, `STAFF`, `VIEWER`

**Permission granular (contoh minimal, harus per-resource.action bukan hardcode role check):**
`work.view/create/edit/delete/claim/assign/reassign/move/comment/upload/complete`
`board.view/create/edit/delete`
`user.view/create/edit/delete`

**Aktor/divisi:** Klien (dashboard terpisah, TIDAK bisa akses tampilan internal sama sekali), Admin Legal (Draft), Admin Perizinan, Admin Pajak (+Finance), Desain, CS, Programmer, Bos/Owner, Manajer.

**Aturan visibility:**
- Sesama CS boleh saling lihat board masing-masing
- Admin Legal & Admin Perizinan board terpisah secara default (kecuali di Board Global Admin gabungan, §9)
- Bank Data terlihat semua divisi (read), tapi claim hanya anggota divisi terkait (§11)
- Visibility lintas divisi diatur oleh **permission**, bukan oleh board itu sendiri

---

## 22. ADMIN PANEL

Modul wajib: Users (CRUD + assign divisi + role), Divisions, Boards, Lists/Status, Roles & Permissions, Labels, Clients, Work Items, Automation rules, Activity Logs, Attachments, System Settings.

---

## 23. DASHBOARD / KPI (untuk Owner & Supervisor)

- Total pekerjaan, belum diambil, sedang dikerjakan, overdue, selesai hari ini
- Workload per divisi, workload per user
- Deteksi otomatis pekerjaan mandek/overdue per hari (dari Board Global Admin §9)
- Deteksi lead CS yang tidak pernah di-follow-up (dari Board Global Skor §10)

---

## 24. REAL-TIME COLLABORATION

Perubahan card, assignment, comment, status, drag-drop, notifikasi **harus real-time** ke user lain tanpa refresh manual (cek implementasi: websocket/SSE/polling — pastikan konsisten dan tidak ada state basi antar tab/user).

---

## 25. HAL YANG SENGAJA DI-EXCLUDE DARI MVP (cek jangan sampai malah setengah-setengah dikerjakan tanpa arahan baru)

AI Agent penuh, integrasi WhatsApp native, sync Google Drive/Dropbox/OneDrive, integrasi email, automation kompleks, advanced reporting, mobile app native, billing/subscription.

> Kalau salah satu dari ini SUDAH mulai diimplementasi di kode lokal, catat sebagai temuan — bukan berarti salah, tapi Ali perlu tahu ada scope creep dari MVP awal.

---

## FORMAT LAPORAN UNTUK AGY (WAJIB DIIKUTI)

Jangan buat laporan naratif panjang. Ali hanya butuh melihat **apa yang berbeda/kurang**, bukan konfirmasi ulang semua yang sudah benar.

Untuk setiap section (0–25) di atas, buat baris tabel **HANYA jika statusnya bukan "Sesuai penuh"**:

| # Section | Item Spesifik | Status | Lokasi File/Kode | Gap / Catatan |
|---|---|---|---|---|
| §11 | Multi-PIC | ⚠️ Sebagian | `models/work_assignment.py` | Masih pakai 1 PIC utama + collaborator, seharusnya semua PIC setara |
| §9 | Alert logo kosong | ❌ Belum Ada | — | Tidak ditemukan validasi/alert saat logo belum ada tapi tetap boleh lanjut |

**Legenda status:**
- ✅ Sesuai penuh — tidak perlu masuk tabel, cukup disebut di ringkasan akhir "Section X: sesuai"
- ⚠️ Sebagian — ada tapi tidak lengkap/tidak sesuai detail
- ❌ Belum ada — sama sekali tidak ditemukan di kode
- ❓ Perlu konfirmasi Ali — spec sendiri ambigu (termasuk 3 flag yang sudah ditandai di §1, §9, §13 di atas)

Di akhir laporan, tambahkan bagian **"Pertanyaan untuk Ali"** berisi semua item berstatus ❓ dalam bentuk pertanyaan langsung yang bisa dijawab singkat.
