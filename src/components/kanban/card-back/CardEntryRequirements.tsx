'use client';

/**
 * Panel "Syarat Pindah List" di kartu.
 *
 * Tujuan: Admin & CS bisa langsung LIHAT aturan syarat tiap list di board ini
 * tanpa buka Admin Panel, plus status per syarat untuk KARTU INI (sudah / belum
 * tercentang). Kalau item checklist syaratnya sudah ada di kartu, baris bisa
 * diklik untuk mencentang langsung (verifikasi). Kalau belum ada, tersedia
 * tombol untuk menariknya jadi checklist "Syarat <list>" di kartu.
 *
 * Enforcement sebenarnya tetap di server (POST /work-items/:id/move):
 * kartu tak bisa pindah sebelum semua syarat tercentang; supervisor bisa paksa.
 */

import React, { useMemo, useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronRight, Check, Plus } from 'lucide-react';
import type { CardBackProps } from './types';

const norm = (s: string) => (s || '').trim().toLowerCase();

type BoardList = NonNullable<CardBackProps['boardLists']>[number];

export default function CardEntryRequirements(props: CardBackProps) {
  const { card, boardLists = [], canEdit = true, onAddChecklist, onUpdateChecklistItem } = props;
  const [expanded, setExpanded] = useState(true);
  const [busyList, setBusyList] = useState<string | null>(null);

  const listsWithReqs = useMemo(
    () => boardLists.filter((l) => (l.entry_requirements || []).length > 0),
    [boardLists],
  );

  // teks item checklist (lowercased) -> daftar lokasi + status done
  const itemIndex = useMemo(() => {
    const map = new Map<string, { checklistId: string; itemId: string; done: boolean }[]>();
    for (const cl of card.checklists || []) {
      for (const it of cl.items || []) {
        const k = norm(it.text);
        if (!k) continue;
        const arr = map.get(k) || [];
        arr.push({ checklistId: cl.id, itemId: it.id, done: !!it.done });
        map.set(k, arr);
      }
    }
    return map;
  }, [card.checklists]);

  const locs = (req: string) => itemIndex.get(norm(req)) || [];
  const isMet = (req: string) => locs(req).some((x) => x.done);
  const hasItem = (req: string) => itemIndex.has(norm(req));

  if (listsWithReqs.length === 0) return null;

  const curIdx = listsWithReqs.findIndex((l) => l.id === card.listId);
  const currentPos = boardLists.find((l) => l.id === card.listId)?.position ?? -Infinity;
  const nextList =
    curIdx >= 0 ? listsWithReqs[curIdx + 1] : listsWithReqs.find((l) => l.position > currentPos);
  const focusList: BoardList | undefined =
    nextList || (curIdx >= 0 ? listsWithReqs[curIdx] : listsWithReqs[0]);
  const focusReqs = focusList?.entry_requirements || [];
  const focusMet = focusReqs.filter(isMet).length;

  const toggle = async (req: string) => {
    if (!canEdit) return;
    const loc = locs(req)[0];
    if (!loc) return;
    await onUpdateChecklistItem(loc.checklistId, loc.itemId, { done: !loc.done });
  };

  const pullChecklist = async (l: BoardList) => {
    if (!canEdit || busyList) return;
    setBusyList(l.id);
    try {
      await onAddChecklist(`Syarat ${l.name}`, l.entry_requirements);
    } finally {
      setBusyList(null);
    }
  };

  return (
    <section className="rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))]" data-testid="card-entry-requirements">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <ShieldCheck size={15} className="shrink-0 text-[#E56910]" />
        <span className="text-[13px] font-semibold text-foreground">Syarat Pindah List</span>
        {focusList && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-3">
            <span className="hidden sm:inline">menuju</span>
            <span className="font-semibold text-foreground">{focusList.name}</span>
            <span
              className={`rounded px-1.5 py-0.5 font-semibold ${
                focusMet === focusReqs.length
                  ? 'bg-[#E3FCEF] text-[#216E4E]'
                  : 'bg-[#FFF7D6] text-[#7F5F01]'
              }`}
            >
              {focusMet}/{focusReqs.length}
            </span>
          </span>
        )}
        {expanded ? (
          <ChevronDown size={14} className="ml-1 shrink-0 text-3" />
        ) : (
          <ChevronRight size={14} className="ml-1 shrink-0 text-3" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-[hsl(var(--hairline))] px-3 py-2.5">
          <p className="text-[11px] leading-snug text-3">
            Kartu baru bisa dipindah ke sebuah list kalau semua item di bawah sudah tercentang
            di kartu ini. Supervisor / Admin bisa memaksa (tercatat di log).
          </p>

          {listsWithReqs.map((l) => {
            const reqs = l.entry_requirements;
            const met = reqs.filter(isMet).length;
            const isCurrent = l.id === card.listId;
            const anyMissing = reqs.some((r) => !hasItem(r));
            return (
              <div
                key={l.id}
                className={`rounded-[6px] border px-2.5 py-2 ${
                  l.id === focusList?.id
                    ? 'border-[#0c66e4] bg-[#E9F2FF] dark:bg-[#0c66e4]/10'
                    : 'border-[hsl(var(--hairline))]'
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-foreground">{l.name}</span>
                  {isCurrent && (
                    <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold text-3">
                      list saat ini
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-semibold text-3">
                    {met}/{reqs.length}
                  </span>
                </div>

                <ul className="space-y-0.5">
                  {reqs.map((r) => {
                    const met1 = isMet(r);
                    const exists = hasItem(r);
                    return (
                      <li key={r}>
                        <button
                          type="button"
                          disabled={!canEdit || !exists}
                          onClick={() => toggle(r)}
                          className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[12px] ${
                            canEdit && exists ? 'hover:bg-[hsl(var(--muted))]' : 'cursor-default'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              met1
                                ? 'border-[#22A06B] bg-[#22A06B] text-white'
                                : 'border-[#B3BAC5] text-transparent'
                            }`}
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span
                            className={
                              met1 ? 'text-foreground line-through decoration-[#22A06B]/60' : 'text-foreground'
                            }
                          >
                            {r}
                          </span>
                          {!exists ? (
                            <span className="ml-auto shrink-0 text-[10px] text-3">belum ada di kartu</span>
                          ) : !met1 ? (
                            <span className="ml-auto shrink-0 text-[10px] font-semibold text-[#7F5F01]">belum</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {canEdit && anyMissing && (
                  <button
                    type="button"
                    disabled={busyList === l.id}
                    onClick={() => pullChecklist(l)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded border border-[hsl(var(--hairline))] px-2 py-1 text-[11px] font-semibold text-2 hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                  >
                    <Plus size={12} />
                    {busyList === l.id ? 'Membuat…' : `Buat checklist "Syarat ${l.name}" di kartu`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
