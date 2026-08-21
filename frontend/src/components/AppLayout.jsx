import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid, Home, Briefcase, ListChecks, Settings, LogOut, Search, ChevronDown, Trello,
  Database, CalendarClock, BarChart3,
} from "lucide-react";
import { api } from "../lib/api";
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

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2 hover:bg-white/10 rounded px-2 py-1 transition-colors" data-testid="app-logo-link">
            <Trello size={20} />
            <span className="font-heading font-bold text-lg tracking-tight">ALI Workspace</span>
          </Link>
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
    </div>
  );
}
