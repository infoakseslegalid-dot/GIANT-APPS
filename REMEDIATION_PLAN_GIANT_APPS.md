# RENCANA PERBAIKAN — Giant Apps Kanban (berdasarkan Audit Gap Agy)

> **Untuk Agy:** Ini tindak lanjut dari `AUDIT_SPEC_GIANT_APPS_KANBAN.md` dan laporan gap yang sudah Anda buat. Ali sudah menjawab 3 pertanyaan konfirmasi. Kerjakan **per Tier, berurutan** — jangan lompat ke Tier 2/3 sebelum Tier 0 selesai, karena beberapa item di Tier 1 akan otomatis lebih mudah/berubah bentuk setelah Tier 0 kelar.

---

## KEPUTUSAN KONFIRMASI DARI ALI (kunci final, tidak perlu ditanyakan lagi)

1. **List "SKOR 7 (Follow Up Kembali)"** → **tetap dipakai**. Harus ikut diagregasi ke Board Global Skor (halaman 2), bukan diabaikan seperti sekarang.
2. **Gate dokumen Hari 4-5 → Hari 6** (NPWP, Akun Coretax, Suket) → **sudah benar sesuai implementasi saat ini** (`routes_work.py:29`). Tidak perlu diubah. Tandai item ini **selesai/closed**, hapus dari daftar gap.
3. **Kriteria approval sebelum Finish** → **tetap toggle manual per kartu** (`needs_approval`), **tidak perlu** dibuatkan aturan otomatis berbasis divisi/jenis produk/board. Tandai item ini **selesai/closed**, hapus dari daftar gap — implementasi saat ini sudah sesuai keinginan Ali.

---

## TIER 0 — Refactor Fondasi (kerjakan lebih dulu, sebelum semua yang lain)

Ini akar dari beberapa gap sekaligus. Selesaikan dulu supaya Tier 1 tidak perlu dikerjakan dua kali.

### 0.1 Ekstrak `WorkAssignment` jadi entitas/collection terpisah
- **Gap asal:** §0, memicu juga §11 dan §12
- **Lokasi saat ini:** `routes_work.py:124-125` (array `member_ids`, `division_ids` di dalam dokumen `work_items`)
- **Target:** Buat collection/tabel `work_assignments` dengan field minimal: `work_item_id`, `division_id`, `user_id`, `assigned_by`, `assigned_at`, `claimed_at`, `status` (lihat 0.3), `completed_at`, `unassigned_reason` (nullable)
- **Migrasi data:** tulis script migrasi dari array `member_ids`/`division_ids` existing ke baris-baris `work_assignments` baru — jangan hilangkan histori yang sudah ada di activity log, cross-reference kalau perlu untuk rekonstruksi `assigned_at`
- **Dampak ikutan:** setelah ini beres, §12 (log histori penugasan terstruktur) otomatis punya sumber data yang benar — tidak perlu dikerjakan sebagai item terpisah, tinggal query dari `work_assignments`

### 0.2 Ekstrak `Client` jadi entitas terpisah
- **Gap asal:** §0, memicu juga §20
- **Lokasi saat ini:** `routes_work.py:91`, `seed.py:211` (`client_name` sebagai string bebas)
- **Target:** Buat collection/tabel `clients`: nama badan, jenis badan, PIC client, WhatsApp, email, alamat, NPWP, NIB. Relasi `work_items.client_id → clients.id`
- **Migrasi data:** dedupe `client_name` yang sudah ada di seed/data existing jadi baris `clients`, lalu re-link `work_items` ke `client_id`
- **Dampak ikutan:** setelah ini beres, halaman **Client Detail** (Tier 2, §19/§20) tinggal query relasi ini — jangan bangun Client Detail sebelum entitas ini ada

### 0.3 Perbaiki skema status ganda
- **Gap asal:** §11
- **Lokasi saat ini:** `routes_work.py:119`, `BankData.jsx`
- **Target:**
  - `distribution_status` (enum): tambahkan `DILEPASKAN`, `DIRECT_ASSIGNED` — total jadi 4 nilai: `MENUNGGU_DIAMBIL`, `DIAMBIL`, `DILEPASKAN`, `DIRECT_ASSIGNED`
  - `work_status` (enum): ganti dari `active/submitted/done` jadi 5 nilai resmi: `BARU`, `PROSES`, `MENUNGGU`, `REVISI`, `SELESAI`
  - Update semua tempat yang baca/tulis status ini (Bank Data view, Board view, filter, automation trigger) supaya konsisten pakai enum baru
  - Sediakan migrasi nilai lama → nilai baru (mapping `active→BARU`, `submitted→MENUNGGU` atau `REVISI` sesuai konteks, `done→SELESAI` — cek data existing dulu sebelum tentukan mapping submitted)

