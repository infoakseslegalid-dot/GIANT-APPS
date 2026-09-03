# Spesifikasi Sistem Bank Data & Distribusi Pekerjaan — GIANT Apps

## 1. Tujuan Utama

Mengatur distribusi pekerjaan antar-divisi dengan konsep yang tetap familiar bagi pengguna yang terbiasa memakai Trello.

### Masalah pada Sistem Lama

1. CS membuat Card.
2. Card di-mirror ke Board Admin.
3. Pekerjaan langsung masuk ke Board Admin.
4. Admin memilih pekerjaan yang ingin dikerjakan.
5. Tidak ada sistem pembagian yang jelas.
6. Tidak jelas siapa yang pertama mengambil pekerjaan.
7. Beban kerja antar-user sulit dipantau.
8. Pekerjaan dari client offline yang diterima Admin sering diberikan ke CS melalui WhatsApp sehingga tidak terstruktur.
9. Tidak ada tracking yang baik ketika pekerjaan diambil, dilepaskan, atau berpindah PIC.

### Solusi

Tambahkan **Bank Data Divisi** sebagai lapisan distribusi pekerjaan:

```
MASTER CARD
     ↓
MIRROR / KIRIM PEKERJAAN
     ↓
BANK DATA DIVISI
     ↓
USER CLAIM / AMBIL PEKERJAAN
     ↓
PIC DITETAPKAN
     ↓
MASUK BOARD USER
     ↓
PEKERJAAN DIKERJAKAN
```

---

## 2. Konsep Inti: Master Card

Semua Card utama dimiliki oleh Customer Service.

**User CS saat ini:** CS Dewi, CS Dedes, CS Julia, CS Devi.

```
CUSTOMER SERVICE
├── CS DEWI
├── CS DEDES
├── CS JULIA
└── CS DEVI
```

Setiap client/pekerjaan utama memiliki **Master Card** (contoh: "PT Nusantara Jaya", Owner: CS Dewi). Master Card **tidak berpindah kepemilikan** ketika pekerjaan diberikan ke Admin.

---

## 3. Owner vs PIC

| Konsep | Definisi | Contoh |
|---|---|---|
| **Owner** | Pemilik Master Card/client | CS Dewi |
| **PIC** | Orang yang mengerjakan assignment tertentu | Elis (Divisi: Admin Draf Input) |

> CS Dewi tetap Owner walaupun pekerjaan dikerjakan Elis.

---

## 4. Assignment / Pekerjaan Turunan

**Prinsip:** 1 Master Card → dapat memiliki banyak Assignment. Jangan buat Master Card baru setiap kali pekerjaan dikirim ke divisi lain.

```
MASTER CARD — PT ABC (Owner: CS Dewi)
├── Assignment #001 — Draft Akta → Admin Draf → Elis
├── Assignment #002 — NPWP → Admin Pajak → Anti
├── Assignment #003 — NIB → Admin Perizinan → Budi
└── Assignment #004 — Logo → Desain → Rina
```

---

## 5. Fungsi Bank Data

Bank Data **bukan** tempat membuat Master Card. Bank Data adalah tempat menunggu/menampung Assignment yang sudah dikirim ke suatu divisi tetapi belum diambil user tertentu.

```
CS Dewi → Kirim Assignment → BANK DATA ADMIN DRAF → Menunggu
   → Elis klik "Ambil Pekerjaan" → PIC = Elis → Assignment masuk Board Elis
```

---

## 6. Flow A — Pekerjaan dari CS ke Admin

Pengganti sistem Mirror lama.

| Sistem Lama | Sistem Baru |
|---|---|
| CS Dewi → Mirror → Board Admin | CS Dewi → Mirror/Kirim Pekerjaan → Bank Data Admin → Admin Claim → Board User Admin |

Contoh: Master Card "PT Nusantara Jaya" (Owner: Dewi) → Assignment "Siap Kirim Notaris" → Bank Data Admin Draf Input → Elis Ambil Pekerjaan → PIC: Elis → Board Elis.

---

## 7. Flow B — Client Baru / Offline

Client datang langsung ke kantor, Admin belum tahu CS mana yang menangani. Admin **tidak** memberikan pekerjaan via WhatsApp — dikirim ke **Bank Data Customer Service**.

```
CLIENT OFFLINE → ADMIN → BANK DATA CUSTOMER SERVICE
   → CS CLAIM → CS DEWI → MASTER CARD (Owner = CS Dewi)
```

---

## 8. Perbedaan Dua Flow

