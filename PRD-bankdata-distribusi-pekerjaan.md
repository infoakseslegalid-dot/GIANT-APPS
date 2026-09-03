# PRD: Sistem Bank Data & Distribusi Pekerjaan — GIANT Apps

| | |
|---|---|
| **Dokumen** | Product Requirements Document (PRD) |
| **Modul** | Bank Data & Distribusi Pekerjaan |
| **Status** | Draft — siap untuk technical breakdown |
| **Versi** | 1.0 |

---

## 1. Ringkasan Eksekutif

GIANT Apps saat ini adalah sistem manajemen pekerjaan berbasis Board/List/Card ala Trello. Modul ini menambahkan **lapisan distribusi pekerjaan (Bank Data)** di antara pembuatan pekerjaan oleh Customer Service (CS) dan pengerjaannya oleh divisi lain, untuk menggantikan mekanisme "Mirror Card" lama yang tidak punya sistem antrean, klaim, maupun tracking beban kerja yang jelas.

---

## 2. Latar Belakang & Masalah

Sistem lama: CS membuat Card → di-mirror ke Board Admin → langsung masuk Board Admin tanpa mekanisme pembagian.

**Masalah yang teridentifikasi:**

1. Tidak ada sistem pembagian pekerjaan yang jelas.
2. Tidak jelas siapa yang pertama mengambil pekerjaan.
3. Beban kerja antar-user sulit dipantau.
4. Pekerjaan dari client offline sering diteruskan lewat WhatsApp — tidak terstruktur, tidak tercatat.
5. Tidak ada tracking saat pekerjaan diambil, dilepaskan, atau berpindah PIC.

---

## 3. Tujuan (Goals)

- Menyediakan **antrean terpusat (Bank Data)** per divisi untuk pekerjaan yang belum ada penanggung jawabnya.
- Memisahkan konsep **Owner** (pemilik client/Master Card) dari **PIC** (pengerjaan aktual per tugas).
- Mencegah **double-claim** pada pekerjaan yang sama.
- Menyediakan **audit trail** lengkap (Activity Log) dan **notifikasi** otomatis di setiap perubahan status.
- Memungkinkan management menjawab pertanyaan operasional (jumlah pekerjaan masuk, belum diambil, distribusi per orang) tanpa mengecek WhatsApp secara manual.
- Menjaga **mental model Trello** yang sudah familiar bagi user, agar adopsi tidak butuh pelatihan ulang besar-besaran.

### Non-Goals

- Modul ini **tidak** mengubah struktur Board/List/Card yang sudah ada — hanya menambah lapisan distribusi sebelum Card masuk ke Board User.
- Tidak membahas integrasi WhatsApp/eksternal (di luar scope dokumen ini).

---

## 4. Target Pengguna

| Role | Kebutuhan Utama |
|---|---|
| **Customer Service (CS Dewi, CS Dedes, CS Julia, CS Devi)** | Membuat Master Card, mengirim pekerjaan ke divisi, menerima client offline via Bank Data CS |
| **Anggota Divisi (Admin Draf, Admin Pajak, Admin Perizinan, Desain, dll)** | Mengambil ("claim") pekerjaan dari Bank Data divisinya, mengerjakan di Board pribadi |
| **Supervisor/Admin berwenang** | Memantau beban kerja, melakukan "Ambil Alih" PIC bila diperlukan |
| **Management** | Melihat dashboard distribusi & beban kerja tanpa perlu menelusuri chat manual |

---

## 5. Terminologi Wajib (UI)

| Istilah Teknis | Istilah UI (Bahasa Indonesia) |
|---|---|
| Assign | **Kirim ke Divisi** |
| Claim | **Ambil Pekerjaan** |
| Unclaim | **Lepaskan Pekerjaan** |
| Reassign paksa | **Ambil Alih** |

> Prinsip: hindari istilah teknis. User tidak perlu tahu struktur Board → Board Type → Division → List; cukup tahu "Kirim ke: [Divisi]".

---

## 6. Konsep Data Utama

