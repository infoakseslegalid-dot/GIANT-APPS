import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MessageSquare, Paperclip, CheckSquare, AlignLeft, Link2, MoreHorizontal, Pencil, Trash2, Plus, X,
} from "lucide-react";
import { Avatar, LabelChip, DueBadge, PriorityFlag, StatusBadge } from "./common";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem,
} from "./ui/dropdown-menu";

export function CardTile({ card, labelsById, usersById, onClick, isMirror }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
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
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-testid={`card-tile-${card.id}`}
      className="bg-white rounded-lg shadow-sm hover:bg-gray-50 border-b border-gray-300 p-3 cursor-pointer group flex flex-col gap-2 relative"
    >
      <button
        aria-label="Edit Kartu"
        data-testid={`card-quick-edit-${card.id}`}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200 text-[#44546F]"
      >
        <Pencil size={12} />
      </button>
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cardLabels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-[#172B4D] leading-snug pr-4">{card.title}</p>
        {card.client_name && <p className="text-xs text-[#44546F] mt-0.5">{card.client_name}</p>}
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
        <div className="flex items-center gap-2 text-[#44546F]">
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
            <Avatar key={m.id} name={m.name} color={m.avatar_color} size="h-6 w-6 text-[10px]" />
          ))}
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
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        data-testid={`${testidPrefix}-add-card-open`}
        onClick={() => setOpen(true)}
        className="m-2 mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#44546F] hover:bg-[#091E4224] transition-colors w-[calc(100%-16px)] text-left"
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
        className="w-full rounded-lg border border-[#DFE1E6] p-2 text-sm text-[#172B4D] outline-none focus:ring-2 focus:ring-[#0C66E4] resize-none bg-white shadow-sm"
        rows={2}
      />
      <input
        data-testid={`${testidPrefix}-add-card-client`}
        value={client}
        onChange={(e) => setClient(e.target.value)}
        placeholder="Nama klien (opsional)"
        className="w-full h-8 rounded-lg border border-[#DFE1E6] px-2 text-sm text-[#172B4D] outline-none focus:ring-2 focus:ring-[#0C66E4] bg-white"
      />
      <div className="flex items-center gap-2">
        <button
          data-testid={`${testidPrefix}-add-card-submit`}
          onClick={submit}
          className="h-8 px-3 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95"
        >
          Tambah kartu
        </button>
        <button aria-label="Batal" data-testid={`${testidPrefix}-add-card-cancel`} onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-[#091E4224] text-[#44546F]">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function KanbanColumn({ list, cards, labelsById, usersById, currentBoardId, onCardClick, onAddCard, onRenameList, onDeleteList }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list", list },
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const saveName = () => {
    setEditing(false);
    if (name.trim() && name.trim() !== list.name) onRenameList(list.id, name.trim());
    else setName(list.name);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`list-column-${list.id}`}
      className="w-72 shrink-0 bg-[#f1f2f4] rounded-xl flex flex-col max-h-full shadow-sm"
    >
      <div className="p-3 pb-2 flex justify-between items-center shrink-0 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        {editing ? (
          <input
            data-testid={`list-rename-input-${list.id}`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(list.name); setEditing(false); } }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 w-full rounded border border-[#0C66E4] px-2 text-sm font-semibold text-[#172B4D] outline-none"
          />
        ) : (
          <h2
            className="font-semibold text-sm text-[#172B4D] truncate flex-1"
            onDoubleClick={() => setEditing(true)}
            data-testid={`list-title-${list.id}`}
          >
            {list.name}
            <span className="ml-2 text-xs font-normal text-[#8590A2]">{cards.length}</span>
          </h2>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Menu List"
              data-testid={`list-menu-${list.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-[#091E4224] text-[#44546F] transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white shadow-lg">
            <DropdownMenuItem data-testid={`list-rename-${list.id}`} onClick={() => setEditing(true)} className="cursor-pointer">
              <Pencil size={14} className="mr-2" /> Ubah nama
            </DropdownMenuItem>
            <DropdownMenuItem data-testid={`list-delete-${list.id}`} onClick={() => onDeleteList(list.id)} className="text-[#CA3521] cursor-pointer">
              <Trash2 size={14} className="mr-2" /> Hapus list (arsipkan kartu)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 overflow-y-auto minimal-scrollbar px-2 pb-1 space-y-2 min-h-[8px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              labelsById={labelsById}
              usersById={usersById}
              isMirror={card.board_id !== currentBoardId}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>
      </div>
      <AddCardComposer testidPrefix={`list-${list.id}`} onAdd={(t, c) => onAddCard(list.id, t, c)} />
    </div>
  );
}
