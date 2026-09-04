import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

export function errMsg(e) {
  // route Hono mengembalikan { error }, layer lain { detail }
  const d = e?.response?.data?.detail ?? e?.response?.data?.error;
  if (!d) return e?.message || "Terjadi kesalahan. Coba lagi.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => (x && typeof x.msg === "string" ? x.msg : JSON.stringify(x))).join(" ");
  if (d && typeof d.msg === "string") return d.msg;
  return String(d);
}

export const PRIORITIES = [
  { value: "none", label: "Tanpa Prioritas", color: "#8590A2" },
  { value: "low", label: "Rendah", color: "#22A06B" },
  { value: "medium", label: "Sedang", color: "#F5CD47" },
  { value: "high", label: "Tinggi", color: "#E56910" },
  { value: "urgent", label: "Urgent", color: "#CA3521" },
];

export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  supervisor: "Supervisor",
  staff: "Staff",
  viewer: "Viewer",
};

export const LABEL_COLORS = [
  "#22A06B", "#F5CD47", "#E56910", "#CA3521", "#9F8FEF",
  "#0C66E4", "#1D7AFC", "#579DFF", "#6CC3E0", "#94C748",
  "#4BCE97", "#8590A2", "#F87168", "#E774BB", "#2684FF",
];

export function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** Waktu relatif singkat dalam Bahasa Indonesia: "baru saja", "5 mnt", "3 jam", "2 hr". */
export function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s)) return "";
  if (s < 45) return "baru saja";
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  if (s < 604800) return `${Math.round(s / 86400)} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: s > 31536000 ? "numeric" : undefined });
}
