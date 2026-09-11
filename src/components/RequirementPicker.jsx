import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { api } from "../lib/api";

const norm = (s) => (s || "").trim().toLowerCase();

/**
 * Pemilih syarat pindah list.
 *
 * Dua cara mengisi, boleh dicampur:
 *  1. Centang dari item Template Checklist yang sudah terdaftar (klik cepat).
 *  2. Ketik syarat sendiri di kolom "Tambah syarat" — untuk hal yang belum ada
 *     templatenya / sewaktu-waktu berubah.
 *
 * Apa pun caranya, yang disimpan hanyalah teks item. Saat kartu mau pindah,
 * pencocokan = teks item checklist di kartu SAMA PERSIS (bukan tebak substring),
 * dan item syarat otomatis ditambahkan ke checklist "Syarat <list>" di kartu.
 *
 * value    : array string (teks item yang jadi syarat)
 * onChange : (nextArray) => void
 */
export default function RequirementPicker({ value = [], onChange }) {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const { data: templates } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => api.get("/checklist-templates").then((r) => r.data),
  });

  // Gabungkan semua item template → daftar unik (per teks), sambil ingat template
  // asalnya. Syarat yang tidak ada di template mana pun (diketik manual / warisan
  // lama) tetap ditampilkan, ditandai "kustom".
  const rows = useMemo(() => {
    const map = new Map(); // norm(text) -> { text, templates:Set, custom:bool }
    for (const tpl of templates || []) {
      for (const raw of tpl.items || []) {
        const key = norm(raw);
        if (!key) continue;
        if (!map.has(key)) map.set(key, { text: raw.trim(), templates: new Set(), custom: false });
        map.get(key).templates.add(tpl.name);
      }
    }
    for (const raw of value || []) {
      const key = norm(raw);
      if (key && !map.has(key)) map.set(key, { text: raw.trim(), templates: new Set(), custom: true });
    }
    return [...map.values()].map((r) => ({ ...r, templates: [...r.templates] }));
  }, [templates, value]);

  const selected = useMemo(() => new Set((value || []).map(norm)), [value]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    const arr = needle
      ? rows.filter(
          (r) => norm(r.text).includes(needle) || r.templates.some((t) => norm(t).includes(needle)),
        )
      : rows;
    // Yang terpilih naik ke atas, sisanya urut abjad.
    return arr.slice().sort((a, b) => {
      const sa = selected.has(norm(a.text));
      const sb = selected.has(norm(b.text));
      if (sa !== sb) return sa ? -1 : 1;
      return a.text.localeCompare(b.text);
    });
  }, [rows, q, selected]);

  const toggle = (text) => {
    const key = norm(text);
    const next = selected.has(key)
      ? (value || []).filter((v) => norm(v) !== key)
      : [...(value || []), text];
    onChange(next);
  };

  const addCustom = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    if (selected.has(norm(t))) return; // sudah jadi syarat
    // Kalau persis sama dengan item template, simpan teks kanonik template-nya.
    const match = rows.find((r) => norm(r.text) === norm(t));
    onChange([...(value || []), match ? match.text : t]);
  };

  return (
    <div>
      {rows.length > 6 && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[hsl(var(--hairline))] px-2.5">
          <Search size={13} className="shrink-0 text-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari item…"
            className="h-8 w-full bg-transparent text-sm outline-none"
          />
        </div>
      )}

      <div className="max-h-52 space-y-0.5 overflow-y-auto minimal-scrollbar rounded-lg border border-[hsl(var(--hairline))] p-1.5">
        {filtered.map((r) => {
          const checked = selected.has(norm(r.text));
          if (r.custom) {
            return (
              <CustomReqRow
                key={`custom-${norm(r.text)}`}
                r={r}
                checked={checked}
                toggle={toggle}
                remove={(text) => toggle(text)}
                rename={(oldText, newText) => {
                  const next = (value || []).map((v) => (norm(v) === norm(oldText) ? newText : v));
                  onChange(next);
                }}
              />
            );
          }
          return (
            <label
              key={`tpl-${norm(r.text)}`}
              className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] ${
                checked ? "bg-[#E9F2FF] dark:bg-[#0c66e4]/15" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(r.text)}
                className="mt-0.5 accent-[#0C66E4]"
              />
              <span className="min-w-0 flex-1">
                <span className="text-foreground">{r.text}</span>
                <span className="ml-1.5 text-[11px] text-3">
                  {r.templates.join(", ")}
                </span>
              </span>
            </label>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-3">
            {q ? "Tidak ada item yang cocok." : "Belum ada syarat. Centang dari template atau ketik sendiri di bawah."}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Tambah syarat sendiri, mis: Bukti bayar PNBP"
          className="h-8 flex-1 rounded-lg border border-[hsl(var(--hairline))] px-2.5 text-sm bg-[hsl(var(--elevated))] outline-none focus:ring-2 focus:ring-[#0C66E4]"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!draft.trim()}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#0c66e4] px-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0052cc] disabled:opacity-40"
        >
          <Plus size={14} /> Tambah
        </button>
      </div>

      <p className="mt-1.5 text-[11px] text-3">
        Kartu hanya bisa pindah kalau item checklist dengan teks sama persis sudah tercentang di kartu.
      </p>
    </div>
  );
}


function CustomReqRow({ r, checked, toggle, remove, rename }) {
  const [val, setVal] = useState(r.text);

  return (
    <div
      className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] ${
        checked ? "bg-[#E9F2FF] dark:bg-[#0c66e4]/15" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggle(r.text)}
        className="mt-1.5 accent-[#0C66E4] cursor-pointer shrink-0"
      />
      <div className="min-w-0 flex-1 flex items-center">
        <input 
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { 
            const t = val.trim();
            if (t && t !== r.text) rename(r.text, t); 
            else setVal(r.text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.target.blur();
            }
          }}
          className="text-foreground bg-transparent border-b border-transparent hover:border-[hsl(var(--hairline))] focus:border-[#0c66e4] focus:outline-none px-1 w-full text-sm transition-colors"
        />
        <span className="ml-1.5 text-[11px] text-3 shrink-0">kustom</span>
      </div>
      {checked && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); remove(r.text); }}
          className="mt-1 shrink-0 rounded p-0.5 text-3 hover:bg-[hsl(var(--elevated))] hover:text-[#CA3521]"
          aria-label={`Hapus syarat kustom ${r.text}`}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