### 6.1 Master Card
Representasi satu client/pekerjaan utama. **Selalu dimiliki oleh user CS.** Tidak berpindah kepemilikan dan tidak diduplikasi ketika pekerjaan diturunkan ke divisi lain.

### 6.2 Assignment
Pekerjaan turunan dari satu Master Card, dikirim ke satu divisi tertentu. **1 Master Card dapat memiliki banyak Assignment**, masing-masing dengan PIC, status, dan divisi tujuannya sendiri.

### 6.3 Owner vs PIC

| | Owner | PIC |
|---|---|---|
| Definisi | Pemilik Master Card | Pengerjaan Assignment tertentu |
| Contoh | CS Dewi | Elis (Admin Draf Input) |
| Berubah saat assignment dikerjakan divisi lain? | Tidak | Ya, sesuai siapa yang claim |

---

## 7. User Flows

### 7.1 Flow A — CS ke Admin (pekerjaan dari Master Card yang sudah ada)

```
CS Dewi → Kirim Pekerjaan → Bank Data Admin Draf
   → Elis "Ambil Pekerjaan" → PIC: Elis → Board Elis
```

Master Card tetap ber-Owner CS Dewi sepanjang proses.

### 7.2 Flow B — Client Offline / Baru (Master Card belum ada)

```
Client datang ke kantor → Admin buat pekerjaan → Bank Data Customer Service
   → CS Dewi "Ambil Pekerjaan" → Owner ditetapkan: CS Dewi → Master Card dibuat
```

### 7.3 Perbedaan Kunci

| | Flow A (CS → Admin) | Flow B (Admin → CS) |
|---|---|---|
| Master Card | Sudah ada | Belum ada (`owner_user_id = NULL` sampai claim) |
| Hasil Claim | PIC ditetapkan pada Assignment | Owner ditetapkan pada Master Card baru |

### 7.4 Claim (Atomic)

- Saat dua user klik "Ambil Pekerjaan" hampir bersamaan, sistem hanya boleh meloloskan **satu**.
- User yang gagal mendapat pesan: *"Pekerjaan ini baru saja diambil oleh [nama user]."*
- **Requirement teknis:** operasi claim harus dilakukan sebagai transaksi atomic di level database (row lock / conditional update) untuk mencegah race condition.

### 7.5 Unclaim & Ambil Alih

| Aksi | Siapa yang boleh | Efek |
|---|---|---|
| **Lepaskan Pekerjaan** | PIC yang bersangkutan | PIC → NULL, Assignment kembali ke status "Menunggu Diambil" di Bank Data |
| **Ambil Alih** | Admin/Supervisor dengan permission khusus | PIC lama diganti langsung ke PIC baru, tercatat di Activity Log |
| Klaim pekerjaan yang sudah diambil orang lain | Tidak diizinkan (kecuali via Ambil Alih) | — |

---

## 8. Visibilitas Assignment (Aturan Tampil)

| Status | Bank Data Divisi | Board Divisi | Board User (PIC) | Board User Lain |
|---|---|---|---|---|
| WAITING_CLAIM (belum ada PIC) | ✅ Tampil | ✅ Tampil | ❌ Tidak tampil | ❌ Tidak tampil |
| CLAIMED (PIC ditetapkan) | ✅ Tetap tampil (untuk tracking) | ✅ Tetap tampil | ✅ Muncul | ❌ Tidak tampil sebagai pekerjaan aktif |

---

## 9. Functional Requirements

### 9.1 Form "Kirim Pekerjaan"

Field minimal, sisanya disembunyikan di balik "+ Opsi Tambahan":

- Pekerjaan* (judul)
- Client
- Catatan
- Kirim ke Divisi (dropdown)
- List Awal (dropdown)
- Penanggung Jawab:
  - ○ Biarkan anggota divisi mengambil sendiri *(default)*
  - ○ Tentukan user tertentu → menampilkan search & pilih user

### 9.2 Mode Assignment

| Mode | PIC saat dibuat | Perlu Claim? |
|---|---|---|
| **Open Claim** | Kosong | Ya — anggota divisi mengambil sendiri |
| **Direct Assignment** | Ditentukan langsung | Tidak — langsung masuk Board user tsb |

