import { useEffect, useState } from "react";
import { fmtDate, PRIORITIES } from "../lib/api";

export function Avatar({ name, color, src, size = "h-7 w-7 text-xs" }) {
  // Foto profil bisa hilang (dihapus / storage gagal) — jangan sampai avatar
  // jadi kotak kosong, jatuhkan kembali ke inisial.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name || ""}
        title={name}
        onError={() => setBroken(true)}
        className={`${size} rounded-full shrink-0 border-2 border-white object-cover bg-[hsl(var(--muted))]`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center text-white font-semibold shrink-0 border-2 border-white`}
      style={{ backgroundColor: color || "#0C66E4" }}
      title={name}
    >
      {initials}
    </div>
  );
}

/** Pilih warna teks (gelap/terang) yang kontras di atas warna latar hex. */
export function textOnColor(hex) {
  if (!hex || typeof hex !== "string") return "#fff";
  const h = hex.replace("#", "");
  if (h.length < 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#172B4D" : "#fff";
}

export function LabelChip({ label, collapsed = false }) {
  if (collapsed) {
    return (
      <span
        className="h-2 w-9 rounded-full inline-block"
        style={{ backgroundColor: label.color }}
        title={label.name}
        data-testid="label-chip"
      />
    );
  }
  return (
    <span
      className="inline-flex h-4 max-w-full items-center truncate rounded-[3px] px-1.5 text-[10px] font-bold uppercase leading-none tracking-wide"
      style={{ backgroundColor: label.color, color: textOnColor(label.color) }}
      title={label.name}
      data-testid="label-chip"
    >
      {label.name}
    </span>
  );
}

export function DueBadge({ dueDate, status }) {
  if (!dueDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setDate(soon.getDate() + 2);
  const soonLimit = soon.toISOString().slice(0, 10);
  const isDone = status === "done";
  const isOverdue = !isDone && dueDate < today;
  const isToday = !isDone && dueDate === today;
  const isSoon = !isDone && !isOverdue && !isToday && dueDate <= soonLimit;
  let cls = "bg-[hsl(var(--muted))] text-2";
  let text = fmtDate(dueDate);
  if (isDone) {
    cls = "bg-[#22A06B] text-white";
    text = "Selesai";
  } else if (isOverdue) {
    cls = "bg-[#CA3521] text-white";
    text = `${fmtDate(dueDate)} · Terlambat`;
  } else if (isToday) {
    cls = "bg-[#E56910] text-white";
    text = "Hari ini";
  } else if (isSoon) {
    cls = "bg-[#F5CD47] text-[#172B4D]";
    text = `${fmtDate(dueDate)} · Segera`;
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${cls}`} data-testid="card-due-badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      {text}
    </span>
  );
}

export function PriorityFlag({ priority }) {
  if (!priority || priority === "none") return null;
  const p = PRIORITIES.find((x) => x.value === priority);
  if (!p) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-white"
      style={{ backgroundColor: p.color }}
      data-testid="card-priority-badge"
    >
      {p.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  if (status === "submitted")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#9F8FEF] text-white" data-testid="card-status-badge">Menunggu Approval</span>;
  if (status === "done")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#22A06B] text-white" data-testid="card-status-badge">Selesai</span>;
  return null;
}
