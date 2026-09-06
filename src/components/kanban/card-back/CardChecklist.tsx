'use client';

/**
 * .checklist-group (trello-card-layout.html): Block checklist.
 * Mendukung drag-and-drop item (Sortable).
 * Progress bar otomatis dihitung.
 */

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, SquareCheck, Trash2, X, Paperclip, MessageSquare } from 'lucide-react';
import type { Checklist, ChecklistItem, CardActivity, CardAttachment, CardBackProps } from './types';
import { Popover, PopoverTrigger, PopoverContent } from '../../ui/popover';

/** Cuplikan singkat dari HTML komentar, buat ditampilkan di chip bukti. */
function commentSnippet(html: string, max = 60): string {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Popover kecil untuk menautkan satu item checklist ke lampiran/komentar sebagai bukti. */
function EvidencePicker({
  item, checklistId, attachments, comments, onUpdateChecklistItem,
}: {
  item: ChecklistItem;
  checklistId: string;
  attachments: CardAttachment[];
  comments: CardActivity[];
  onUpdateChecklistItem: ChecklistHandlers['onUpdateChecklistItem'];
}) {
  const [open, setOpen] = useState(false);
  const hasEvidence = !!(item.evidence_attachment_id || item.evidence_comment_id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Tautkan bukti"
          title="Tautkan ke lampiran/komentar sebagai bukti"
          className={`mt-[1px] shrink-0 rounded p-[3px] transition-opacity hover:bg-[hsl(var(--muted))] ${
            hasEvidence ? 'text-[#0c66e4] opacity-100' : 'text-3 opacity-0 group-hover:opacity-100'
          }`}
        >
          <Paperclip size={13} />
        </button>
      </PopoverTrigger>
      {/* @ts-expect-error JS interop children missing */}
      <PopoverContent align="start" className="w-72 p-0 shadow-lg rounded-[8px] overflow-hidden border-[hsl(var(--hairline))]" sideOffset={4}>
        <div className="flex flex-col text-foreground">
          <div className="relative flex h-9 items-center justify-center border-b border-[hsl(var(--hairline))] px-4">
            <span className="text-[12px] font-semibold text-3">Tautkan bukti kelengkapan</span>
            <button onClick={() => setOpen(false)} className="absolute right-2 text-3 hover:text-foreground"><X size={14} /></button>
          </div>
          <div className="max-h-[260px] overflow-y-auto p-2">
            <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-3">Lampiran</p>
            {attachments.length === 0 && <p className="px-1 pb-2 text-[11.5px] italic text-3">Belum ada lampiran.</p>}
            {attachments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { onUpdateChecklistItem(checklistId, item.id, { evidence_attachment_id: a.id }); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[hsl(var(--muted))]"
              >
                <Paperclip size={13} className="shrink-0 text-3" />
                <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
              </button>
            ))}
            <p className="mt-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-3">Komentar</p>
            {comments.length === 0 && <p className="px-1 text-[11.5px] italic text-3">Belum ada komentar.</p>}
            {comments.map((cm) => (
              <button
                key={cm.id}
                type="button"
                onClick={() => { onUpdateChecklistItem(checklistId, item.id, { evidence_comment_id: cm.id }); setOpen(false); }}
                className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[hsl(var(--muted))]"
              >
                <MessageSquare size={13} className="mt-[2px] shrink-0 text-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{cm.author?.name}</span>
                  <span className="block truncate text-3">{commentSnippet(cm.body)}</span>
                </span>
              </button>
            ))}
          </div>
          {hasEvidence && (
            <button
              type="button"
              onClick={() => {
                onUpdateChecklistItem(checklistId, item.id, { evidence_attachment_id: null, evidence_comment_id: null });
                setOpen(false);
              }}
              className="border-t border-[hsl(var(--hairline))] px-3 py-2 text-left text-[12px] font-semibold text-[#c9372c] hover:bg-[#ffecEB]"
            >
              Lepas tautan bukti
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Chip kecil yang tampil di bawah item kalau sudah ada bukti tertaut. */
function EvidenceChip({ item, attachments, comments }: { item: ChecklistItem; attachments: CardAttachment[]; comments: CardActivity[] }) {
  if (item.evidence_attachment_id) {
    const a = attachments.find((x) => x.id === item.evidence_attachment_id);
    return (
      <span className="ml-[42px] mt-[-2px] mb-1 flex items-center gap-1 text-[11px] text-3">
        <Paperclip size={11} className="shrink-0" />
        {a ? <span className="truncate">{a.fileName}</span> : <span className="italic">(bukti sudah dihapus)</span>}
      </span>
    );
  }
  if (item.evidence_comment_id) {
    const cm = comments.find((x) => x.id === item.evidence_comment_id);
    return (
      <span className="ml-[42px] mt-[-2px] mb-1 flex items-center gap-1 text-[11px] text-3">
        <MessageSquare size={11} className="shrink-0" />
        {cm ? <span className="truncate">{commentSnippet(cm.body, 50)}</span> : <span className="italic">(bukti sudah dihapus)</span>}
      </span>
    );
  }
  return null;
}

export interface ChecklistHandlers {
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onAddChecklistItem: (checklistId: string, text: string) => Promise<void>;
  onUpdateChecklistItem: (checklistId: string, itemId: string, patch: Partial<ChecklistItem>) => Promise<void>;
  onDeleteChecklistItem: (checklistId: string, itemId: string) => Promise<void>;
  onReorderChecklistItems: (checklistId: string, itemIds: string[]) => Promise<void>;
}

function SortableItem({
  checklistId,
  item,
  attachments,
  comments,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
}: { checklistId: string; item: ChecklistItem; attachments: CardAttachment[]; comments: CardActivity[] } & Pick<
  ChecklistHandlers,
  'onUpdateChecklistItem' | 'onDeleteChecklistItem'
>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== item.text) onUpdateChecklistItem(checklistId, item.id, { text: t });
    else setDraft(item.text);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="group flex items-start gap-2 rounded-[5px] px-1 py-[3px] hover:bg-[hsl(var(--muted))]">
        <button
          type="button"
          aria-label="Geser untuk mengurutkan"
          className="mt-[3px] cursor-grab text-3 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        <input
          type="checkbox"
          checked={item.done}
          onChange={(e) => onUpdateChecklistItem(checklistId, item.id, { done: e.target.checked })}
          className="mt-[2px] h-[15px] w-[15px] shrink-0 accent-[#0c66e4]"
        />

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setDraft(item.text);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-[#0c66e4] px-1 py-[1px] text-[12px] text-foreground outline-none"
          />
        ) : (
          <span
            onClick={() => {
              setDraft(item.text);
              setEditing(true);
            }}
            className={`min-w-0 flex-1 cursor-text text-[12px] leading-[1.5] ${
              item.done ? 'text-3 line-through' : 'text-foreground'
            }`}
          >
            {item.text}
          </span>
        )}

        <EvidencePicker
          item={item}
          checklistId={checklistId}
          attachments={attachments}
          comments={comments}
          onUpdateChecklistItem={onUpdateChecklistItem}
        />

        <button
          type="button"
          aria-label="Hapus item"
          onClick={() => onDeleteChecklistItem(checklistId, item.id)}
          className="mt-[1px] shrink-0 rounded p-[3px] text-3 opacity-0 transition-opacity hover:bg-[hsl(var(--muted))] hover:text-[#e34935] group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <EvidenceChip item={item} attachments={attachments} comments={comments} />
    </div>
  );
}

function ChecklistBlock({
  checklist,
  handlers,
  attachments,
  comments,
}: {
  checklist: Checklist;
  handlers: ChecklistHandlers;
  attachments: CardAttachment[];
  comments: CardActivity[];
}) {
  const {
    onRenameChecklist,
    onDeleteChecklist,
    onAddChecklistItem,
    onUpdateChecklistItem,
    onDeleteChecklistItem,
    onReorderChecklistItems,
  } = handlers;

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(checklist.title);
  const [newItem, setNewItem] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const total = checklist.items.length;
  const done = checklist.items.filter((i) => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = checklist.items.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorderChecklistItems(checklist.id, arrayMove(ids, from, to));
  };

  const commitTitle = () => {
    setTitleEditing(false);
    const t = titleDraft.trim();
    if (t && t !== checklist.title) onRenameChecklist(checklist.id, t);
    else setTitleDraft(checklist.title);
  };

  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    onAddChecklistItem(checklist.id, t);
    setNewItem('');
  };

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <SquareCheck size={16} className="shrink-0" />
        {titleEditing ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
              } else if (e.key === 'Escape') {
                setTitleDraft(checklist.title);
                setTitleEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-[#0c66e4] px-1 text-[13px] font-bold text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(checklist.title);
              setTitleEditing(true);
            }}
            className="min-w-0 flex-1 truncate text-left text-[13px] font-bold text-foreground"
          >
            {checklist.title}
          </button>
        )}
        <span className="shrink-0 text-[11px] font-semibold text-3">
          {done}/{total}
        </span>
        <button
          type="button"
          aria-label="Hapus checklist"
          onClick={() => onDeleteChecklist(checklist.id)}
          className="shrink-0 rounded p-1 text-3 hover:bg-[hsl(var(--muted))] hover:text-[#e34935]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="w-8 text-right text-[10px] font-semibold text-3">{pct}%</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
          <div
            className="h-full rounded-full bg-[#36b37e] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={checklist.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="ml-1">
            {checklist.items.map((item) => (
              <SortableItem
                key={item.id}
                checklistId={checklist.id}
                item={item}
                attachments={attachments}
                comments={comments}
                onUpdateChecklistItem={onUpdateChecklistItem}
                onDeleteChecklistItem={onDeleteChecklistItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <input
        value={newItem}
        onChange={(e) => setNewItem(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
          }
        }}
        onBlur={addItem}
        placeholder="Tambah item…"
        className="ml-6 mt-1 w-[calc(100%-1.5rem)] rounded-[5px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-[#0c66e4]"
      />
    </div>
  );
}

const TEMPLATES = [
  {
    title: 'Template Pendirian PT',
    items: ['Cek KTP Direksi', 'Cek NPWP', 'Drafting Akta', 'Approval Akta', 'SK Kemenkumham']
  },
  {
    title: 'Template Pendirian CV',
    items: ['Cek KTP Pengurus', 'Drafting Akta CV', 'Pendaftaran Sistem Kemenkumham']
  }
];

export default function CardChecklist({
  card,
  onAddChecklist,
  onRenameChecklist,
  onDeleteChecklist,
  onAddChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
  onReorderChecklistItems,
}: Pick<CardBackProps, 'card' | 'onAddChecklist'> & ChecklistHandlers) {
  const [open, setOpen] = useState(false);
  const handlers: ChecklistHandlers = {
    onRenameChecklist,
    onDeleteChecklist,
    onAddChecklistItem,
    onUpdateChecklistItem,
    onDeleteChecklistItem,
    onReorderChecklistItems,
  };

  const attachments = card.attachments || [];
  const comments = (card.activities || []).filter((a) => a.kind === 'comment');

  return (
    <div className="mt-[18px]" data-card-checklist>
      {card.checklists.map((cl) => (
        <ChecklistBlock key={cl.id} checklist={cl} handlers={handlers} attachments={attachments} comments={comments} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-[5px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] px-[11px] py-[6px] text-[12px] text-foreground hover:bg-[hsl(var(--muted))]"
          >
            + Checklist
          </button>
        </PopoverTrigger>
        {/* @ts-expect-error JS interop children missing */}
        <PopoverContent align="start" className="w-64 p-0 shadow-lg rounded-[8px] overflow-hidden border-[hsl(var(--hairline))]" sideOffset={4}>
          <div className="flex flex-col text-foreground">
            <div className="relative flex h-10 items-center justify-center border-b border-[hsl(var(--hairline))] px-4">
              <span className="text-sm font-semibold text-3">Add Checklist</span>
              <button onClick={() => setOpen(false)} className="absolute right-2 text-3 hover:text-foreground"><X size={16}/></button>
            </div>
            <div className="flex flex-col p-2 gap-1">
              <button onClick={() => { onAddChecklist('Checklist'); setOpen(false); }} className="text-left px-3 py-2 text-sm rounded hover:bg-[hsl(var(--muted))]">
                Blank Checklist
              </button>
              <div className="px-3 py-1 mt-1 text-xs font-semibold text-3">Templates</div>
              {TEMPLATES.map(t => (
                <button key={t.title} onClick={() => { onAddChecklist(t.title, t.items); setOpen(false); }} className="text-left px-3 py-2 text-sm rounded hover:bg-[hsl(var(--muted))]">
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
