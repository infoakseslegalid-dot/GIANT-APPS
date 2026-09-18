// @ts-nocheck
'use client';

/**
 * Panel "Data Klien & Perusahaan" di modal kartu — diisi CS (no. WA, email,
 * alamat, catatan) dan divisi (no. akta, NIB, tanggal pendirian). Tersimpan di
 * Master Card sehingga sama untuk seluruh grup kartu satu pekerjaan.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import ClientDataForm from '../../ClientDataForm';

export default function CardClientPanel({ cardId }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['card-client-data', cardId],
    queryFn: () => api.get(`/work-items/${cardId}/client-data`).then((r) => r.data),
  });
  if (!data) return null;

  const summary = [data.company_name, data.client_phone].filter(Boolean).join(' · ');
  const save = async (body) => {
    try {
      await api.put(`/work-items/${cardId}/client-data`, body);
      toast.success('Data klien disimpan');
      qc.invalidateQueries({ queryKey: ['card-client-data', cardId] });
      qc.invalidateQueries({ queryKey: ['work-item', cardId] });
      qc.invalidateQueries({ queryKey: ['archive-jobs'] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="mb-3 rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))]" data-testid="card-client-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Building2 size={15} className="shrink-0 text-2" />
        <span className="text-[13px] font-bold text-foreground">Data Klien &amp; Perusahaan</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-3">
          {summary || (data.can_edit ? 'Belum diisi — klik untuk mengisi' : 'Belum diisi')}
        </span>
        {open ? <ChevronDown size={15} className="text-3" /> : <ChevronRight size={15} className="text-3" />}
      </button>
      {open && (
        <div className="border-t border-[hsl(var(--hairline))] px-3 py-3">
          <ClientDataForm value={data} canEdit={!!data.can_edit} onSave={save} compact />
        </div>
      )}
    </div>
  );
}