### 9.3 Tampilan Bank Data

- **View:** Table (bukan Kanban) — karena berfungsi sebagai antrean.
- **Kolom minimal:** Pekerjaan, Client, Dari, List, Umur, PIC, Status, Aksi.
- **Sidebar** menampilkan badge jumlah pekerjaan menunggu per divisi.
- **Umur pekerjaan** dihitung otomatis (mis. "15 menit", "2 jam", "1 hari") dan diberi highlight (🔴) jika melewati ambang batas waktu tertentu.

### 9.4 Filter Bank Data

Wajib mendukung filter: Divisi, Status, PIC, Pengirim, Prioritas, Tanggal, Umur (kombinasi filter, mis. "Admin Pajak, belum diambil > 2 jam").

### 9.5 Dashboard Beban Kerja

Menampilkan jumlah pekerjaan per anggota divisi, dipecah berdasarkan jenis (Draft, Revisi, FU, dll), serta membedakan pekerjaan yang **sudah di-claim** vs **masih tersedia** di Bank Data.

### 9.6 Notifikasi (wajib trigger otomatis)

| Event | Penerima | Isi |
|---|---|---|
| Pekerjaan dikirim | Pengirim | Konfirmasi terkirim ke Bank Data [Divisi] |
| Pekerjaan di-claim | Pengirim (Owner) | [User] telah mengambil [Nama Pekerjaan] |
| Pekerjaan di-unclaim | Pengirim (Owner) | [User] telah melepaskan [Nama Pekerjaan] |
| Ambil Alih | Owner | Pekerjaan dialihkan dari [PIC lama] ke [PIC baru] |

### 9.7 Activity Log

Setiap event berikut wajib tercatat dengan timestamp: pembuatan Master Card, pengiriman Assignment, masuk Bank Data, claim, unclaim (+alasan), ambil alih, perpindahan list/status, upload attachment, komentar, penyelesaian pekerjaan.

---

## 10. Data Model

### 10.1 Master Card

```
master_card_id       PK
title                string
client                string
owner_user_id         FK -> User (nullable untuk client offline sebelum claim)
owner_division_id     FK -> Division
created_at            timestamp
updated_at            timestamp
```

### 10.2 Assignment

```
assignment_id         PK
master_card_id        FK -> Master Card
title                 string
description           text
source_user_id         FK -> User (pengirim)
target_division_id     FK -> Division
target_list_id         FK -> List
pic_user_id            FK -> User (nullable)
status                 enum
priority               enum
deadline                datetime (nullable)
created_at             timestamp
claimed_at             timestamp (nullable)
unclaimed_at           timestamp (nullable)
completed_at           timestamp (nullable)
```

### 10.3 Enum Status

**Status Pekerjaan (progress):**
```
WAITING_CLAIM | CLAIMED | IN_PROGRESS | WAITING | REVISION | COMPLETED | CANCELLED
```

**Status Distribusi (klaim — terpisah, jangan dicampur dengan status pekerjaan):**
```
WAITING_CLAIM | CLAIMED | RELEASED | DIRECT_ASSIGNED
```

> ⚠️ **Constraint penting:** relasi Master Card → Assignment adalah 1-ke-banyak. Master Card **tidak boleh diduplikasi** di database meskipun secara UI terasa seperti "mirror card".

---

## 11. Aturan Bisnis & Constraint Kritis

1. Owner Master Card hanya boleh diisi oleh user berrole CS, kecuali kondisi client offline (`owner_user_id = NULL` sampai claim terjadi).
2. Claim harus atomic — tidak boleh dua user berhasil claim Assignment yang sama.
3. Assignment tanpa PIC tidak boleh muncul di Board User manapun.
4. Status distribusi (klaim) dan status pekerjaan (progress) harus disimpan sebagai field terpisah.
5. Semua perubahan PIC (claim, unclaim, ambil alih) wajib menghasilkan entri Activity Log dan Notification.

---

## 12. Prinsip UI/UX

