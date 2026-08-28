import { fmtDate, PRIORITIES } from "../lib/api";

export function Avatar({ name, color, size = "h-7 w-7 text-xs" }) {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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

export function LabelChip({ label }) {
  return (
    <span
      className="h-2 w-10 rounded-full inline-block"
      style={{ backgroundColor: label.color }}
      title={label.name}
    />
  );
}

export function DueBadge({ dueDate, status }) {
  if (!dueDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const isDone = status === "done" || status === "SELESAI";
  const isOverdue = !isDone && dueDate < today;
  const isToday = !isDone && dueDate === today;
  let cls = "bg-[#091E420F] text-[#44546F]";
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
  const s = (status || "").toUpperCase();
  if (s === "MENUNGGU" || status === "submitted")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#9F8FEF] text-white" data-testid="card-status-badge">Menunggu Approval</span>;
  if (s === "SELESAI" || status === "done")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#22A06B] text-white" data-testid="card-status-badge">Selesai</span>;
  if (s === "PROSES")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#0C66E4] text-white" data-testid="card-status-badge">Proses</span>;
  if (s === "REVISI")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#E56910] text-white" data-testid="card-status-badge">Revisi</span>;
  if (s === "BARU")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#8590A2] text-white" data-testid="card-status-badge">Baru</span>;
  return null;
}

export function DistributionStatusBadge({ status }) {
  const s = (status || "").toUpperCase();
  if (s === "MENUNGGU_DIAMBIL" || status === "menunggu")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#FFF8E6] text-[#946F00] border border-[#F5CD47]">Menunggu Diambil</span>;
  if (s === "DIAMBIL" || status === "diambil")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#E3FCEF] text-[#216E4E] border border-[#22A06B]">Diambil</span>;
  if (s === "DILEPASKAN" || status === "dilepaskan")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#FFECE8] text-[#CA3521] border border-[#CA3521]">Dilepaskan</span>;
  if (s === "DIRECT_ASSIGNED" || status === "direct_assigned")
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#E9F2FF] text-[#0C66E4] border border-[#0C66E4]">Ditugaskan Langsung</span>;
  return null;
}
