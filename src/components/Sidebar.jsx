import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Home, Briefcase, CalendarDays, ListChecks, LayoutGrid, Database,
  BarChart3, CalendarClock, Settings, ChevronDown, Star, Search,
  PanelLeftClose, PanelLeftOpen, ShieldCheck, TrendingUp, Sparkles,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/* ── localStorage per-user, aman kalau storage tidak tersedia ── */
function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal];
}

const PRIMARY = "#0C66E4";

function RailItem({ to, icon, label, testid, collapsed, active }) {
  return (
    <Link
      to={to}
      data-testid={testid}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center rounded-lg text-sm transition-colors ${
        collapsed ? "h-9 w-9 justify-center mx-auto" : "gap-3 px-3 py-2"
      } ${
        active
          ? "bg-[#E9F2FF] text-[#0C66E4] font-semibold dark:bg-[#0c66e4]/15"
          : "text-2 hover:bg-[hsl(var(--muted))]"
      }`}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#0C66E4]" />
      )}
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function SectionHeader({ label, icon, open, onToggle, admin }) {
  return (
    <button
      onClick={onToggle}
      className={`group mt-2 flex w-full items-center gap-2 rounded-md px-3 py-1.5 transition-colors ${
        admin ? "bg-[#F3F0FF] hover:bg-[#E9E2FF] dark:bg-[#5E4DB2]/15" : "hover:bg-[hsl(var(--muted))]"
      }`}
    >
      {icon}
      <span
        className={`flex-1 text-left text-[10px] font-bold uppercase tracking-wider ${
          admin ? "text-[#5E4DB2]" : "text-3"
        }`}
      >
        {label}
      </span>
      <ChevronDown
        size={13}
        className={`shrink-0 text-3 transition-transform ${open ? "" : "-rotate-90"}`}
      />
    </button>
  );
}

function BoardRow({ b, collapsed, active, starred, onToggleStar }) {
  return (
    <Link
      to={`/board/${b.id}`}
      data-testid={`sidebar-board-${b.id}`}
      title={collapsed ? b.name : undefined}
      className={`group relative flex items-center rounded-lg text-sm transition-colors ${
        collapsed ? "h-9 w-9 justify-center mx-auto" : "gap-2.5 px-3 py-2"
      } ${
        active ? "bg-[#E9F2FF] text-[#0C66E4] font-semibold dark:bg-[#0c66e4]/15" : "text-2 hover:bg-[hsl(var(--muted))]"
      }`}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#0C66E4]" />
      )}
      <span
        className="h-4 w-4 shrink-0 rounded-[4px]"
        style={{ backgroundColor: b.background || "#8590A2" }}
      />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{b.name}</span>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleStar(b.id); }}
            className={`shrink-0 rounded p-0.5 transition-opacity hover:bg-[hsl(var(--accent))] ${
              starred ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            title={starred ? "Lepas dari favorit" : "Tambah ke favorit"}
          >
            <Star size={13} className={starred ? "fill-[#E2B203] text-[#E2B203]" : "text-3"} />
          </span>
        </>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const uid = user?.id || "anon";

  const [collapsed, setCollapsed] = usePersistentState("sidebar:collapsed", false);
  const [sections, setSections] = usePersistentState(`sidebar:sections:${uid}`, {
    favorites: true, boards: true, bankdata: true, global: true, admin: true,
  });
  const [starred, setStarred] = usePersistentState(`sidebar:starred:${uid}`, []);
  const [q, setQ] = useState("");

  const toggleSection = (k) => setSections((s) => ({ ...s, [k]: !s[k] }));
  const toggleStar = (id) =>
    setStarred((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const isAdminRole = ["super_admin", "admin"].includes(user?.role);
  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);

  const { data: boards } = useQuery({ queryKey: ["boards"], queryFn: () => api.get("/boards").then((r) => r.data) });
  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const { data: myPerms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => api.get("/my-permissions").then((r) => r.data),
    staleTime: 60000,
  });
  // Badge WAITING_CLAIM per divisi — realtime (RealtimeContext invalidasi key ini via SSE).
  const { data: summary } = useQuery({
    queryKey: ["bank-data-summary"],
    queryFn: () => api.get("/bank-data/summary").then((r) => r.data),
    refetchInterval: 60000,
  });
  const waitingBy = useMemo(() => {
    const m = {};
    for (const s of summary || []) m[s.division_id] = s.waiting || 0;
    return m;
  }, [summary]);

  const permSet = new Set(myPerms?.permissions || []);
  const canHari = user?.role === "super_admin" || permSet.has("hari.view");
  const canSkor = user?.role === "super_admin" || permSet.has("skor.view");
  const canReport = user?.role === "super_admin" || permSet.has("report.view");
  const canAi = user?.role === "super_admin" || permSet.has("ai.use");

  const allBoards = boards || [];
  const starredBoards = allBoards.filter((b) => starred.includes(b.id));
  const filteredBoards = q.trim()
    ? allBoards.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()))
    : allBoards;

  const path = location.pathname;

  return (
    <aside
      data-testid="app-sidebar"
      className={`${collapsed ? "w-[60px]" : "w-60"} shrink-0 border-r border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] flex flex-col transition-[width] duration-150`}
    >
      <div className="flex-1 overflow-y-auto minimal-scrollbar px-2.5 py-3 space-y-0.5">
        <RailItem to="/" icon={<Home size={16} />} label={t("nav.dashboard")} testid="nav-dashboard" collapsed={collapsed} active={path === "/"} />
        <RailItem to="/my-work" icon={<Briefcase size={16} />} label={t("nav.myWork")} testid="nav-my-work" collapsed={collapsed} active={path === "/my-work"} />
        <RailItem to="/calendar" icon={<CalendarDays size={16} />} label={t("nav.calendar")} testid="nav-calendar" collapsed={collapsed} active={path === "/calendar"} />
        {isSupervisorUp && (
          <RailItem to="/work" icon={<ListChecks size={16} />} label={t("nav.allWork")} testid="nav-all-work" collapsed={collapsed} active={path === "/work"} />
        )}
        {canAi && (
          <RailItem to="/ai" icon={<Sparkles size={16} />} label={t("nav.aiAssistant")} testid="nav-ai" collapsed={collapsed} active={path.startsWith("/ai")} />
        )}

        {/* ── FAVORIT ── */}
        {!collapsed && (
          <>
            <SectionHeader
              label={t("nav.favorites")} icon={<Star size={12} className="text-[#E2B203]" />}
              open={sections.favorites} onToggle={() => toggleSection("favorites")}
            />
            {sections.favorites && (
              starredBoards.length ? (
                starredBoards.map((b) => (
                  <BoardRow key={b.id} b={b} collapsed={false} active={path === `/board/${b.id}`}
                    starred onToggleStar={toggleStar} />
                ))
              ) : (
                <p className="px-3 py-1.5 text-[11px] leading-snug text-3">
                  {t("nav.favEmptyHint")}
                </p>
              )
            )}
          </>
        )}
        {collapsed && starredBoards.map((b) => (
          <BoardRow key={b.id} b={b} collapsed active={path === `/board/${b.id}`} starred onToggleStar={toggleStar} />
        ))}

        {/* ── BOARD SAYA ── */}
        {!collapsed && (
          <SectionHeader
            label={t("nav.myBoards")} icon={<LayoutGrid size={12} className="text-3" />}
            open={sections.boards} onToggle={() => toggleSection("boards")}
          />
        )}
        {!collapsed && sections.boards && allBoards.length > 6 && (
          <div className="my-1 flex items-center gap-1.5 rounded-md border border-[hsl(var(--hairline))] px-2">
            <Search size={13} className="shrink-0 text-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("nav.searchBoards")}
              data-testid="sidebar-board-filter"
              className="h-7 flex-1 bg-transparent text-[13px] text-foreground outline-none"
            />
          </div>
        )}
        {(collapsed || sections.boards) &&
          (collapsed ? allBoards : filteredBoards).map((b) => (
            <BoardRow
              key={b.id} b={b} collapsed={collapsed}
              active={path === `/board/${b.id}`}
              starred={starred.includes(b.id)} onToggleStar={toggleStar}
            />
          ))}
        {!collapsed && sections.boards && filteredBoards.length === 0 && (
          <p className="px-3 py-1.5 text-[11px] text-3">{t("nav.noBoardMatch")}</p>
        )}

        {/* ── BANK DATA DIVISI ── */}
        {!collapsed && (
          <SectionHeader
            label={t("nav.bankData")} icon={<Database size={12} className="text-3" />}
            open={sections.bankdata} onToggle={() => toggleSection("bankdata")}
          />
        )}
        {(collapsed || sections.bankdata) &&
          (divisions || []).map((d) => {
            const active = path === `/bank-data/${d.id}`;
            const n = waitingBy[d.id] || 0;
            return (
              <Link
                key={d.id}
                to={`/bank-data/${d.id}`}
                data-testid={`sidebar-bankdata-${d.id}`}
                title={collapsed ? `${d.name}${n ? ` — ${n} menunggu` : ""}` : undefined}
                className={`group relative flex items-center rounded-lg text-sm transition-colors ${
                  collapsed ? "h-9 w-9 justify-center mx-auto" : "gap-2.5 px-3 py-2"
                } ${active ? "bg-[#E9F2FF] text-[#0C66E4] font-semibold dark:bg-[#0c66e4]/15" : "text-2 hover:bg-[hsl(var(--muted))]"}`}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#0C66E4]" />
                )}
                <span className="relative shrink-0">
                  <span className="block h-4 w-4 rounded-[4px]" style={{ backgroundColor: d.color || "#8590A2" }} />
                  {collapsed && n > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#CA3521] px-0.5 text-[9px] font-bold text-white">
                      {n > 9 ? "9+" : n}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    {n > 0 && (
                      <span
                        data-testid={`sidebar-bankdata-badge-${d.id}`}
                        className="shrink-0 rounded-full bg-[#FFF0B3] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#7A5C00]"
                        title={`${n} pekerjaan menunggu diambil`}
                      >
                        {n}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}

        {/* ── PANTAUAN GLOBAL ── */}
        {(canHari || canSkor || canReport) && !collapsed && (
          <SectionHeader
            label={t("nav.globalMonitor")} icon={<BarChart3 size={12} className="text-3" />}
            open={sections.global} onToggle={() => toggleSection("global")}
          />
        )}
        {(collapsed || sections.global) && canReport && (
          <RailItem to="/reports" icon={<TrendingUp size={16} />} label={t("nav.reports")} testid="nav-reports" collapsed={collapsed} active={path.startsWith("/reports")} />
        )}
        {(collapsed || sections.global) && canHari && (
          <RailItem to="/global/hari" icon={<CalendarClock size={16} />} label={t("nav.dailyBoard")} testid="nav-global-hari" collapsed={collapsed} active={path === "/global/hari"} />
        )}
        {(collapsed || sections.global) && canSkor && (
          <RailItem to="/global/skor" icon={<BarChart3 size={16} />} label={t("nav.scoreMap")} testid="nav-global-skor" collapsed={collapsed} active={path === "/global/skor"} />
        )}

        {/* ── ADMINISTRASI (dipisah visual) ── */}
        {isAdminRole && (
          <>
            <div className="my-2 border-t-2 border-[hsl(var(--hairline))]" />
            {!collapsed && (
              <SectionHeader
                label={t("nav.administration")} admin icon={<ShieldCheck size={12} className="text-[#5E4DB2]" />}
                open={sections.admin} onToggle={() => toggleSection("admin")}
              />
            )}
            {(collapsed || sections.admin) && (
              <RailItem to="/admin" icon={<Settings size={16} />} label={t("nav.adminPanel")} testid="nav-admin-panel" collapsed={collapsed} active={path.startsWith("/admin")} />
            )}
          </>
        )}
      </div>

      {/* collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        data-testid="sidebar-collapse-toggle"
        title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        className="flex h-9 items-center gap-2 border-t border-[hsl(var(--hairline))] px-3 text-[12px] font-medium text-3 hover:bg-[hsl(var(--muted))]"
      >
        {collapsed ? <PanelLeftOpen size={15} className="mx-auto" /> : (<><PanelLeftClose size={15} /> {t("nav.collapse")}</>)}
      </button>
    </aside>
  );
}
