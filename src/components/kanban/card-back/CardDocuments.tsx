// @ts-nocheck
'use client';

/**
 * Panel "Kelengkapan Dokumen" di modal kartu.
 *
 *  - Daftar pihak/pengurus pekerjaan (Direktur, Komisaris, ...). Disimpan di
 *    Master Card, jadi sama untuk seluruh kartu segrup.
 *  - Daftar slot dokumen wajib. Jenis "per pihak" (KTP, NPWP Pribadi) muncul
 *    sekali untuk SETIAP pihak — 2 pengurus berarti 2 baris KTP terpisah.
 *  - Slot yang masih kosong bisa langsung di-upload dari sini: jenis dokumen &
 *    pemiliknya sudah ditentukan, staff tidak perlu memilih apa pun lagi.
 */
import React, { useRef, useState } from 'react';
import {
  FileCheck2, ChevronDown, ChevronRight, Check, Upload, Plus, Trash2, Users,
} from 'lucide-react';
import type { CardBackProps } from './types';

const ROLES = ['Direktur', 'Komisaris', 'Pemegang Saham', 'Pengurus', 'Pemohon', 'Lainnya'];

export default function CardDocuments({
  canEdit = true,
  docStatus,
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onUploadForSlot,
}: Pick<CardBackProps, 'canEdit' | 'docStatus' | 'onAddParty' | 'onUpdateParty' | 'onDeleteParty' | 'onUploadForSlot'>) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Direktur');
  const [busy, setBusy] = useState(false);
  // slot yang sedang menunggu pilihan file — dipakai input file tunggal di bawah
  const pending = useRef<{ typeId: string; partyId: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!docStatus || !onUploadForSlot) return null;

  const { parties = [], slots = [], required_done = 0, required_total = 0 } = docStatus;
  const lengkap = required_total > 0 && required_done === required_total;
  const perPartySlots = slots.some((s: any) => s.party_id);

  const addParty = async () => {
    const name = newName.trim();
    if (!name || !onAddParty) return;
    setBusy(true);
    try {
      await onAddParty(name, newRole);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  const pickFor = (typeId: string, partyId: string | null) => {
    pending.current = { typeId, partyId };
    fileRef.current?.click();
  };

  return (
    <div
      className="mb-3 rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))]"
      data-testid="card-documents-panel"
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <FileCheck2 size={15} className="shrink-0 text-2" />
        <span className="text-[13px] font-bold text-foreground">Kelengkapan Dokumen</span>
        <span
          className={`rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold ${
            lengkap ? 'bg-[#dcfff1] text-[#216e4e]' : 'bg-[#fff7d6] text-[#7f5f01]'
          }`}
        >
          {required_done}/{required_total}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-3">
          {required_total === 0
            ? 'Belum ada jenis dokumen wajib'
            : lengkap
              ? 'Semua dokumen wajib sudah ada'
              : `Kurang ${required_total - required_done} dokumen`}
        </span>
        {open ? <ChevronDown size={15} className="text-3" /> : <ChevronRight size={15} className="text-3" />}
      </button>

      {open && (
        <div className="border-t border-[hsl(var(--hairline))] px-3 py-3">
          {/* ── Pihak / pengurus ─────────────────────────────────────── */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-foreground">
              <Users size={13} className="text-2" /> Pengurus / Pihak
              <span className="font-normal text-3">({parties.length})</span>
            </div>
            <p className="mb-2 text-[11px] text-3">
              Daftar orang di pekerjaan ini. KTP &amp; NPWP pribadi dihitung sekali untuk tiap orang.
            </p>

            {parties.length === 0 ? (
              <p className="rounded-[6px] bg-[hsl(var(--muted))] p-2 text-[11.5px] text-3">
                Belum ada pihak. Tambahkan dulu supaya KTP/NPWP tiap orang terpisah.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {parties.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <input
                      defaultValue={p.name}
                      disabled={!canEdit}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== p.name) onUpdateParty?.(p.id, { name: v });
                        else e.target.value = p.name;
                      }}
                      className="h-[28px] min-w-0 flex-1 rounded-[4px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] px-2 text-[12px]"
                    />
                    <select
                      value={p.role}
                      disabled={!canEdit}
                      onChange={(e) => onUpdateParty?.(p.id, { role: e.target.value })}
                      className="h-[28px] shrink-0 rounded-[4px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] px-1 text-[11.5px]"
                    >
                      {[...new Set([p.role, ...ROLES])].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {canEdit && (
                      <button
                        type="button"
                        title="Hapus pihak (lampirannya tidak ikut terhapus)"
                        onClick={() => {
                          if (confirm(`Hapus ${p.name} dari daftar pihak?\n\nLampirannya tidak ikut terhapus, hanya kehilangan penanda pemilik.`)) {
                            onDeleteParty?.(p.id);
                          }
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-2 hover:bg-[hsl(var(--muted))] hover:text-[#e34935]"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && onAddParty && (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addParty(); } }}
                  placeholder="Nama, mis. Budi Santoso"
                  className="h-[28px] min-w-0 flex-1 rounded-[4px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] px-2 text-[12px]"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="h-[28px] shrink-0 rounded-[4px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] px-1 text-[11.5px]"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  type="button"
                  onClick={addParty}
                  disabled={busy || !newName.trim()}
                  className="flex h-[28px] shrink-0 items-center gap-1 rounded-[5px] bg-[#0c66e4] px-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Plus size={13} /> Tambah
                </button>
              </div>
            )}
          </div>

          {/* ── Slot dokumen wajib ───────────────────────────────────── */}
          <div className="mb-1.5 text-[12px] font-bold text-foreground">Dokumen wajib</div>
          {slots.length === 0 ? (
            <p className="rounded-[6px] bg-[hsl(var(--muted))] p-2 text-[11.5px] text-3">
              Belum ada jenis dokumen yang ditandai wajib (atur di Arsip → Jenis Dokumen).
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {slots.map((s: any) => (
                <div
                  key={s.key}
                  className={`flex items-center gap-2 rounded-[6px] border px-2 py-1.5 ${
                    s.done
                      ? 'border-transparent bg-[hsl(var(--muted))]'
                      : 'border-[#f5cd47] bg-[#fff7d6]'
                  }`}
                >
                  <span
                    className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
                      s.done ? 'bg-[#22a06b] text-white' : 'border border-[#b38600]'
                    }`}
                  >
                    {s.done ? <Check size={11} strokeWidth={3} /> : null}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[12px] ${s.done ? 'text-3' : 'font-semibold text-[#7f5f01]'}`}>
                    {s.type_name}
                    {s.party_name && (
                      <span className="font-normal"> — {s.party_name} ({s.party_role})</span>
                    )}
                  </span>
                  {!s.done && canEdit && (
                    <button
                      type="button"
                      onClick={() => pickFor(s.type_id, s.party_id)}
                      className="flex h-[24px] shrink-0 items-center gap-1 rounded-[4px] border border-[#b38600] px-1.5 text-[11px] font-semibold text-[#7f5f01] hover:bg-[#f5cd47]/30"
                    >
                      <Upload size={11} /> Upload
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {perPartySlots && (
            <p className="mt-2 text-[11px] text-3">
              Tambah atau hapus pihak di atas untuk menambah/mengurangi baris KTP &amp; NPWP pribadi.
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              const slot = pending.current;
              e.target.value = '';
              pending.current = null;
              if (files.length && slot) await onUploadForSlot(files, slot.typeId, slot.partyId);
            }}
          />
        </div>
      )}
    </div>
  );
}