| | CS → Admin | Admin → CS (client baru) |
|---|---|---|
| Master Card | Sudah ada | Belum ada / belum ber-Owner |
| Alur | Master Card → Assignment → Bank Data Admin → Claim Admin | Client baru → Bank Data CS → CS Claim → Tentukan Owner CS → Buat Master Card |

Sistem harus membedakan kedua flow ini secara internal.

---

## 9. Board Divisi vs Board User

**Board Divisi:** Admin Draf Input, Admin Pajak, Admin Perizinan, Customer Service, Desain & Konten.

**Board User:** CS Dewi, CS Dedes, CS Julia, CS Devi, Elis, Anti, dst.

---

## 10–11. Visibilitas Assignment

**Sebelum ada PIC** — tampil di: Bank Data Admin Draf, Board Divisi Admin Draf. **Tidak** tampil di Board user manapun.

**Setelah Claim** (PIC = Elis, Status = CLAIMED) — tetap tampil di Bank Data & Board Divisi, **muncul** di Board Elis, tidak muncul sebagai pekerjaan aktif di board user lain.

---

## 12. Claim Harus Atomic (Anti Double-Claim)

Jika dua user klik "Ambil Pekerjaan" hampir bersamaan, hanya satu yang boleh berhasil (mis. Elis → SUCCESS, Anti → FAILED dengan pesan *"Pekerjaan ini baru saja diambil oleh Elis."*). Satu pekerjaan tidak boleh memiliki dua PIC.

---

## 13. Setelah Claim

Bank Data **tidak menghilangkan** card, tetap jadi pusat tracking, menampilkan: judul, dikirim oleh, PIC, status ("✓ Sudah Diambil").

---

## 14–16. Unclaim & Ambil Alih

- **Unclaim** ("Lepaskan Pekerjaan"): PIC sendiri bisa lepas → PIC = NULL → Assignment kembali ke Bank Data, status "Menunggu Diambil".
- **Yang boleh unclaim:** PIC sendiri, atau Admin/Supervisor berwenang (Ambil Alih). User lain tidak boleh klaim pekerjaan yang sudah diambil, kecuali punya permission khusus.
- **Ambil Alih:** Supervisor bisa memindahkan PIC lama → PIC baru secara langsung, tercatat di Activity Log.

---

## 17. Notifikasi

| Event | Notifikasi |
|---|---|
| Dikirim | 📤 Pekerjaan berhasil dikirim ke Bank Data [Divisi]. |
| Di-claim | ✅ [User] telah mengambil pekerjaan [Nama Pekerjaan]. |
| Unclaim | ↩️ [User] telah melepaskan pekerjaan [Nama Pekerjaan]. |
| Ambil Alih | 🔄 Pekerjaan [Nama] telah dialihkan dari [PIC lama] ke [PIC baru]. |

---

## 18. Activity Log

Semua perubahan dicatat kronologis: pembuatan Master Card, pengiriman assignment, masuk Bank Data, claim, perpindahan list, upload dokumen, penyelesaian, unclaim (dengan alasan), re-claim oleh user lain.

---

## 19–23. Form & UX "Kirim Pekerjaan"

Form sederhana (field minimal di awal, sisanya di "+ Opsi Tambahan"):

```
KIRIM PEKERJAAN
Pekerjaan *      [ PT ABC - Draft Akta ]
Client           [ PT ABC ]
Catatan          [ ... ]
Kirim ke Divisi  [ Admin Draf Input ▼ ]
List Awal        [ FU Notaris ▼ ]
Penanggung Jawab
  ● Biarkan anggota divisi mengambil sendiri
  ○ Tentukan user tertentu
[ + Opsi Tambahan ]
        [ Batal ]  [ Kirim Pekerjaan ]
```

- **PIC tidak wajib** — default: "Biarkan anggota divisi mengambil sendiri". Kalau pilih "Tentukan user tertentu" baru muncul daftar user untuk dicari & dipilih.
- **Istilah UI:** gunakan **"Kirim ke Divisi"**, bukan "Assign ke Board" — user tidak perlu tahu struktur Board/List di baliknya.

---

## 21. Dua Metode Assignment

| Mode | Deskripsi |
|---|---|
| **Open Claim** | Target divisi ditentukan, PIC belum ditentukan → user divisi ambil sendiri |
| **Direct Assignment** | Target + PIC langsung ditentukan → langsung masuk Board user tsb tanpa perlu claim |

---

## 24–25. Struktur & Tampilan Bank Data

