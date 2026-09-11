import { useState, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MessageSquare, Paperclip, CheckSquare, AlignLeft, Link2, MoreHorizontal, Pencil, Trash2, Plus, X,
  ShieldCheck, ChevronDown, ChevronRight, Copy, FolderInput, Archive, ArchiveX,
} from "lucide-react";
import { Avatar, LabelChip, DueBadge, PriorityFlag, StatusBadge } from "./common";
import { API } from "../lib/api";
import { useTheme } from "../lib/theme";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from "./ui/dropdown-menu";

export function CardTile({ card, labelsById, usersById, onClick, isMirror, readOnly = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
    disabled: readOnly,
  });
  const dragProps = readOnly ? {} : { ...attributes, ...listeners };
  const [labelsCollapsed, setLabelsCollapsed] = useState(false);
  const style = {
    transform: isDragging ? `${CSS.Transform.toString(transform)} rotate(3deg)` : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const cardLabels = (card.label_ids || []).map((id) => labelsById[id]).filter(Boolean);
  const members = (card.member_ids || []).map((id) => usersById[id]).filter(Boolean);
  const clTotal = (card.checklists || []).reduce((a, c) => a + c.items.length, 0);
  const clDone = (card.checklists || []).reduce((a, c) => a + c.items.filter((i) => i.done).length, 0);
  const noPic = members.length === 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dragProps}
      onClick={onClick}
      data-testid={`card-tile-${card.id}`}
      className="bg-[hsl(var(--elevated))] rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-px border border-transparent hover:border-[#0C66E4]/30 transition-all duration-150 cursor-pointer group flex flex-col relative overflow-hidden"
    >
      {card.cover_attachment_id ? (
        <img src={`${API}/attachments/${card.cover_attachment_id}/download`} alt="" className="w-full h-28 object-cover" />
      ) : card.cover_color ? (
        <div className="w-full h-8" style={{ backgroundColor: card.cover_color }} />
      ) : null}
      <div className="p-3 flex flex-col gap-2">
        <button
          aria-label="Edit Kartu"
          data-testid={`card-quick-edit-${card.id}`}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-[hsl(var(--elevated))]/80 hover:bg-gray-200 text-2 z-10"
        >
          <Pencil size={12} />
        </button>
        {card.is_assignment && card.master_board_name && (
          <span
            className="inline-flex w-fit items-center gap-1 rounded border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-3"
            title={`Mirror dari ${card.master_board_name}${card.master_list_name ? " / " + card.master_list_name : ""}`}
          >
            <Link2 size={11} className="text-[#2684FF]" />
            {card.master_board_name}{card.master_list_name ? ` / ${card.master_list_name}` : ""}
          </span>
        )}
        {cardLabels.length > 0 && (
          <div
            className="flex flex-wrap gap-1"
            onClick={(e) => { e.stopPropagation(); setLabelsCollapsed((v) => !v); }}
            title={labelsCollapsed ? "Klik untuk tampilkan nama label" : "Klik untuk ciutkan label"}
          >
            {cardLabels.map((l) => (
              <LabelChip key={l.id} label={l} collapsed={labelsCollapsed} />
            ))}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-foreground leading-snug pr-4">{card.title}</p>
          {card.client_name && <p className="text-xs text-2 mt-0.5">{card.client_name}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={card.status} />
          <PriorityFlag priority={card.priority} />
          <DueBadge dueDate={card.due_date} status={card.status} />
          {noPic && card.status !== "done" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#E3FCEF] text-[#216E4E] border border-[#22A06B]" data-testid={`card-open-badge-${card.id}`}>
              Belum ada PIC
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-2">
            {card.description ? <AlignLeft size={13} /> : null}
            {isMirror && <Link2 size={13} className="text-[#2684FF]" aria-label="Kartu mirror" />}
            {clTotal > 0 && (
              <span className={`flex items-center gap-1 text-[11px] font-semibold ${clDone === clTotal ? "text-[#22A06B]" : ""}`}>
                <CheckSquare size={13} /> {clDone}/{clTotal}
              </span>
            )}
            {(card.comment_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px]">
                <MessageSquare size={13} /> {card.comment_count}
              </span>
            )}
            {(card.attachment_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px]">
                <Paperclip size={13} /> {card.attachment_count}
              </span>
            )}
          </div>
          <div className="flex -space-x-1.5">
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} name={m.name} color={m.avatar_color} src={m.avatar_url} size="h-6 w-6 text-[10px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AddCardComposer({ onAdd, testidPrefix }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), client.trim());
    setTitle("");
    setClient("");
  };

  if (!open) {
    return (
      <button
        data-testid={`${testidPrefix}-add-card-open`}
        onClick={() => setOpen(true)}
        className="m-2 mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-2 hover:bg-[hsl(var(--accent))] transition-colors w-[calc(100%-16px)] text-left"
      >
        <Plus size={14} /> Tambahkan kartu
      </button>
    );
  }
  return (
    <div className="p-2 space-y-2" data-testid={`${testidPrefix}-add-card-form`}>
      <textarea
        data-testid={`${testidPrefix}-add-card-title`}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") setOpen(false); }}
        placeholder="Judul pekerjaan, mis: PT ABC - Pengurusan NIB"
        className="w-full rounded-lg border border-[hsl(var(--hairline))] p-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#0C66E4] resize-none bg-[hsl(var(--elevated))] shadow-sm"
        rows={2}
      />
      <input
        data-testid={`${testidPrefix}-add-card-client`}
        value={client}
        onChange={(e) => setClient(e.target.value)}
        placeholder="Nama klien (opsional)"
        className="w-full h-8 rounded-lg border border-[hsl(var(--hairline))] px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#0C66E4] bg-[hsl(var(--elevated))]"
      />
      <div className="flex items-center gap-2">
        <button
          data-testid={`${testidPrefix}-add-card-submit`}
          onClick={submit}
          className="h-8 px-3 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95"
        >
          Tambah kartu
        </button>
        <button aria-label="Batal" data-testid={`${testidPrefix}-add-card-cancel`} onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-[hsl(var(--accent))] text-2">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

const SORTS = [
  { value: "default", label: "Urutan manual" },
  { value: "newest", label: "Terbaru" },
  { value: "title", label: "Judul A-Z" },
  { value: "due", label: "Tenggat terdekat" },
];

export function KanbanColumn({ list, cards, labelsById, usersById, currentBoardId, allBoards, onCardClick, onAddCard, onRenameList, onDeleteList, onSetRequirements, onArchiveAllCards, onCopyList, onMoveList, onArchiveList, canManage, canAddCard = true, readOnly = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list", list },
    disabled: readOnly,
  });
  const handleDragProps = readOnly ? {} : { ...attributes, ...listeners };
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [collapsed, setCollapsed] = useState(false);
  const [sortMode, setSortMode] = useState("default");
  const { theme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  // Warna list adalah pastel (untuk latar terang). Di mode gelap jangan dipakai
  // sebagai latar penuh — tampilkan sebagai garis aksen di atas kolom saja.
  const listBgStyle = list.color && !isDark ? { backgroundColor: list.color } : {};
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sortedCards = useMemo(() => {
    const arr = [...cards];
    if (sortMode === "newest") arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (sortMode === "title") arr.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === "due") arr.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    return arr;
  }, [cards, sortMode]);

  const saveName = () => {
    setEditing(false);
    if (name.trim() && name.trim() !== list.name) onRenameList(list.id, name.trim());
    else setName(list.name);
  };

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-testid={`list-column-${list.id}`}
        className="w-12 shrink-0 bg-[hsl(var(--muted))] rounded-xl flex flex-col items-center py-3 gap-2 shadow-sm cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors max-h-full"
        onClick={() => setCollapsed(false)}
      >
        <ChevronRight size={14} className="text-2" />
        <span className="text-xs font-semibold text-foreground [writing-mode:vertical-rl] rotate-180 truncate max-h-48">{list.name}</span>
        <span className="text-[10px] font-bold text-3 bg-[hsl(var(--elevated))] rounded-full px-1.5 py-0.5">{cards.length}</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...listBgStyle }}
      data-testid={`list-column-${list.id}`}
      className="w-72 shrink-0 rounded-xl flex flex-col max-h-full shadow-sm bg-[hsl(var(--muted))] overflow-hidden"
    >
      {list.color && isDark && (
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: list.color }} />
      )}
      <div
        className={`p-3 pb-2 flex justify-between items-center shrink-0 ${readOnly ? "" : "cursor-grab active:cursor-grabbing"}`}
        {...handleDragProps}
      >
        {editing ? (
          <input
            data-testid={`list-rename-input-${list.id}`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(list.name); setEditing(false); } }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 w-full rounded border border-[#0C66E4] px-2 text-sm font-semibold text-foreground outline-none"
          />
        ) : (
          <h2
            className="font-semibold text-sm text-foreground truncate flex-1 flex items-center gap-1"
            onDoubleClick={() => setEditing(true)}
            data-testid={`list-title-${list.id}`}
          >
            {list.name}
            {(list.entry_requirements || []).length > 0 && (
              <ShieldCheck size={13} className="text-[#E56910] shrink-0" aria-label="Punya syarat masuk" />
            )}
            <span className="ml-1 text-xs font-normal text-3">{cards.length}</span>
          </h2>
        )}
        <div className="flex items-center shrink-0">
          <button
            aria-label="Ciutkan list"
            data-testid={`list-collapse-${list.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setCollapsed(true)}
            className="p-1 rounded hover:bg-[hsl(var(--accent))] text-2 transition-colors"
          >
            <ChevronDown size={15} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Menu List"
                data-testid={`list-menu-${list.id}`}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-[hsl(var(--accent))] text-2 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[hsl(var(--elevated))] shadow-lg w-56">
              <DropdownMenuItem data-testid={`list-rename-${list.id}`} onClick={() => setEditing(true)} className="cursor-pointer">
                <Pencil size={14} className="mr-2" /> Ubah nama
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuItem data-testid={`list-requirements-${list.id}`} onClick={() => onSetRequirements(list)} className="cursor-pointer">
                  <ShieldCheck size={14} className="mr-2" /> Atur syarat masuk
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid={`list-sort-${list.id}`} className="cursor-pointer">
                  <ChevronDown size={14} className="mr-2" /> Urutkan kartu
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-[hsl(var(--elevated))] shadow-lg">
                  {SORTS.map((s) => (
                    <DropdownMenuItem key={s.value} data-testid={`list-sort-${s.value}-${list.id}`} onClick={() => setSortMode(s.value)} className={`cursor-pointer ${sortMode === s.value ? "font-bold text-[#0C66E4]" : ""}`}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid={`list-copy-${list.id}`} onClick={() => onCopyList(list.id)} className="cursor-pointer">
                <Copy size={14} className="mr-2" /> Salin list
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger data-testid={`list-move-${list.id}`} className="cursor-pointer">
                    <FolderInput size={14} className="mr-2" /> Pindah ke board
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-[hsl(var(--elevated))] shadow-lg">
                    {(allBoards || []).filter((b) => b.id !== currentBoardId).map((b) => (
                      <DropdownMenuItem key={b.id} data-testid={`list-move-to-${b.id}`} onClick={() => onMoveList(list.id, b.id)} className="cursor-pointer">
                        {b.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid={`list-archive-cards-${list.id}`} onClick={() => onArchiveAllCards(list.id)} className="cursor-pointer">
                <ArchiveX size={14} className="mr-2" /> Arsipkan semua kartu
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuItem data-testid={`list-archive-${list.id}`} onClick={() => onArchiveList(list.id)} className="cursor-pointer">
                  <Archive size={14} className="mr-2" /> Arsipkan list
                </DropdownMenuItem>
              )}
              <DropdownMenuItem data-testid={`list-delete-${list.id}`} onClick={() => onDeleteList(list.id)} className="text-[#CA3521] cursor-pointer">
                <Trash2 size={14} className="mr-2" /> Hapus list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto minimal-scrollbar px-2 pb-1 space-y-2 min-h-[8px] cursor-default">
        <SortableContext items={sortedCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {sortedCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              labelsById={labelsById}
              usersById={usersById}
              isMirror={card.board_id !== currentBoardId}
              onClick={() => onCardClick(card)}
              readOnly={readOnly}
            />
          ))}
        </SortableContext>
      </div>
      {canAddCard && <AddCardComposer testidPrefix={`list-${list.id}`} onAdd={(t, c) => onAddCard(list.id, t, c)} />}
    </div>
  );
}