---

## TIER 1 — Koreksi Logika Bisnis (bergantung sebagian ke Tier 0)

### 1.1 Agregasi List SKOR 7 ke Board Global Skor
- **Keputusan Ali:** tetap dipakai, wajib diagregasi
- **Lokasi:** `routes_work.py:853-883` (fungsi agregasi board global skor saat ini stop di Skor 6)
- **Target:** tambahkan bucket Skor 7 di agregasi backend + tampilkan sebagai kolom/list tambahan di Board Global Skor (halaman 2). Definisikan posisi tampilnya (kemungkinan: cerminan dari list SKOR 7 di board CS masing-masing, mirip pola Skor 1)

### 1.2 Tutup 2 item yang sudah dikonfirmasi sesuai
- Gate dokumen Hari 4→6 (§9) — **tidak ada tindakan**, tandai closed
- Kriteria approval manual (§13) — **tidak ada tindakan**, tandai closed

---

## TIER 2 — Kelengkapan Fitur (independen, bisa dikerjakan paralel setelah Tier 0)

Urutkan berdasarkan dampak ke operasional harian tim (bukan berdasarkan urutan section):

| Prioritas | Item | Section | Lokasi |
|---|---|---|---|
| Tinggi | Notifikasi saat user di-invite ke board | §14 | `routes_admin.py:185` |
| Tinggi | Watch di level List & Board (baru ada di Card) | §16 | `routes_work.py:1010-1022` |
| Tinggi | Halaman "My Division" (union board semua anggota divisi) | §19 | `App.js:40-61` |
| Tinggi | Modul & entitas Client CRM-lite + halaman Client Detail | §20 | `routes_admin.py` (bergantung Tier 0.2 selesai dulu) |
| Sedang | Search lanjutan: cocokkan juga ke PIC dan nomor pekerjaan, tidak cuma title/client_name/board.name | §17 | `routes_work.py:740-757` |
| Sedang | Aksi automation: tambahkan `alert_role` / `send_notification` (saat ini baru ada add_label/remove_label/set_priority/assign_division) | §18 | `routes_admin.py:497-501` |
| Sedang | Granular RBAC berbasis permission matrix (saat ini hardcode role comparison) | §21 | `deps.py:26-35` |
| Sedang | Custom field: skema konfigurasi dinamis dari Admin Panel (saat ini array bebas per kartu) | §2 | `routes_work.py:132` |
| Rendah | Mention `@card` dan `@board` (saat ini baru `@username`) | §4 | `routes_work.py:575-580` |
| Rendah | Paste gambar dari clipboard di CardModal | §5 | `CardModal.jsx` |
| Rendah | Upload gambar custom untuk background board (saat ini hanya hex warna) | §1 | `routes_admin.py:139` |
| Rendah | Switch tampilan Table/List di board (saat ini hanya Kanban) | §19 | `BoardView.jsx` |
| Rendah | Widget ringkasan pekerjaan mandek di Dashboard Home (datanya sudah ada di /global/hari dan /global/skor, tinggal ditarik ke home) | §23 | `Dashboard.jsx` |
| Rendah | Tab Admin Panel yang belum ada: Klien, Roles & Permissions, Labels Global, Master Custom Fields, System Settings | §22 | `AdminPanel.jsx:370` |

---

## FORMAT LAPORAN PROGRES (untuk Agy pakai tiap kali lapor balik ke Ali)

Setelah mengerjakan satu Tier, laporkan HANYA dalam bentuk ini — jangan naratif panjang:

| Item | Status | Catatan singkat |
|---|---|---|
| 0.1 WorkAssignment entity | ✅ Selesai / 🔄 Dikerjakan / ⛔ Terblokir | ... |

Kalau ada keputusan teknis yang perlu dikonfirmasi Ali di tengah jalan (misal soal mapping migrasi `submitted` di 0.3), stop dan tanyakan dulu — jangan asumsi sendiri seperti sebelumnya.