**Sidebar** dengan badge jumlah pekerjaan menunggu:

```
BANK DATA DIVISI
🟠 Admin Draf Input     7
🟢 Admin Pajak          3
🔵 Admin Perizinan      5
🟣 Customer Service     2
🩷 Desain & Konten      4
```

**Tampilan:** Table View (bukan Kanban), karena Bank Data adalah antrean.

| No | Pekerjaan | Client | Dari | List | Umur | PIC | Status | Aksi |
|---|---|---|---|---|---|---|---|---|

---

## 26. Data Minimal di Bank Data

- **Identitas:** Assignment ID, Master Card ID, judul, nama client
- **Sumber:** dikirim oleh, divisi pengirim, waktu dikirim
- **Tujuan:** divisi tujuan, board tujuan, list tujuan
- **Distribusi:** status claim, PIC, waktu claim/unclaim
- **Monitoring:** umur pekerjaan, prioritas, deadline

---

## 27. Umur Pekerjaan

Ditampilkan sebagai durasi berjalan (15 menit, 32 menit, 2 jam, 1 hari...). Kalau melewati ambang waktu tertentu, ditandai merah (🔴) agar management bisa lihat pekerjaan yang terbengkalai.

---

## 28. Filter Bank Data

Filter Divisi, Status, PIC, Pengirim, Prioritas, Tanggal, Umur. Contoh use case: *"Tampilkan semua pekerjaan Admin Pajak yang belum diambil lebih dari 2 jam."*

---

## 29. Dashboard Beban Kerja

```
BEBAN KERJA ADMIN DRAF INPUT
┌──────────────┐ ┌──────────────┐
│ Elis         │ │ Anti         │
│ 7 pekerjaan  │ │ 4 pekerjaan  │
│ Draft: 3     │ │ Draft: 2     │
│ Revisi: 2    │ │ Revisi: 1    │
│ FU: 2        │ │ FU: 1        │
└──────────────┘ └──────────────┘
```

Bedakan pekerjaan yang sudah di-claim vs yang masih tersedia.

---

## 30. Pertanyaan yang Harus Terjawab Tanpa WhatsApp

- Berapa pekerjaan masuk? Berapa belum diambil?
- Siapa yang mengambil (per orang)? Siapa yang belum dapat pekerjaan?
- Pekerjaan ini dari siapa? Siapa PIC-nya? Kapan diambil?

---

## 31–33. Data Model

### Master Card
```
master_card_id
title
client
owner_user_id
owner_division_id
created_at
updated_at
```
Owner hanya dari user CS (normal). Untuk client offline: `owner_user_id = NULL` sampai CS melakukan Claim.

### Assignment
```
assignment_id
master_card_id
title
description
source_user_id
target_division_id
target_list_id
pic_user_id
status
priority
deadline
created_at
claimed_at
unclaimed_at
completed_at
```

### Status Assignment
```
WAITING_CLAIM
CLAIMED
IN_PROGRESS
WAITING
REVISION
COMPLETED
CANCELLED
```

### Status Distribusi (terpisah dari status pekerjaan)
```
WAITING_CLAIM
CLAIMED
RELEASED
DIRECT_ASSIGNED
```

---

## 34. Aturan Penting: Card Tidak Diduplikasi

Secara UI, user boleh merasa seperti "mirror card", tapi di database Master Card **tidak digandakan** — cukup relasi 1 Master Card → banyak Assignment.

---

## 35–36. Contoh Lengkap End-to-End

**Contoh CS → Admin:** Master Card "PT Nusantara Jaya" (Owner: CS Dewi) → Dewi kirim "Draft Akta" ke Admin Draf Input → Assignment #001 (PIC: NULL, Status: WAITING_CLAIM) muncul di Bank Data Admin Draf → Elis klik "Ambil Pekerjaan" → PIC: Elis, Status: CLAIMED → muncul di Board Elis. Master Card tetap Owner: CS Dewi.

**Contoh Client Offline:** Client "PT Maju Jaya" datang ke kantor → Admin buat Assignment/Client Intake → tujuan: Customer Service → masuk Bank Data Customer Service → Dewi klik "Ambil Pekerjaan" → Owner = CS Dewi → Master Card "PT Maju Jaya" dibuat, masuk Board CS Dewi.

---

## 37. Prinsip UX Utama

Jangan ubah mental model Trello terlalu jauh — user tetap merasa "punya Card → bekerja dengan Card → mirror/kirim pekerjaan". Yang berubah hanya penambahan lapisan Bank Data + Claim di antara Mirror dan Board Admin.