1. Sederhana — hindari terlalu banyak field di form awal.
2. Bahasa Indonesia, hindari istilah teknis di permukaan UI.
3. Pertahankan pola Card seperti Trello agar user existing tidak perlu belajar ulang.
4. Bank Data selalu Table View.
5. Gunakan istilah "Ambil Pekerjaan" / "Lepaskan Pekerjaan" / "Kirim ke Divisi" (lihat §5).
6. PIC dan Direct Assignment bersifat opsional saat mengirim pekerjaan.
7. Field tambahan (di luar field wajib) disembunyikan di "+ Opsi Tambahan".
8. Status, Owner, PIC, dan sumber pekerjaan **selalu** terlihat di card/assignment manapun ditampilkan.

---

## 13. Metrik Keberhasilan

- Management dapat menjawab tanpa membuka WhatsApp: jumlah pekerjaan masuk, jumlah belum diambil, distribusi per PIC, siapa yang belum mendapat pekerjaan.
- Berkurangnya pekerjaan yang "hilang"/tidak terlacak akibat koordinasi manual.
- Waktu rata-rata (umur) pekerjaan menunggu di Bank Data dapat dipantau dan ditekan turun dari waktu ke waktu.
- Tidak ada kasus double-claim tercatat di sistem produksi.

---

## 14. Diagram Arsitektur

```
                         CLIENT
                           │
                  ┌─────────────────┐
                  │   MASTER CARD   │
                  │ Owner = CS      │
                  └────────┬────────┘
                           │
                    CREATE ASSIGNMENT
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

---

## 15. Kalimat Ringkas untuk AI/Developer (Prompt Siap Pakai)

> Implementasikan sistem distribusi pekerjaan berbasis Master Card dan Assignment. Semua Master Card utama dimiliki oleh user Customer Service (CS Dewi, CS Dedes, CS Julia, CS Devi). Ketika CS memberikan pekerjaan kepada divisi lain, Master Card tidak berpindah dan tidak diduplikasi. Sistem membuat Assignment yang masuk terlebih dahulu ke Bank Data divisi tujuan. Assignment yang belum di-claim hanya tampil di Bank Data dan Board Divisi, belum masuk ke Board User. Anggota divisi dapat mengambil pekerjaan melalui tombol "Ambil Pekerjaan". Setelah berhasil diambil, user tersebut menjadi PIC dan Assignment otomatis muncul di Board User-nya. Assignment tetap tercatat di Bank Data dengan informasi PIC. PIC dapat "Lepaskan Pekerjaan" sehingga Assignment kembali tersedia untuk diambil user lain. User lain tidak dapat mengambil Assignment yang sudah di-claim, kecuali user dengan permission khusus melakukan "Ambil Alih". Semua claim, unclaim, assignment, perubahan PIC, perubahan status, komentar, attachment, dan aktivitas lainnya harus dicatat dalam Activity Log dan menghasilkan Notification yang relevan. Untuk client baru yang datang offline, Admin dapat mengirim pekerjaan langsung ke Bank Data Customer Service. CS yang melakukan Claim menjadi Owner Master Card tersebut dan pekerjaan kemudian masuk ke Board CS tersebut. Sistem harus mempertahankan pengalaman kerja seperti Trello: user membuat dan bekerja dengan Card dari Board mereka, sedangkan Bank Data menjadi lapisan distribusi pekerjaan di antara Owner dan PIC.

---

## 16. Open Questions (untuk didiskusikan sebelum development)

- Berapa lama ambang waktu "umur pekerjaan" sebelum ditandai merah (🔴)? Apakah sama untuk semua divisi atau bisa dikonfigurasi per divisi?
- Siapa saja yang punya permission "Ambil Alih" — hanya role Supervisor/Admin, atau bisa dikonfigurasi per divisi?
- Apakah prioritas pekerjaan (priority field) diisi manual saat kirim, atau ada aturan otomatis (mis. berdasarkan deadline)?
- Apakah dashboard beban kerja perlu difilter per periode (harian/mingguan/bulanan)?
