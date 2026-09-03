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
import { GripVertical, SquareCheck, Trash2, X } from 'lucide-react';
import type { Checklist, ChecklistItem, CardBackProps } from './types';
import { Popover, PopoverTrigger, PopoverContent } from '../../ui/popover';

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
  onUpdateChecklistItem,
  onDeleteChecklistItem,
}: { checklistId: string; item: ChecklistItem } & Pick<
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
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 rounded-[5px] px-1 py-[3px] hover:bg-[#f7f8f9]"
    >
      <button
        type="button"
        aria-label="Geser untuk mengurutkan"
        className="mt-[3px] cursor-grab text-[#8590a2] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
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
          className="min-w-0 flex-1 rounded border border-[#0c66e4] px-1 py-[1px] text-[12px] text-[#172b4d] outline-none"
        />
      ) : (
        <span
          onClick={() => {
            setDraft(item.text);
            setEditing(true);
          }}
          className={`min-w-0 flex-1 cursor-text text-[12px] leading-[1.5] ${
            item.done ? 'text-[#8590a2] line-through' : 'text-[#172b4d]'
          }`}
        >
          {item.text}
        </span>
      )}

      <button
        type="button"
        aria-label="Hapus item"
        onClick={() => onDeleteChecklistItem(checklistId, item.id)}
        className="mt-[1px] shrink-0 rounded p-[3px] text-[#8590a2] opacity-0 transition-opacity hover:bg-[#091e420f] hover:text-[#e34935] group-hover:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function ChecklistBlock({
  checklist,
  handlers,
}: {
  checklist: Checklist;
  handlers: ChecklistHandlers;
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
            className="min-w-0 flex-1 rounded border border-[#0c66e4] px-1 text-[13px] font-bold text-[#172b4d] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(checklist.title);
              setTitleEditing(true);
            }}
            className="min-w-0 flex-1 truncate text-left text-[13px] font-bold text-[#172b4d]"
          >
            {checklist.title}
          </button>
        )}
        <span className="shrink-0 text-[11px] font-semibold text-[#5e6c84]">
          {done}/{total}
        </span>
        <button
          type="button"
          aria-label="Hapus checklist"
          onClick={() => onDeleteChecklist(checklist.id)}
          className="shrink-0 rounded p-1 text-[#8590a2] hover:bg-[#091e420f] hover:text-[#e34935]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="w-8 text-right text-[10px] font-semibold text-[#5e6c84]">{pct}%</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#dfe1e6]">
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
        className="ml-6 mt-1 w-[calc(100%-1.5rem)] rounded-[5px] border border-[#dfe1e6] bg-white px-2 py-1.5 text-[12px] text-[#172b4d] outline-none focus:border-[#0c66e4]"
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

  

  return (
    <div className="mt-[18px]" data-card-checklist>
      {card.checklists.map((cl) => (
        <ChecklistBlock key={cl.id} checklist={cl} handlers={handlers} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-[5px] border border-[#dfe1e6] bg-[#f7f8f9] px-[11px] py-[6px] text-[12px] text-[#172b4d] hover:bg-[#e9ebee]"
          >
            + Checklist
          </button>
        </PopoverTrigger>
        {/* @ts-expect-error JS interop children missing */}
        <PopoverContent align="start" className="w-64 p-0 shadow-lg rounded-[8px] overflow-hidden border-[#dfe1e6]" sideOffset={4}>
          <div className="flex flex-col text-[#172b4d]">
            <div className="relative flex h-10 items-center justify-center border-b border-[#091e4224] px-4">
              <span className="text-sm font-semibold text-[#5e6c84]">Add Checklist</span>
              <button onClick={() => setOpen(false)} className="absolute right-2 text-[#6b778c] hover:text-[#172b4d]"><X size={16}/></button>
            </div>
            <div className="flex flex-col p-2 gap-1">
              <button onClick={() => { onAddChecklist('Checklist'); setOpen(false); }} className="text-left px-3 py-2 text-sm rounded hover:bg-[#091e420f]">
                Blank Checklist
              </button>
              <div className="px-3 py-1 mt-1 text-xs font-semibold text-[#5e6c84]">Templates</div>
              {TEMPLATES.map(t => (
                <button key={t.title} onClick={() => { onAddChecklist(t.title, t.items); setOpen(false); }} className="text-left px-3 py-2 text-sm rounded hover:bg-[#091e420f]">
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
