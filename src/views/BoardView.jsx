import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  pointerWithin, rectIntersection, closestCorners,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Zap, Archive, Users, Plus, X, Filter } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { KanbanColumn, CardTile } from "../components/Kanban";
import CardModal from "../components/CardModal";
import AutomationModal from "../components/AutomationModal";
import { Avatar } from "../components/common";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const FILTERS = [
  { value: "all", label: "Semua" },
  { value: "unassigned", label: "Belum Ada PIC" },
  { value: "mine", label: "Pekerjaan Saya" },
  { value: "urgent", label: "Urgent" },
  { value: "overdue", label: "Overdue" },
];

const BG_COLORS = ["#0079bf", "#519839", "#D29034", "#B04632", "#89609E", "#CD5A91", "#4BBF6B", "#00AECC"];

function collisionDetection(args) {
  const pointer = pointerWithin(args);
  return pointer.length ? pointer : rectIntersection(args);
}

export default function BoardView() {
  const { boardId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [lists, setLists] = useState([]);
  const [cardsByList, setCardsByList] = useState({});
  const [activeDrag, setActiveDrag] = useState(null);
  const [filter, setFilter] = useState("all");
  const [filterLabels, setFilterLabels] = useState([]);
  const [filterMember, setFilterMember] = useState("");
  const [showAutomation, setShowAutomation] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [reqList, setReqList] = useState(null);
  const [reqText, setReqText] = useState("");

  const { data } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => api.get(`/boards/${boardId}/full`).then((r) => r.data),
  });
  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const { data: allBoards } = useQuery({ queryKey: ["boards"], queryFn: () => api.get("/boards").then((r) => r.data) });
  const { data: archivedCards } = useQuery({
    queryKey: ["board-archived", boardId],
    queryFn: () => api.get(`/boards/${boardId}/archived`).then((r) => r.data),
    enabled: showArchive,
  });

  useEffect(() => {
    if (!data) return;
    const sortedLists = [...data.lists].sort((a, b) => a.position - b.position);
    setLists(sortedLists);
    const map = {};
    sortedLists.forEach((l) => (map[l.id] = []));
    data.cards.forEach((c) => {
      if (map[c.list_id]) map[c.list_id].push(c);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.position - b.position));
    setCardsByList(map);
  }, [data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const openCardId = searchParams.get("card");
  const openCard = (card) => setSearchParams({ card: card.id });
  const closeCard = () => setSearchParams({});

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0079bf]">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const { board, labels, users, division } = data;
  const labelsById = Object.fromEntries((labels || []).map((l) => [l.id, l]));
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);
  const isAdmin = ["super_admin", "admin"].includes(user?.role);
  const today = new Date().toISOString().slice(0, 10);

  const passesFilter = (c) => {
    if (filter === "unassigned" && !((c.member_ids || []).length === 0 && c.status !== "done")) return false;
    if (filter === "mine" && !(c.member_ids || []).includes(user?.id)) return false;
    if (filter === "urgent" && c.priority !== "urgent") return false;
    if (filter === "overdue" && !(c.due_date && c.due_date < today && c.status !== "done")) return false;
    if (filterLabels.length && !filterLabels.some((l) => (c.label_ids || []).includes(l))) return false;
    if (filterMember && !(c.member_ids || []).includes(filterMember)) return false;
    return true;
  };

  const findListOfCard = (id, state = cardsByList) =>
    Object.keys(state).find((k) => state[k].some((c) => c.id === id));

  const onDragStart = (e) => {
    const d = e.active.data.current;
    if (d?.type === "card") setActiveDrag({ type: "card", card: d.card });
    else if (d?.type === "list") setActiveDrag({ type: "list" });
  };

  const onDragOver = (e) => {
    const { active, over } = e;
    if (!over || active.data.current?.type !== "card") return;
    const activeList = findListOfCard(active.id);
    const overList = over.data.current?.type === "list" ? over.id : findListOfCard(over.id);
    if (!activeList || !overList || activeList === overList) return;
    setCardsByList((prev) => {
      const a = [...(prev[activeList] || [])];
      const idx = a.findIndex((c) => c.id === active.id);
      if (idx < 0) return prev;
      const [card] = a.splice(idx, 1);
      card.list_id = overList;
      const b = [...(prev[overList] || [])];
      const overIdx = over.data.current?.type === "card" ? b.findIndex((c) => c.id === over.id) : b.length;
      b.splice(overIdx < 0 ? b.length : overIdx, 0, card);
      return { ...prev, [activeList]: a, [overList]: b };
    });
  };

  const onDragEnd = (e) => {
    const { active, over } = e;
    setActiveDrag(null);
    if (active.data.current?.type === "list") {
      if (over && active.id !== over.id) {
        setLists((prev) => {
          const oldIdx = prev.findIndex((l) => l.id === active.id);
          const newIdx = prev.findIndex((l) => l.id === over.id);
          if (oldIdx < 0 || newIdx < 0) return prev;
          const next = arrayMove(prev, oldIdx, newIdx);
          api.post(`/boards/${boardId}/lists/reorder`, { ordered_ids: next.map((l) => l.id) })
            .then(() => qc.invalidateQueries({ queryKey: ["board", boardId] }))
            .catch((err) => toast.error(errMsg(err)));
          return next;
        });
      }
      return;
    }
    const listId = findListOfCard(active.id);
    if (!listId) return;
    let arr = [...cardsByList[listId]];
    const oldIdx = arr.findIndex((c) => c.id === active.id);
    if (over && over.data.current?.type === "card" && over.id !== active.id) {
      const newIdx = arr.findIndex((c) => c.id === over.id);
      if (newIdx >= 0 && newIdx !== oldIdx) {
        arr = arrayMove(arr, oldIdx, newIdx);
        setCardsByList((p) => ({ ...p, [listId]: arr }));
      }
    }
    const idx = arr.findIndex((c) => c.id === active.id);
    const prevCard = arr[idx - 1];
    const nextCard = arr[idx + 1];
    let position;
    if (!prevCard && !nextCard) position = 1000;
    else if (!prevCard) position = (nextCard.position ?? 1000) - 1000;
    else if (!nextCard) position = (prevCard.position ?? 0) + 1000;
    else position = (prevCard.position + nextCard.position) / 2;
    setCardsByList((p) => ({
      ...p,
      [listId]: p[listId].map((c) => (c.id === active.id ? { ...c, position } : c)),
    }));
    api.post(`/work-items/${active.id}/move`, { list_id: listId, position, board_id: boardId })
      .then((r) => {
        if (r.data?.warning) toast.warning(r.data.warning);
        qc.invalidateQueries({ queryKey: ["board", boardId] });
      })
      .catch((err) => {
        toast.error(errMsg(err));
        qc.invalidateQueries({ queryKey: ["board", boardId] });
      });
  };

  const openRequirements = (list) => {
    setReqList(list);
    setReqText((list.entry_requirements || []).join("\n"));
  };

  const saveRequirements = async () => {
    if (!reqList) return;
    const items = reqText.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      await api.patch(`/lists/${reqList.id}`, { entry_requirements: items });
      toast.success("Syarat masuk list diperbarui");
      setReqList(null);
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const archiveAllCards = async (listId) => {
    if (!window.confirm("Arsipkan semua kartu di list ini?")) return;
    try {
      const r = await api.post(`/lists/${listId}/archive-all-cards`);
      toast.success(`${r.data.archived} kartu diarsipkan`);
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const copyList = async (listId) => {
    try {
      await api.post(`/lists/${listId}/copy`);
      toast.success("List disalin beserta kartunya");
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const moveListToBoard = async (listId, targetBoardId) => {
    if (!window.confirm("Pindahkan list beserta seluruh kartunya ke board lain?")) return;
    try {
      await api.post(`/lists/${listId}/move`, { board_id: targetBoardId });
      toast.success("List dipindahkan");
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const archiveList = async (listId) => {
    if (!window.confirm("Arsipkan list ini? Kartu di dalamnya tetap tersimpan.")) return;
    try {
      await api.patch(`/lists/${listId}`, { archived: true });
      toast.success("List diarsipkan");
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const copyBoardLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}`);
    toast.success("Link board disalin");
  };

  const addCard = async (listId, title, clientName) => {
    try {
      await api.post("/work-items", { board_id: boardId, list_id: listId, title, client_name: clientName });
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success("Kartu ditambahkan");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const addList = async () => {
    if (!newListName.trim()) return;
    try {
      await api.post(`/boards/${boardId}/lists`, { name: newListName.trim() });
      setNewListName("");
      setAddingList(false);
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const renameList = async (listId, name) => {
    try {
      await api.patch(`/lists/${listId}`, { name });
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const deleteList = async (listId) => {
    if (!window.confirm("Hapus list ini? Kartu di dalamnya akan diarsipkan.")) return;
    try {
      await api.delete(`/lists/${listId}`);
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const toggleBoardMember = async (uid) => {
    const cur = board.member_ids || [];
    const next = cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid];
    try {
      await api.patch(`/boards/${boardId}`, { member_ids: next });
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: board.background || "#0079bf" }} data-testid="board-view">
      <div className="h-14 w-full flex items-center px-4 bg-black/10 backdrop-blur-sm shrink-0 text-white justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-heading text-lg font-bold truncate" data-testid="board-title">{board.name}</h1>
          {division && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 shrink-0" data-testid="board-division-badge">
              {division.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <button data-testid="board-filter-button" className="flex items-center gap-1.5 h-8 px-3 rounded bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors active:scale-95">
                <Filter size={14} /> {FILTERS.find((f) => f.value === filter)?.label}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-white shadow-lg p-2" align="end">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  data-testid={`filter-${f.value}`}
                  onClick={() => setFilter(f.value)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm ${filter === f.value ? "bg-[#E9F2FF] text-[#0C66E4] font-semibold" : "text-[#172B4D] hover:bg-[#F1F2F4]"}`}
                >
                  {f.label}
                </button>
              ))}
              <div className="border-t border-[#DFE1E6] mt-2 pt-2 px-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2] px-2 mb-1">Label</p>
                <div className="max-h-32 overflow-y-auto minimal-scrollbar space-y-0.5">
                  {(labels || []).map((l) => (
                    <label key={l.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F1F2F4] cursor-pointer" data-testid={`filter-label-${l.id}`}>
                      <input
                        type="checkbox"
                        checked={filterLabels.includes(l.id)}
                        onChange={() => setFilterLabels((f) => (f.includes(l.id) ? f.filter((x) => x !== l.id) : [...f, l.id]))}
                        className="w-3.5 h-3.5 accent-[#0C66E4]"
                      />
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="text-xs text-[#172B4D]">{l.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8590A2] px-2 mt-2 mb-1">Anggota</p>
                <select
                  data-testid="filter-member-select"
                  value={filterMember}
                  onChange={(e) => setFilterMember(e.target.value)}
                  className="w-full h-8 rounded border border-[#DFE1E6] px-2 text-xs text-[#172B4D] bg-white outline-none"
                >
                  <option value="">Semua anggota</option>
                  {(users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                {(filterLabels.length > 0 || filterMember) && (
                  <button
                    data-testid="filter-clear-button"
                    onClick={() => { setFilterLabels([]); setFilterMember(""); setFilter("all"); }}
                    className="mt-2 w-full text-xs text-[#CA3521] hover:underline"
                  >
                    Hapus semua filter
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button data-testid="board-share-button" className="flex items-center gap-1.5 h-8 px-3 rounded bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors active:scale-95">
                <Users size={14} /> Bagikan
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-white shadow-lg" align="end">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Anggota Board</p>
              {!isAdmin && <p className="text-xs text-[#8590A2] mb-2">Hanya admin yang dapat mengubah anggota.</p>}
              <div className="max-h-56 overflow-y-auto minimal-scrollbar">
                {(users || []).map((u) => (
                  <button
                    key={u.id}
                    data-testid={`board-member-${u.id}`}
                    disabled={!isAdmin}
                    onClick={() => toggleBoardMember(u.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] text-left disabled:cursor-default"
                  >
                    <Avatar name={u.name} color={u.avatar_color} size="h-6 w-6 text-[10px]" />
                    <span className="text-sm text-[#172B4D] flex-1">{u.name}</span>
                    {(board.member_ids || []).includes(u.id) && <span className="text-[#22A06B] text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <button
            data-testid="board-copy-link-button"
            onClick={copyBoardLink}
            className="flex items-center gap-1.5 h-8 px-3 rounded bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors active:scale-95"
          >
            Salin Link
          </button>
          {isSupervisorUp && (
            <button
              data-testid="board-automation-button"
              onClick={() => setShowAutomation(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors active:scale-95"
            >
              <Zap size={14} /> Otomasi
            </button>
          )}
          <button
            data-testid="board-archive-button"
            onClick={() => setShowArchive(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors active:scale-95"
          >
            <Archive size={14} /> Arsip ({data.archived_count || 0})
          </button>
          <div className="flex -space-x-1.5 ml-1">
            {(board.member_ids || []).slice(0, 5).map((id) => {
              const u = usersById[id];
              return u ? <Avatar key={id} name={u.name} color={u.avatar_color} size="h-7 w-7 text-[10px]" /> : null;
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 minimal-scrollbar" data-testid="board-canvas">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex items-start gap-3 h-full">
            <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map((list) => (
                <KanbanColumn
                  key={list.id}
                  list={list}
                  cards={(cardsByList[list.id] || []).filter(passesFilter)}
                  labelsById={labelsById}
                  usersById={usersById}
                  currentBoardId={boardId}
                  onCardClick={openCard}
                  onAddCard={addCard}
                  onRenameList={renameList}
                  onDeleteList={deleteList}
                  onSetRequirements={openRequirements}
                  onArchiveAllCards={archiveAllCards}
                  onCopyList={copyList}
                  onMoveList={moveListToBoard}
                  onArchiveList={archiveList}
                  allBoards={allBoards}
                  canManage={isSupervisorUp}
                />
              ))}
            </SortableContext>
            <div className="w-72 shrink-0">
              {addingList ? (
                <div className="bg-[#f1f2f4] rounded-xl p-2 space-y-2" data-testid="add-list-form">
                  <input
                    data-testid="add-list-name-input"
                    autoFocus
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addList(); if (e.key === "Escape") setAddingList(false); }}
                    placeholder="Nama list..."
                    className="w-full h-9 rounded-lg border border-[#0C66E4] px-2 text-sm outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button data-testid="add-list-submit" onClick={addList} className="h-8 px-3 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold active:scale-95">
                      Tambah list
                    </button>
                    <button aria-label="Batal" data-testid="add-list-cancel" onClick={() => setAddingList(false)} className="p-1.5 rounded hover:bg-black/10 text-[#44546F]">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  data-testid="add-list-open"
                  onClick={() => setAddingList(true)}
                  className="w-full flex items-center gap-2 h-11 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors active:scale-95"
                >
                  <Plus size={16} /> Tambah list
                </button>
              )}
            </div>
          </div>
          <DragOverlay>
            {activeDrag?.type === "card" ? (
              <div className="w-72 rotate-2 scale-105 shadow-xl">
                <CardTile card={activeDrag.card} labelsById={labelsById} usersById={usersById} onClick={() => {}} isMirror={activeDrag.card.board_id !== boardId} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {openCardId && <CardModal itemId={openCardId} onClose={closeCard} />}
      {reqList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-24 fade-enter" onClick={() => setReqList(null)} data-testid="requirements-modal">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 modal-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-heading text-lg font-bold text-[#172B4D]">Syarat Masuk List</h2>
              <button aria-label="Tutup" data-testid="requirements-close" onClick={() => setReqList(null)} className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-[#44546F] mb-3">
              Kartu hanya bisa dipindah ke <span className="font-semibold">{reqList.name}</span> jika item checklist berikut sudah dicentang. Satu item per baris.
            </p>
            <textarea
              data-testid="requirements-input"
              value={reqText}
              onChange={(e) => setReqText(e.target.value)}
              rows={5}
              placeholder={"KTP\nNPWP"}
              className="w-full rounded-lg border border-[#DFE1E6] p-3 text-sm outline-none focus:ring-2 focus:ring-[#0C66E4] resize-y"
            />
            <button
              data-testid="requirements-save-button"
              onClick={saveRequirements}
              className="mt-3 w-full h-9 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95"
            >
              Simpan Syarat
            </button>
          </div>
        </div>
      )}
      {showAutomation && (
        <AutomationModal boardId={boardId} lists={lists} labels={labels} divisions={divisions} onClose={() => setShowAutomation(false)} />
      )}
      {showArchive && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-20 fade-enter" onClick={() => setShowArchive(false)} data-testid="archive-modal">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 modal-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-bold text-[#172B4D]">Kartu Diarsipkan</h2>
              <button aria-label="Tutup" data-testid="archive-close" onClick={() => setShowArchive(false)} className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto minimal-scrollbar">
              {(archivedCards || []).length === 0 && <p className="text-sm text-[#44546F]">Tidak ada kartu di arsip.</p>}
              {(archivedCards || []).map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-[#F4F5F7] rounded-lg px-3 py-2" data-testid={`archived-card-${c.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#172B4D] truncate">{c.title}</p>
                    {c.client_name && <p className="text-xs text-[#44546F]">{c.client_name}</p>}
                  </div>
                  <button
                    data-testid={`restore-card-${c.id}`}
                    onClick={async () => {
                      await api.post(`/work-items/${c.id}/unarchive`);
                      qc.invalidateQueries({ queryKey: ["board", boardId] });
                      qc.invalidateQueries({ queryKey: ["board-archived", boardId] });
                      toast.success("Kartu dikembalikan");
                    }}
                    className="text-xs text-[#0C66E4] hover:underline font-semibold shrink-0 ml-3"
                  >
                    Kembalikan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
