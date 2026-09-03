import { useState, useEffect, useRef } from "react";import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid, Home, Briefcase, ListChecks, Settings, LogOut, Search, ChevronDown, Kanban,
  Database, CalendarClock, BarChart3, CalendarDays, ChevronsUpDown, X, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./common";
import NotificationsMenu from "./NotificationsMenu";
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
      <div className="flex items-center gap-2 bg-white/20 rounded px-3 h-8 text-white focus-within:bg-white/30 transition-colors">
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
        <div className="absolute top-10 left-0 right-0 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto minimal-scrollbar fade-enter" data-testid="global-search-results">
          {results.boards?.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2] px-2 py-1">Board</p>
              {results.boards.map((b) => (
                <button
                  key={b.id}
                  data-testid={`search-board-${b.id}`}
                  onClick={() => { setOpen(false); setQ(""); navigate(`/board/${b.id}`); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] text-left"
                >
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: b.background }} />
                  <span className="text-sm text-[#172B4D]">{b.name}</span>
                </button>
              ))}
            </div>
          )}
          {results.items?.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2] px-2 py-1">Pekerjaan</p>
              {results.items.map((i) => (
                <button
                  key={i.id}
                  data-testid={`search-item-${i.id}`}
                  onClick={() => { setOpen(false); setQ(""); navigate(`/board/${i.board_id}?card=${i.id}`); }}
                  className="w-full px-2 py-1.5 rounded hover:bg-[#F1F2F4] text-left"
                >
                  <p className="text-sm text-[#172B4D]">{i.title}</p>
                  {i.client_name && <p className="text-xs text-[#44546F]">{i.client_name}</p>}
                </button>
              ))}
            </div>
          )}
          {!results.boards?.length && !results.items?.length && (
            <p className="p-4 text-sm text-[#44546F] text-center">Tidak ada hasil untuk "{q}"</p>
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
        className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors"
      >
        <LayoutGrid size={15} /> Board <ChevronsUpDown size={13} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 z-50 w-[320px] max-h-[70vh] overflow-hidden rounded-lg bg-white text-[#172B4D] shadow-2xl border border-[#DFE1E6] flex flex-col" data-testid="board-switcher-panel">
          <div className="p-2 border-b border-[#DFE1E6]">
            <div className="flex items-center gap-2 rounded-md border border-[#DFE1E6] px-2">
              <Search size={14} className="text-[#8590A2]" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari board…"
                className="h-8 flex-1 text-sm outline-none bg-transparent" />
            </div>
          </div>
          <div className="overflow-y-auto minimal-scrollbar py-1">
            {filtered.map((b) => (
              <button key={b.id} data-testid={`board-switch-${b.id}`}
                onClick={() => { setOpen(false); navigate(`/board/${b.id}`); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[#F1F2F4]">
                <span className="h-5 w-6 rounded shrink-0" style={{ backgroundColor: b.background }} />
                <span className="truncate">{b.name}</span>
                {b.division_name && <span className="ml-auto text-[10px] text-[#8590A2] shrink-0">{b.division_name}</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-4 text-center text-xs text-[#8590A2]">Tidak ada board.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function EditProfileModal({ user, onClose }) {
  const { setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const r = await api.patch("/auth/me", { name: name.trim(), avatar_color: color });
      setUser(r.data);
      toast.success("Profil diperbarui");
      onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  const changePw = async () => {
    if (pw.new_password.length < 6) { toast.error("Kata sandi baru minimal 6 karakter"); return; }
    try {
      await api.post("/auth/change-password", pw);
      toast.success("Kata sandi diganti");
      setPw({ old_password: "", new_password: "" });
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-20" onClick={onClose} data-testid="edit-profile-modal">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-bold text-[#172B4D]">Edit Profil</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={name} color={color} size="h-12 w-12 text-base" />
          <div className="text-xs text-[#8590A2]">{user?.email}</div>
        </div>
        <label className="text-xs font-semibold text-[#44546F]">Nama</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mb-3 h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm outline-none focus:ring-2 focus:ring-[#0C66E4]" />
        <label className="text-xs font-semibold text-[#44546F]">Warna avatar</label>
        <div className="mt-1 mb-4 flex flex-wrap gap-1.5">
          {AVATAR_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-[#0C66E4] ring-offset-1" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <button onClick={saveProfile} disabled={saving} className="w-full h-9 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold disabled:opacity-50">
          Simpan Profil
        </button>

        <div className="mt-5 pt-4 border-t border-[#DFE1E6]">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Ganti Kata Sandi</p>
          <input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} placeholder="Kata sandi lama"
            className="mb-2 h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm outline-none focus:ring-2 focus:ring-[#0C66E4]" />
          <input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} placeholder="Kata sandi baru (min. 6)"
            className="mb-2 h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm outline-none focus:ring-2 focus:ring-[#0C66E4]" />
          <button onClick={changePw} className="h-8 px-3 rounded-lg border border-[#DFE1E6] text-sm font-semibold text-[#172B4D] hover:bg-[#F1F2F4]">
            Ganti Kata Sandi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
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
  const isAdminRole = ["super_admin", "admin"].includes(user?.role);
  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);

  const { data: boards } = useQuery({
    queryKey: ["boards"],
    queryFn: () => api.get("/boards").then((r) => r.data),
  });
  const { data: divisions } = useQuery({
    queryKey: ["divisions"],
    queryFn: () => api.get("/divisions").then((r) => r.data),
  });
  const myDiv = (divisions || []).find((d) => d.id === user?.division_id);
  const canHari = isAdminRole || ["draf", "pajak", "perizinan", "desain"].includes(myDiv?.key);
  const canSkor = isSupervisorUp || myDiv?.key === "cs";

  const navItem = (to, icon, label, testid) => (
    <Link
      to={to}
      data-testid={testid}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        location.pathname === to
          ? "bg-[#E9F2FF] text-[#0C66E4]"
          : "text-[#44546F] hover:bg-[#F1F2F4]"
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="app-layout">
      <header className="h-12 w-full flex items-center justify-between gap-4 px-4 bg-[#026aa7] shadow-sm shrink-0 z-40 text-white border-b border-black/10">
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/" className="flex items-center gap-2 hover:bg-white/10 rounded px-2 py-1 transition-colors" data-testid="app-logo-link">
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
              <button data-testid="user-menu-button" className="flex items-center gap-1.5 hover:bg-white/20 rounded-full pl-1 pr-2 py-1 transition-colors active:scale-95">
                <Avatar name={user?.name} color={user?.avatar_color} size="h-7 w-7 text-[11px]" />
                <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white shadow-lg">
              <div className="px-3 py-3 border-b">
                <p className="text-sm font-semibold text-[#172B4D]" data-testid="user-menu-name">{user?.name}</p>
                <p className="text-xs text-[#44546F]">{user?.email}</p>
              </div>
              <DropdownMenuItem
                data-testid="edit-profile-menu-item"
                onClick={() => setEditProfile(true)}
                className="cursor-pointer"
              >
                <UserCog size={14} className="mr-2" /> Edit Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="logout-menu-item"
                onClick={async () => { await logout(); navigate("/login"); }}
                className="text-[#CA3521] cursor-pointer"
              >
                <LogOut size={14} className="mr-2" /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!isBoard && (
          <aside className="w-60 bg-white border-r overflow-y-auto minimal-scrollbar shrink-0 py-4 px-3 space-y-1" data-testid="app-sidebar">
            {navItem("/", <Home size={16} />, "Dashboard", "nav-dashboard")}
            {navItem("/my-work", <Briefcase size={16} />, "Pekerjaan Saya", "nav-my-work")}
            {navItem("/calendar", <CalendarDays size={16} />, "Kalender", "nav-calendar")}
            {isSupervisorUp && navItem("/work", <ListChecks size={16} />, "Semua Pekerjaan", "nav-all-work")}
            <div className="pt-4 pb-1 px-3 flex items-center gap-2">
              <LayoutGrid size={12} className="text-[#8590A2]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2]">Board Saya</span>
            </div>
            {(boards || []).map((b) => (
              <Link
                key={b.id}
                to={`/board/${b.id}`}
                data-testid={`sidebar-board-${b.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#44546F] hover:bg-[#F1F2F4] transition-colors"
              >
                <span className="w-5 h-5 rounded shrink-0" style={{ backgroundColor: b.background }} />
                <span className="truncate">{b.name}</span>
              </Link>
            ))}
            <div className="pt-4 pb-1 px-3 flex items-center gap-2">
              <Database size={12} className="text-[#8590A2]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2]">Bank Data Divisi</span>
            </div>
            {(divisions || []).map((d) => (
              <Link
                key={d.id}
                to={`/bank-data/${d.id}`}
                data-testid={`sidebar-bankdata-${d.id}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  location.pathname === `/bank-data/${d.id}` ? "bg-[#E9F2FF] text-[#0C66E4] font-medium" : "text-[#44546F] hover:bg-[#F1F2F4]"
                }`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}</span>
              </Link>
            ))}
            {(canHari || canSkor) && (
              <div className="pt-4 pb-1 px-3 flex items-center gap-2">
                <BarChart3 size={12} className="text-[#8590A2]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2]">Pantauan Global</span>
              </div>
            )}
            {canHari && navItem("/global/hari", <CalendarClock size={16} />, "Board Harian (Hari 1-7)", "nav-global-hari")}
            {canSkor && navItem("/global/skor", <BarChart3 size={16} />, "Peta Skor Global", "nav-global-skor")}
            {isAdminRole && (
              <>
                <div className="pt-4 pb-1 px-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2]">Administrasi</span>
                </div>
                {navItem("/admin", <Settings size={16} />, "Admin Panel", "nav-admin-panel")}
              </>
            )}
          </aside>
        )}
        <main className={isBoard ? "flex-1 overflow-hidden flex flex-col" : "flex-1 overflow-y-auto minimal-scrollbar bg-[#F4F5F7]"}>
          <Outlet />
        </main>
      </div>
      {editProfile && <EditProfileModal user={user} onClose={() => setEditProfile(false)} />}
    </div>
  );
}
