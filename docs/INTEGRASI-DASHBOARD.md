# Integrasi GIANT-APPS → Dashboard Klien (akseslegal.id/dashboard)

Tujuannya: dokumen hasil (Akta, SK, NPWP, NIB, …) yang diupload divisi di GIANT-APPS **muncul sendiri**
di "Berkas Dokumen" dashboard klien, lengkap dengan link Google Drive-nya, tanpa copy-paste.

Ada dua cara, dan boleh dipakai keduanya:

| Cara | Kapan | Yang perlu dibuat di dashboard |
|---|---|---|
| **A. Webhook (push)** ⭐ | GIANT-APPS **mengirim** data begitu pekerjaan FINISH dan semua dokumen hasil sudah di Drive | 1 endpoint penerima `POST` |
| **B. API (pull)** | Dashboard **mengambil** data kapan saja (tombol "Tarik dari GIANT", cron, atau saat klien membuka halaman) | Pemanggil `GET` |

## 1. API key

Di GIANT-APPS: **Arsip Dokumen → Integrasi Drive & Dashboard → Buat API key**. Key hanya ditampilkan
sekali; simpan di `.env` dashboard, misalnya `GIANT_API_KEY=gak_...`.

- Untuk API (pull): kirim sebagai header `X-API-Key: gak_...`.
- Untuk webhook (push): key yang sama dipakai sebagai kunci tanda tangan (HMAC).

## 2. Bentuk data satu perusahaan

```json
{
  "code": "AL-9CC77D",
  "job_key": "mc_9cc77de0-...",
  "company_name": "PT Maju Mundur",
  "service_type": "PT Umum",
  "status": "SELESAI",
  "akta_number": "20",
  "nib_number": "1109260080634",
  "established_date": "2026-09-04",
  "finished_at": "2026-09-14T08:00:00.000Z",
  "client": { "name": "Budi Santoso", "phone": "0812-3456-7890", "email": "budi@contoh.id" },
  "drive_folder_url": "https://drive.google.com/drive/folders/...",
  "documents_total": 4,
  "documents_ready": 4,
  "documents": [
    {
      "id": "d0399525-5912-4ebe-bc51-0a4ac1cc6514",
      "name": "AKTA PENDIRIAN PT MAJU MUNDUR",
      "type": "Akta Pendirian",
      "category": "Legalitas",
      "status": "VALID",
      "number": "20",
      "date": "2026-09-14T05:49:17.246Z",
      "url": "https://drive.google.com/file/d/1RPUJ3.../view",
      "drive_file_id": "1RPUJ3..."
    }
  ]
}
```

Padanan dengan tampilan dashboard:

| Dashboard | Field |
|---|---|
| Judul kartu biru | `company_name`, `service_type` |
| Status SELESAI | `status` |
| Jenis layanan / Nomor akta / Nomor NIB / Tanggal pendirian | `service_type` / `akta_number` / `nib_number` / `established_date` |
| Tab Legalitas / Perpajakan / Perizinan / Sertifikat | `documents[].category` |
| Baris dokumen: nama, status, no dokumen, tanggal | `documents[].name`, `.status`, `.number`, `.date` |
| Ikon mata 👁 | buka `documents[].url` |

- `code` adalah kode unik pekerjaan (juga tercantum di nama folder Drive). Simpan di akun dashboard supaya pencocokan berikutnya pasti.
- `documents[].id` stabil. Pakai untuk **upsert** (update kalau sudah ada, tambah kalau belum).
- `documents` hanya berisi dokumen yang **sudah** punya link Drive; `documents_total` adalah jumlah semua dokumen hasil.
- Data mentah (KTP, NPWP pribadi, foto, catatan internal) **tidak pernah** dikirim.

## 3. Cara A: Webhook (disarankan)

Isi URL penerima di tab Integrasi, misalnya `https://akseslegal.id/api/giant-webhook`, lalu klik **Kirim tes**.

GIANT-APPS mengirim `POST` JSON:

```json
{ "event": "company.documents_ready", "sent_at": "2026-09-14T08:05:00.000Z", "data": { ...bentuk data di atas... } }
```

- `event: "ping"` dikirim oleh tombol **Kirim tes** (`data: null`). Cukup balas 200.
- Kiriman terjadi saat pekerjaan FINISH **dan** semua dokumen hasilnya sudah di Drive, lalu **setiap kali ada perubahan** (dokumen ditambah, diganti, atau dicabut). Kalau semua dokumen dicabut, `documents` berisi `[]`, jadi dashboard perlu menghapus dokumen yang tidak ada lagi.
- Balas **HTTP 2xx** kalau berhasil. Kalau tidak, GIANT-APPS mencoba lagi tiap 5 menit.
- Header `X-Giant-Signature: sha256=<hex>` = HMAC-SHA256 dari **body mentah** dengan kunci API key. Tolak kalau tidak cocok.

### Contoh penerima: Node.js / Express

```js
import crypto from 'crypto';
import express from 'express';
const app = express();

app.post('/api/giant-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.GIANT_API_KEY).update(req.body).digest('hex');
  const given = req.get('X-Giant-Signature') || '';
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return res.status(401).end();
  }
  const { event, data } = JSON.parse(req.body.toString('utf8'));
  if (event === 'ping') return res.json({ ok: true });

  // 1) cari akun klien: berdasarkan code (kalau sudah pernah), lalu email / no. WA
  // 2) upsert perusahaan (company_name, service_type, akta_number, nib_number, established_date, status)
  // 3) upsert tiap dokumen by data.documents[i].id; hapus dokumen perusahaan ini yang id-nya tidak ada lagi
  await saveCompanyFromGiant(data); // ← fungsi milik dashboard Anda
  res.json({ ok: true });
});
```

### Contoh penerima: PHP

```php
<?php
$raw = file_get_contents('php://input');
$expected = 'sha256=' . hash_hmac('sha256', $raw, getenv('GIANT_API_KEY'));
if (!hash_equals($expected, $_SERVER['HTTP_X_GIANT_SIGNATURE'] ?? '')) { http_response_code(401); exit; }
$payload = json_decode($raw, true);
if ($payload['event'] === 'ping') { echo '{"ok":true}'; exit; }
saveCompanyFromGiant($payload['data']); // upsert perusahaan + dokumen (lihat contoh Node di atas)
echo '{"ok":true}';
```

## 4. Cara B: API (pull)

Alamat dasar tercantum di tab Integrasi, misalnya `https://ali-dev.web.id/api/public/dashboard`.

| Permintaan | Hasil |
|---|---|
| `GET /companies` | Semua pekerjaan **SELESAI**, terbaru dulu: `{ count, companies: [...] }` |
| `GET /companies?status=all` | Termasuk yang masih berjalan |
| `GET /companies?phone=081234567890` | Cocokkan no. WA (format `0812…`/`62812…`/pakai strip tetap cocok) |
| `GET /companies?email=budi@contoh.id` | Cocokkan email klien |
| `GET /companies?q=maju mundur` | Cari nama perusahaan / klien / kode |
| `GET /companies?since=2026-09-01T00:00:00Z` | Hanya yang disinkron sejak waktu itu (untuk tarik berkala) |
| `GET /companies/AL-9CC77D` | Satu perusahaan by kode |

```bash
curl -H "X-API-Key: gak_..." "https://ali-dev.web.id/api/public/dashboard/companies?email=budi@contoh.id"
```

Tanpa key atau key salah → `401`.

## 5. Saran alur di dashboard

1. Saat membuat akun dashboard untuk klien, simpan **email dan no. WA** yang sama dengan yang diisi CS di kartu ("Data Klien & Perusahaan").
2. Webhook masuk → cari akun by `code`; kalau belum ada, by `client.email` lalu `client.phone`; simpan `code` ke akun itu.
3. Tampilkan `documents` di "Berkas Dokumen"; ikon mata → `url`.
4. Opsional: tombol admin "Tarik ulang dari GIANT" → `GET /companies/{code}`.
