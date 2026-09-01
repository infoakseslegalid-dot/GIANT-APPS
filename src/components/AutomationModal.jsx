import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Trash2, Plus, X } from "lucide-react";
import { api, errMsg, PRIORITIES } from "../lib/api";

const TRIGGERS = [
  { value: "card_created", label: "Saat kartu dibuat" },
  { value: "card_moved", label: "Saat kartu dipindah ke list" },
  { value: "card_mirrored", label: "Saat kartu di-mirror ke board ini" },
  { value: "mirror_removed", label: "Saat mirror dihapus dari board ini" },
];

const ACTIONS = [
  { value: "add_label", label: "Tambahkan label" },
  { value: "remove_label", label: "Hapus label" },
  { value: "set_priority", label: "Ubah prioritas menjadi" },
  { value: "assign_division", label: "Tambahkan divisi" },
];

export default function AutomationModal({ boardId, lists, labels, divisions, onClose }) {
  const qc = useQueryClient();
  const [trigger, setTrigger] = useState("card_moved");
  const [triggerListId, setTriggerListId] = useState("");
  const [action, setAction] = useState("add_label");
  const [actionValue, setActionValue] = useState("");

  const { data: rules } = useQuery({
    queryKey: ["automation", boardId],
    queryFn: () => api.get(`/boards/${boardId}/automation`).then((r) => r.data),
  });

  const needsValue = ["add_label", "remove_label", "set_priority", "assign_division"].includes(action);

  const valueOptions = () => {
    if (action === "add_label" || action === "remove_label")
      return (labels || []).map((l) => ({ value: l.id, label: l.name, color: l.color }));
    if (action === "set_priority") return PRIORITIES.filter((p) => p.value !== "none");
    if (action === "assign_division") return (divisions || []).map((d) => ({ value: d.id, label: d.name, color: d.color }));
    return [];
  };

  const createRule = async () => {
    if (needsValue && !actionValue) {
      toast.error("Pilih nilai aksi terlebih dahulu");
      return;
    }
    if (trigger === "card_moved" && !triggerListId) {
      toast.error("Pilih list pemicu terlebih dahulu");
      return;
    }
    try {
      await api.post(`/boards/${boardId}/automation`, {
        trigger,
        trigger_list_id: trigger === "card_moved" ? triggerListId : null,
        action,
        action_value: actionValue || null,
      });
      qc.invalidateQueries({ queryKey: ["automation", boardId] });
      toast.success("Aturan otomasi dibuat");
      setActionValue("");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const removeRule = async (id) => {
    await api.delete(`/automation/${id}`);
    qc.invalidateQueries({ queryKey: ["automation", boardId] });
  };

  const describe = (r) => {
    const t = TRIGGERS.find((x) => x.value === r.trigger)?.label || r.trigger;
    const a = ACTIONS.find((x) => x.value === r.action)?.label || r.action;
    let listName = "";
    if (r.trigger === "card_moved") {
      listName = ` "${(lists || []).find((l) => l.id === r.trigger_list_id)?.name || "?"}"`;
    }
    let val = "";
    if (["add_label", "remove_label"].includes(r.action)) val = (labels || []).find((l) => l.id === r.action_value)?.name || "";
    if (r.action === "set_priority") val = PRIORITIES.find((p) => p.value === r.action_value)?.label || "";
    if (r.action === "assign_division") val = (divisions || []).find((d) => d.id === r.action_value)?.name || "";
    return `${t}${listName} → ${a}${val ? ` "${val}"` : ""}`;
  };

  const selectCls = "h-9 rounded-lg border border-[#DFE1E6] px-2 text-sm text-[#172B4D] bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-20 overflow-y-auto fade-enter" onClick={onClose} data-testid="automation-modal">
      <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl relative mb-16 p-6 modal-enter" onClick={(e) => e.stopPropagation()}>
        <button aria-label="Tutup" data-testid="automation-close-button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={20} className="text-[#F5CD47]" />
          <h2 className="font-heading text-lg font-bold text-[#172B4D]">Otomasi Board</h2>
        </div>
        <p className="text-sm text-[#44546F] mb-5">Aturan berjalan otomatis saat kartu dibuat, dipindah, atau di-mirror.</p>

        <div className="bg-[#F4F5F7] rounded-xl p-4 space-y-3 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2]">Buat aturan baru</p>
          <div className="flex flex-wrap items-center gap-2">
            <select data-testid="automation-trigger-select" value={trigger} onChange={(e) => setTrigger(e.target.value)} className={selectCls}>
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {trigger === "card_moved" && (
              <select data-testid="automation-list-select" value={triggerListId} onChange={(e) => setTriggerListId(e.target.value)} className={selectCls}>
                <option value="">Pilih list...</option>
                {(lists || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select data-testid="automation-action-select" value={action} onChange={(e) => { setAction(e.target.value); setActionValue(""); }} className={selectCls}>
              {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <select data-testid="automation-value-select" value={actionValue} onChange={(e) => setActionValue(e.target.value)} className={selectCls}>
              <option value="">Pilih nilai...</option>
              {valueOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              data-testid="automation-create-button"
              onClick={createRule}
              className="h-9 px-3 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold flex items-center gap-1 transition-colors active:scale-95"
            >
              <Plus size={14} /> Tambah
            </button>
          </div>
        </div>

        <div className="space-y-2" data-testid="automation-rules-list">
          {(rules || []).length === 0 && <p className="text-sm text-[#44546F]">Belum ada aturan.</p>}
          {(rules || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-[#F4F5F7] rounded-lg px-3 py-2" data-testid={`automation-rule-${r.id}`}>
              <p className="text-sm text-[#172B4D]">{describe(r)}</p>
              <button aria-label="Hapus aturan" data-testid={`automation-delete-${r.id}`} onClick={() => removeRule(r.id)} className="p-1 rounded hover:bg-[#FFECE8] text-[#CA3521]">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
