import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, fmtDate, PRIORITIES } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, Avatar } from "../components/common";
import CardModal from "../components/kanban/CardModalWrapper";

export default function AllWork() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [status, setStatus] = useState("");
  const [openItem, setOpenItem] = useState(null);

  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["all-work", q, divisionId, status],
    queryFn: () =>
      api.get("/work-items", { params: { q: q || undefined, division_id: divisionId || undefined, status: status || undefined } }).then((r) => r.data),
    retry: false,
  });

  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);

  if (!isSupervisorUp) {
    return (
      <div className="p-10 text-center" data-testid="all-work-forbidden">
        <p className="text-2">Halaman ini hanya untuk supervisor dan admin.</p>
      </div>
    );
  }

  const selectCls = "h-9 rounded-lg border border-[hsl(var(--hairline))] px-2 text-sm text-foreground bg-[hsl(var(--elevated))] outline-none focus:ring-2 focus:ring-[#0C66E4]";

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="all-work-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Semua Pekerjaan</h1>
        <p className="text-sm text-2 mt-1">Bank data seluruh pekerjaan lintas divisi.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 bg-[hsl(var(--elevated))] border border-[hsl(var(--hairline))] rounded-lg px-3 h-9 flex-1 min-w-[220px]">
          <Search size={14} className="text-3" />
          <input
            data-testid="allwork-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari judul atau klien..."
            className="outline-none text-sm w-full bg-transparent"
          />
        </div>
        <select data-testid="allwork-division-filter" value={divisionId} onChange={(e) => setDivisionId(e.target.value)} className={selectCls}>
          <option value="">Semua Divisi</option>
          {(divisions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select data-testid="allwork-status-filter" value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="submitted">Menunggu Approval</option>
          <option value="done">Selesai</option>
        </select>
      </div>

      <div className="bg-[hsl(var(--elevated))] rounded-xl border border-[hsl(var(--hairline))] shadow-sm overflow-x-auto">
        <table className="w-full text-sm" data-testid="allwork-table">
          <thead>
            <tr className="border-b border-[hsl(var(--hairline))] text-left">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-3">Pekerjaan</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-3">Klien</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-3">Board / List</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-3">PIC</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-3">Tenggat</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-3">Prioritas</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item) => (
              <tr
                key={item.id}
                data-testid={`allwork-row-${item.id}`}
                onClick={() => setOpenItem(item.id)}
                className="border-b border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-foreground max-w-[280px]">
                  <span className="line-clamp-2">{item.title}</span>
                </td>
                <td className="px-4 py-2.5 text-2">{item.client_name || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className="text-white text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: item.board_background || "#0079bf" }}>
                    {item.board_name}
                  </span>
                  <span className="text-2 text-xs ml-1.5">{item.list_name}</span>
                </td>
                <td className="px-4 py-2.5">
                  {item.current_pic_name ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={item.current_pic_name} color={usersById[item.current_pic_id]?.avatar_color} src={usersById[item.current_pic_id]?.avatar_url} size="h-6 w-6 text-[10px]" />
                      <span className="text-2 whitespace-nowrap">{item.current_pic_name}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#E56910] font-semibold">Belum ada</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-2">{item.due_date ? fmtDate(item.due_date) : "—"}</td>
                <td className="px-4 py-2.5">
                  {(() => {
                    const p = PRIORITIES.find((x) => x.value === item.priority);
                    return p && p.value !== "none" ? (
                      <span className="text-white text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: p.color }}>{p.label}</span>
                    ) : <span className="text-3">—</span>;
                  })()}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <p className="p-6 text-sm text-2">Memuat...</p>}
        {isError && <p className="p-6 text-sm text-[#CA3521]">Gagal memuat data.</p>}
        {!isLoading && (items || []).length === 0 && (
          <p className="p-6 text-sm text-3 text-center">Tidak ada pekerjaan yang cocok.</p>
        )}
      </div>

      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
