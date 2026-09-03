'use client';

import React, { useState } from 'react';
import { ChevronLeft, Plus, X, Pencil } from 'lucide-react';
import type { CardBackProps, LabelColor, CardLabel } from './types';
import { labelHex, resolveColor } from './helpers';
import { Popover, PopoverTrigger, PopoverContent } from '../../ui/popover';

const COLORS: LabelColor[] = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'gray'];

export default function CardLabels(
  { card, availableLabels, onToggleLabel, onCreateLabel, onUpdateLabel, open: openProp, onOpenChange }:
  CardBackProps & { open?: boolean; onOpenChange?: (v: boolean) => void },
) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => { if (onOpenChange) onOpenChange(v); else setOpenState(v); };
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<LabelColor | string>('green');

  const activeIds = new Set(card.labels?.map((l) => l.id) || []);
  const filtered = availableLabels.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setNewName('');
    setNewColor('green');
    setView('create');
  };

  const openEdit = (l: CardLabel) => {
    setEditTargetId(l.id);
    setNewName(l.name);
    setNewColor(l.color);
    setView('edit');
  };

  const handleSave = async () => {
    if (!newName.trim()) return;
    if (view === 'create') {
      await onCreateLabel(newName, newColor);
    } else if (view === 'edit' && editTargetId) {
      await onUpdateLabel(editTargetId, newName, newColor);
    }
    setView('list');
    setNewName('');
    setSearch('');
  };

  const goBack = () => setView('list');

  return (
    <div className="mb-6">
      <div className="mb-2 text-xs font-semibold text-[#5e6c84]">Labels</div>
      <div className="flex flex-wrap gap-1.5">
        {card.labels?.map((l) => (
          <span
            key={l.id}
            className="flex h-8 items-center rounded px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: resolveColor(l.color as string) || undefined }}
            title={l.name}
          >
            {l.name}
          </span>
        ))}
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded bg-[#091e420f] text-[#42526e] transition-colors hover:bg-[#091e4224]"
            >
              <Plus size={16} />
            </button>
          </PopoverTrigger>
          {/* @ts-expect-error JS interop children missing */}
          <PopoverContent align="start" className="w-80 p-0 shadow-lg rounded-[8px] overflow-hidden border-[#dfe1e6]" sideOffset={8}>
            
            {/* LIST VIEW */}
            {view === 'list' && (
              <div className="flex flex-col text-[#172b4d]">
                <div className="relative flex h-10 items-center justify-center border-b border-[#091e4224] px-4">
                  <span className="text-sm font-semibold text-[#5e6c84]">Labels</span>
                  <button onClick={() => setOpen(false)} className="absolute right-2 text-[#6b778c] hover:text-[#172b4d]"><X size={16}/></button>
                </div>
                <div className="p-3">
                  <input
                    type="text"
                    placeholder="Search labels..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-3 w-full rounded-[4px] border-2 border-[#dfe1e6] bg-[#fafbfc] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[#4c9aff]"
                  />
                  <div className="mb-2 text-xs font-semibold text-[#5e6c84]">Labels</div>
                  <div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto minimal-scrollbar pr-1">
                    {filtered.map(l => (
                      <div key={l.id} className="flex items-center gap-1">
                        <button
                          onClick={() => onToggleLabel(l.id)}
                          className="group relative flex h-8 flex-1 items-center rounded-[4px] px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ background: resolveColor(l.color as string) || undefined }}
                        >
                          <span className="flex-1 truncate text-left">{l.name}</span>
                          {activeIds.has(l.id) && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="absolute right-2 opacity-100">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(l)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-[#6b778c] hover:bg-[#091e420f] hover:text-[#172b4d]"
                          title="Edit label"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    ))}
                    {filtered.length === 0 && <div className="text-center text-sm text-[#5e6c84] py-4">No labels found.</div>}
                  </div>
                  
                  <button
                    onClick={openCreate}
                    className="mt-3 w-full rounded-[4px] bg-[#091e420f] py-2 text-sm font-medium text-[#172b4d] transition-colors hover:bg-[#091e4224]"
                  >
                    Create a new label
                  </button>
                </div>
              </div>
            )}

            {/* CREATE / EDIT VIEW */}
            {view !== 'list' && (
              <div className="flex flex-col text-[#172b4d]">
                <div className="relative flex h-10 items-center justify-center border-b border-[#091e4224] px-4">
                  <button onClick={goBack} className="absolute left-2 text-[#6b778c] hover:text-[#172b4d]">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-semibold text-[#5e6c84]">{view === 'create' ? 'Create label' : 'Edit label'}</span>
                  <button onClick={() => setOpen(false)} className="absolute right-2 text-[#6b778c] hover:text-[#172b4d]"><X size={16}/></button>
                </div>
                <div className="p-3">
                  <div className="mb-4 flex justify-center bg-[#f4f5f7] rounded-[4px] p-8">
                    <div className="flex h-8 w-full max-w-[240px] items-center rounded-[4px] px-3 text-sm font-semibold text-white" style={{ background: resolveColor(newColor as string) || undefined }}>
                      {newName || 'Label name'}
                    </div>
                  </div>
                  <div className="mb-1 text-xs font-semibold text-[#5e6c84]">Title</div>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mb-4 w-full rounded-[4px] border-2 border-[#dfe1e6] bg-[#fafbfc] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[#4c9aff]"
                    autoFocus
                  />
                  <div className="mb-2 text-xs font-semibold text-[#5e6c84]">Select a color</div>
                  <div className="mb-4 grid grid-cols-5 gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={`h-8 rounded-[4px] transition-all hover:opacity-80 ${newColor === c ? 'ring-2 ring-[#0c66e4] ring-offset-1' : ''}`}
                        style={{ background: labelHex(c) }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={!newName.trim()}
                      className="flex-1 rounded-[4px] bg-[#0c66e4] py-2 text-sm font-medium text-white transition-colors hover:bg-[#0052cc] disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
