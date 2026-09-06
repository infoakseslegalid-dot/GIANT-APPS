import { useState, useEffect, useRef } from "react";import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid, LogOut, Search, ChevronDown, Kanban, ChevronsUpDown, X, UserCog, Sun, Moon, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useTheme } from "../lib/theme";
import { api, errMsg } from "../lib/api";
import { setLocale } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./common";
import NotificationsMenu from "./NotificationsMenu";
import Sidebar from "./Sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator,
} from "./ui/dropdown-menu";

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(r.data);
        setOpen(true);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <div className="flex items-center gap-2 bg-[hsl(var(--elevated))]/20 rounded px-3 h-8 text-white focus-within:bg-[hsl(var(--elevated))]/30 transition-colors">
        <Search size={14} className="shrink-0 opacity-80" />
        <input
          data-testid="global-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Cari pekerjaan, klien, board..."
          className="bg-transparent outline-none text-sm w-full placeholder-white/70"
        />
      </div>
      {open && results && (
        <div className="absolute top-10 left-0 right-0 bg-[hsl(var(--elevated))] rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto minimal-scrollbar fade-enter" data-testid="global-search-results">
          {results.boards?.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-3 px-2 py-1">Board</p>
              {results.boards.map((b) => (
                <button
                  key={b.id}
                  data-testid={`search-board-${b.id}`}
                  onClick={() => { setOpen(false); setQ(""); navigate(`/board/${b.id}`); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[hsl(var(--muted))] text-left"
                >
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: b.background }} />
                  <span className="text-sm text-foreground">{b.name}</span>
                </button>
              ))}
            </div>
          )}
          {results.items?.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] font-bold uppercase tracking-wider text-3 px-2 py-1">Pekerjaan</p>
              {results.items.map((i) => {
                // Kartu asli tidak perlu badge khusus — hanya kartu mirror (assignment)
                // yang perlu ditandai beda, karena cuma kartu asli yang bisa di-mirror.
                const badge =
                  i.role === "assignment"
                    ? { t: "Assignment", c: "bg-[#EAE6FF] text-[#5E4DB2]" }
                    : null;
                const meta = i.board_name ? `${i.board_name}${i.list_name ? ` • ${i.list_name}` : ""}` : "";
                const sub = [
                  i.role === "assignment" && i.target_division_name && `Divisi: ${i.target_division_name}`,
                  i.role === "assignment" && (i.pic_name ? `PIC: ${i.pic_name}` : i.distribution_label),
                  i.role !== "assignment" && i.pic_name && `PIC: ${i.pic_name}`,
                ].filter(Boolean).join("  ·  ");
                return (
                  <button
                    key={i.id}
                    data-testid={`search-item-${i.id}`}
                    onClick={() => { setOpen(false); setQ(""); navigate(`/board/${i.board_id}?card=${i.id}`); }}
                    className="w-full px-2 py-1.5 rounded hover:bg-[hsl(var(--muted))] text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm text-foreground ${i.is_done ? "line-through opacity-60" : ""}`}>{i.title}</p>
                      {badge && <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold ${badge.c}`}>{badge.t}</span>}
                    </div>
                    {i.client_name && <p className="text-xs text-2">{i.client_name}</p>}
                    {meta && <p className="flex items-center gap-1 text-[11px] text-3"><LayoutGrid size={10} className="shrink-0" /> {meta}</p>}
                    {sub && <p className="text-[11px] text-3">{sub}</p>}
                  </button>
                );
              })}
            </div>
          )}
          {!results.boards?.length && !results.items?.length && (
            <p className="p-4 text-sm text-2 text-center">Tidak ada hasil untuk "{q}"</p>
          )}
        </div>
      )}
    </div>
  );
}

const AVATAR_COLORS = ["#0C66E4", "#1D7AFC", "#579DFF", "#6CC3E0", "#E56910", "#F5CD47", "#22A06B", "#4BCE97", "#9F8FEF", "#E774BB", "#CA3521", "#8590A2"];

function BoardSwitcher() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const { data: boards } = useQuery({ queryKey: ["boards"], queryFn: () => api.get("/boards").then((r) => r.data) });

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = (boards || []).filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="board-switcher-button"
        onClick={() => { setOpen((v) => !v); setQ(""); }}
        className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[hsl(var(--elevated))]/15 hover:bg-[hsl(var(--elevated))]/25 text-sm font-medium transition-colors"
      >
        <LayoutGrid size={15} /> Board <ChevronsUpDown size={13} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 z-50 w-[320px] max-h-[70vh] overflow-hidden rounded-lg bg-[hsl(var(--elevated))] text-foreground shadow-2xl border border-[hsl(var(--hairline))] flex flex-col" data-testid="board-switcher-panel">
          <div className="p-2 border-b border-[hsl(var(--hairline))]">
            <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--hairline))] px-2">
              <Search size={14} className="text-3" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari board…"
                className="h-8 flex-1 text-sm outline-none bg-transparent" />
            </div>
          </div>
          <div className="overflow-y-auto minimal-scrollbar py-1">
            {filtered.map((b) => (
              <button key={b.id} data-testid={`board-switch-${b.id}`}
                onClick={() => { setOpen(false); navigate(`/board/${b.id}`); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[hsl(var(--muted))]">
                <span className="h-5 w-6 rounded shrink-0" style={{ backgroundColor: b.background }} />
                <span className="truncate">{b.name}</span>
                {b.division_name && <span className="ml-auto text-[10px] text-3 shrink-0">{b.division_name}</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-4 text-center text-xs text-3">Tidak ada board.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function EditProfileModal({ user, onClose }) {
  const { setUser } = useAuth();
  const { t } = useTranslation();
  const { setTheme } = useTheme();
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);
  const [theme, setThemeLocal] = useState(user?.theme || "system");
  const [locale, setLocaleLocal] = useState(user?.locale || "id");
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);

  const patchPref = async (payload) => {
    try {
      const r = await api.patch("/auth/me", payload);
      setUser(r.data);
    } catch (e) { toast.error(errMsg(e)); }
  };
  const pickTheme = (v) => { setThemeLocal(v); setTheme(v); patchPref({ theme: v }); };
  const pickLocale = (v) => { setLocaleLocal(v); setLocale(v); patchPref({ locale: v }); };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const r = await api.patch("/auth/me", { name: name.trim(), avatar_color: color });
      setUser(r.data);
      toast.success(t("profile.updated"));
      onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  const changePw = async () => {
    if (pw.new_password.length < 6) { toast.error(t("profile.passwordTooShort")); return; }
    try {
      await api.post("/auth/change-password", pw);
      toast.success(t("profile.passwordChanged"));
      setPw({ old_password: "", new_password: "" });
    } catch (e) { toast.error(errMsg(e)); }
  };

  const inp = "h-9 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#0C66E4]";
  const themeOpts = [
    { v: "light", label: t("profile.themeLight"), Icon: Sun },
    { v: "dark", label: t("profile.themeDark"), Icon: Moon },
    { v: "system", label: t("profile.themeSystem"), Icon: Monitor },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-20 overflow-y-auto" onClick={onClose} data-testid="edit-profile-modal">
      <div className="w-full max-w-md rounded-xl bg-[hsl(var(--elevated))] p-6 shadow-2xl mb-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-bold text-foreground">{t("profile.title")}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-2"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={name} color={color} size="h-12 w-12 text-base" />
          <div className="text-xs text-3">{user?.email}</div>
        </div>
        <label className="text-xs font-semibold text-2">{t("profile.name")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`mb-3 ${inp}`} />
        <label className="text-xs font-semibold text-2">{t("profile.avatarColor")}</label>
        <div className="mt-1 mb-4 flex flex-wrap gap-1.5">
          {AVATAR_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-[#0C66E4] ring-offset-1 ring-offset-[hsl(var(--elevated))]" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <button onClick={saveProfile} disabled={saving} className="w-full h-9 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold disabled:opacity-50">
          {t("profile.save")}
        </button>

        {/* Tampilan / Appearance */}
        <div className="mt-5 pt-4 border-t border-[hsl(var(--hairline))]">
          <p className="text-xs font-bold uppercase tracking-wider text-3 mb-2">{t("profile.appearance")}</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOpts.map(({ v, label, Icon }) => (
              <button
                key={v}
                data-testid={`theme-opt-${v}`}
                onClick={() => pickTheme(v)}
                className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-[12px] font-semibold transition-colors ${
                  theme === v
                    ? "border-[#0C66E4] bg-[#E9F2FF] text-[#0C66E4] dark:bg-[#0c66e4]/15"
                    : "border-[hsl(var(--hairline))] text-2 hover:bg-[hsl(var(--muted))]"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bahasa / Language */}
        <div className="mt-4 pt-4 border-t border-[hsl(var(--hairline))]">
          <p className="text-xs font-bold uppercase tracking-wider text-3 mb-2">{t("profile.language")}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "id", label: "🇮🇩  Indonesia" },
              { v: "en", label: "🇬🇧  English" },
            ].map(({ v, label }) => (
              <button
                key={v}
                data-testid={`locale-opt-${v}`}
                onClick={() => pickLocale(v)}
                className={`rounded-lg border py-2.5 text-[13px] font-semibold transition-colors ${
                  locale === v
                    ? "border-[#0C66E4] bg-[#E9F2FF] text-[#0C66E4] dark:bg-[#0c66e4]/15"
                    : "border-[hsl(var(--hairline))] text-2 hover:bg-[hsl(var(--muted))]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[hsl(var(--hairline))]">
          <p className="text-xs font-bold uppercase tracking-wider text-3 mb-2">{t("profile.changePassword")}</p>
          <input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} placeholder={t("profile.oldPassword")}
            className={`mb-2 ${inp}`} />
          <input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} placeholder={t("profile.newPassword")}
            className={`mb-2 ${inp}`} />
          <button onClick={changePw} className="h-8 px-3 rounded-lg border border-[hsl(var(--hairline))] text-sm font-semibold text-foreground hover:bg-[hsl(var(--muted))]">
            {t("profile.changePasswordBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [editProfile, setEditProfile] = useState(false);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        document.querySelector('[data-testid="global-search-input"]')?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const isBoard = location.pathname.startsWith("/board/");

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="app-layout">
      <header className="h-12 w-full flex items-center justify-between gap-4 px-4 bg-[#026aa7] dark:bg-[hsl(var(--surface))] shadow-sm shrink-0 z-40 text-white border-b border-black/10 dark:border-[hsl(var(--hairline))]">
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/" className="flex items-center gap-2 hover:bg-[hsl(var(--elevated))]/10 rounded px-2 py-1 transition-colors" data-testid="app-logo-link">
            <Kanban size={20} />
            <span className="font-heading font-bold text-lg tracking-tight hidden sm:inline">ALI Workspace</span>
          </Link>
          <BoardSwitcher />
        </div>
        <GlobalSearch />
        <div className="flex items-center gap-2 shrink-0">
          <NotificationsMenu />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="user-menu-button" className="flex items-center gap-1.5 hover:bg-[hsl(var(--elevated))]/20 rounded-full pl-1 pr-2 py-1 transition-colors active:scale-95">
                <Avatar name={user?.name} color={user?.avatar_color} size="h-7 w-7 text-[11px]" />
                <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-[hsl(var(--elevated))] text-foreground shadow-lg">
              <div className="px-3 py-3 border-b border-[hsl(var(--hairline))]">
                <p className="text-sm font-semibold text-foreground" data-testid="user-menu-name">{user?.name}</p>
                <p className="text-xs text-3">{user?.email}</p>
              </div>
              <DropdownMenuItem
                data-testid="edit-profile-menu-item"
                onClick={() => setEditProfile(true)}
                className="cursor-pointer"
              >
                <UserCog size={14} className="mr-2" /> {t("userMenu.editProfile")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="logout-menu-item"
                onClick={async () => { await logout(); navigate("/login"); }}
                className="text-[#CA3521] cursor-pointer"
              >
                <LogOut size={14} className="mr-2" /> {t("userMenu.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!isBoard && <Sidebar />}
        <main className={isBoard ? "flex-1 overflow-hidden flex flex-col" : "flex-1 overflow-y-auto minimal-scrollbar bg-[hsl(var(--surface-2))] text-foreground"}>
          <Outlet />
        </main>
      </div>
      {editProfile && <EditProfileModal user={user} onClose={() => setEditProfile(false)} />}
    </div>
  );
}