---

## 38. Prinsip UI Wajib

1. Sederhana
2. Gunakan istilah Bahasa Indonesia
3. Hindari istilah teknis jika tidak perlu
4. Pertahankan pola Card seperti Trello
5. Bank Data pakai Table View
6. Claim = "Ambil Pekerjaan"
7. Unclaim = "Lepaskan Pekerjaan"
8. Assign = "Kirim ke Divisi"
9. PIC opsional
10. Direct Assignment opsional
11. Field tambahan masuk "Opsi Tambahan"
12. Selalu tampilkan status pekerjaan
13. Selalu tampilkan Owner
14. Selalu tampilkan PIC
15. Selalu tampilkan sumber pekerjaan
16. Semua perubahan dicatat di Activity Log
17. Semua aksi penting menghasilkan Notification

---

## 39. Diagram Arsitektur Utama

```
                         CLIENT
                           │
                           ▼
                  ┌─────────────────┐
                  │   MASTER CARD   │
                  │ Client          │
                  │ Owner = CS      │
                  └────────┬────────┘
                           │
                    CREATE ASSIGNMENT
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ADMIN / DIVISI              CUSTOMER SERVICE
              │                         │
              ▼                         ▼
       BANK DATA DIVISI          BANK DATA CS
              │                         │
          CLAIM USER                CLAIM CS
              │                         │
              ▼                         ▼
        PIC DITETAPKAN            OWNER DITETAPKAN
              │                         │
              ▼                         ▼
        BOARD USER                MASTER CARD
              │
              ▼
          PROSES
```

Untuk pekerjaan dari Master Card ke banyak divisi sekaligus:

```
MASTER CARD (Owner = CS)
     ├── Mirror → Bank Data Admin      → Claim → Admin User Board
     ├── Mirror → Bank Data Pajak      → Claim → Pajak User Board
     └── Mirror → Bank Data Perizinan  → Claim → Perizinan User Board
```

---

## 40. Kalimat Inti untuk AI Developer

> Implementasikan sistem distribusi pekerjaan berbasis Master Card dan Assignment. Semua Master Card utama dimiliki oleh user Customer Service (CS Dewi, CS Dedes, CS Julia, CS Devi). Ketika CS memberikan pekerjaan kepada divisi lain, Master Card tidak berpindah dan tidak diduplikasi. Sistem membuat Assignment yang masuk terlebih dahulu ke Bank Data divisi tujuan. Assignment yang belum di-claim hanya tampil di Bank Data dan Board Divisi, belum masuk ke Board User. Anggota divisi dapat mengambil pekerjaan melalui tombol "Ambil Pekerjaan". Setelah berhasil diambil, user tersebut menjadi PIC dan Assignment otomatis muncul di Board User-nya. Assignment tetap tercatat di Bank Data dengan informasi PIC. PIC dapat "Lepaskan Pekerjaan" sehingga Assignment kembali tersedia untuk diambil user lain. User lain tidak dapat mengambil Assignment yang sudah di-claim, kecuali user dengan permission khusus melakukan "Ambil Alih". Semua claim, unclaim, assignment, perubahan PIC, perubahan status, komentar, attachment, dan aktivitas lainnya harus dicatat dalam Activity Log dan menghasilkan Notification yang relevan. Untuk client baru yang datang offline, Admin dapat mengirim pekerjaan langsung ke Bank Data Customer Service. CS yang melakukan Claim menjadi Owner Master Card tersebut dan pekerjaan kemudian masuk ke Board CS tersebut. Sistem harus mempertahankan pengalaman kerja seperti Trello: user membuat dan bekerja dengan Card dari Board mereka, sedangkan Bank Data menjadi lapisan distribusi pekerjaan di antara Owner dan PIC.

---

## Kesimpulan Arsitektur

Jangan anggap Bank Data sebagai "Board tambahan". Anggap sebagai lapisan distribusi:

```
                 MASTER CARD (Milik Customer Service)
                       │
                 ASSIGNMENT
                       ▼
                  BANK DATA (Antrian Divisi)
                       │
                  CLAIM / ASSIGN
                       ▼
                   USER PIC
                       ▼
                  BOARD USER
                       ▼
                    PROSES
```

Dengan arsitektur ini, Trello tetap menjadi inspirasi cara kerja user, tetapi GIANT Apps mendapat kemampuan distribusi pekerjaan, pemerataan beban kerja, tracking PIC, audit trail, notification, dan monitoring management yang lebih kuat.
