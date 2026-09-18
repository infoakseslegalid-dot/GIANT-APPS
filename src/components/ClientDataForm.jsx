import { useState } from "react";

/**
 * Form "Data Klien & Perusahaan" — dipakai di kartu (CardClientPanel) dan di
 * panel detail Arsip. Isinya masuk ke Catatan Klien (Google Drive, internal)
 * dan sebagian dikirim ke dashboard klien (nama perusahaan, layanan, no. akta,
 * NIB, tanggal pendirian, kontak).
 */
export const CLIENT_FIELDS = [
  { key: "company_name", label: "Nama perusahaan", placeholder: "PT Maju Mundur", span: 2 },
  { key: "service_type", label: "Jenis layanan", placeholder: "PT Umum", list: "service-types" },
  { key: "client", label: "Nama klien (PIC)", placeholder: "Budi Santoso" },
  { key: "client_phone", label: "No. telepon / WA", placeholder: "0812…", type: "tel" },
  { key: "client_email", label: "Email klien", placeholder: "nama@email.com", type: "email" },
  { key: "akta_number", label: "No. akta", placeholder: "20" },
  { key: "nib_number", label: "NIB", placeholder: "1109260080634" },
  { key: "established_date", label: "Tanggal pendirian", type: "date" },
  { key: "client_address", label: "Alamat", placeholder: "Alamat klien / perusahaan", span: 2 },
  { key: "client_notes", label: "Catatan", placeholder: "Info lain tentang klien…", span: 2, textarea: true },
];

const SERVICE_TYPES = ["PT Umum", "PT Perorangan", "CV", "Yayasan", "Perkumpulan", "Koperasi", "Perubahan PT", "Perubahan CV"];

export function emptyClientData(src = {}) {
  return Object.fromEntries(CLIENT_FIELDS.map((f) => [f.key, src?.[f.key] ?? ""]));
}

export default function ClientDataForm({ value, canEdit, onSave, onCancel, compact = false }) {
  const [form, setForm] = useState(() => emptyClientData(value));
  const [busy, setBusy] = useState(false);
  // Data dari server berubah (mis. setelah simpan / diubah orang lain) → isi ulang form.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) { setPrevValue(value); setForm(emptyClientData(value)); }

  const dirty = CLIENT_FIELDS.some((f) => (form[f.key] || "") !== (value?.[f.key] || ""));
  const inp = `w-full rounded-md border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-2 text-foreground ${compact ? "h-8 text-[13px]" : "h-9 text-sm"} disabled:opacity-70`;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(Object.fromEntries(CLIENT_FIELDS.map((f) => [f.key, form[f.key]?.trim() || null])));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2" data-testid="client-data-form">
      <datalist id="service-types">{SERVICE_TYPES.map((s) => <option key={s} value={s} />)}</datalist>
      {CLIENT_FIELDS.map((f) => (
        <label key={f.key} className={`flex flex-col gap-0.5 ${f.span === 2 ? "sm:col-span-2" : ""}`}>
          <span className="text-[11px] font-semibold text-3">{f.label}</span>
          {f.textarea ? (
            <textarea
              value={form[f.key]} disabled={!canEdit} rows={3} placeholder={f.placeholder}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className={`${inp} h-auto py-1.5`}
            />
          ) : (
            <input
              type={f.type || "text"} list={f.list} value={form[f.key]} disabled={!canEdit} placeholder={f.placeholder}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className={inp}
            />
          )}
        </label>
      ))}
      {canEdit && (
        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
          <button
            disabled={!dirty || busy}
            className="h-8 rounded-md bg-[#0C66E4] px-3 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Menyimpan…" : "Simpan data klien"}
          </button>
          {onCancel && <button type="button" onClick={onCancel} className="h-8 px-2 text-[13px] text-2">Tutup</button>}
          <span className="text-[11px] text-3">Tersimpan juga ke Catatan Klien di Google Drive.</span>
        </div>
      )}
    </form>
  );
}
