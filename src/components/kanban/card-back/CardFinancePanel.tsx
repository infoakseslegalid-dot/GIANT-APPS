// @ts-nocheck
'use client';

/**
 * Panel "Harga & Pembayaran" di modal kartu.
 * Menempel harga ke job (MasterCard) + mencatat pembayaran masuk (DP / pelunasan).
 * Hanya tampil aktif untuk PIC job / supervisor / super admin (server yang menegakkan).
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wallet, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, errMsg, fmtDate } from '../../../lib/api';

const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'));
const parseAmount = (s) => Math.round(Number(String(s).replace(/[^\d]/g, '')));
/** Format live saat mengetik nominal uang: "2000000" → "2.000.000". */
const fmtDigits = (s) => {
  const digits = String(s).replace(/[^\d]/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
};

const STATUS_BADGE = {
  lunas: { t: 'LUNAS', c: 'bg-[#DCFFF1] text-[#1F845A]' },
  dp: { t: 'DP (sebagian)', c: 'bg-[#FFF7D6] text-[#B65C02]' },
  belum: { t: 'BELUM BAYAR', c: 'bg-[#FFECEB] text-[#C9372C]' },
  no_price: { t: 'Harga belum diisi', c: 'bg-[hsl(var(--muted))] text-3' },
};

export default function CardFinancePanel({ cardId }) {
  const qc = useQueryClient();
  const [priceInput, setPriceInput] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [payFormOpen, setPayFormOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payKind, setPayKind] = useState('dp');
  const [payMethod, setPayMethod] = useState('');
  const [payNote, setPayNote] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['card-finance', cardId],
    queryFn: () => api.get(`/work-items/${cardId}/finance`).then((r) => r.data),
  });

  if (isLoading || !data) {
    return (
      <div className="mb-3 rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-3 py-2.5 text-[13px] text-3">
        Memuat data harga…
      </div>
    );
  }

  const canManage = !!data.can_manage;
  const status = data.status || 'no_price';
  const badge = STATUS_BADGE[status] || STATUS_BADGE.no_price;
  const paidPct = data.price > 0 ? Math.min(100, Math.round((data.paid / data.price) * 100)) : 0;

  const afterChange = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['reports-overview'] });
    qc.invalidateQueries({ queryKey: ['work-item', cardId] });
  };

  const savePrice = async () => {
    const amount = parseAmount(priceInput);
    if (!Number.isFinite(amount) || amount < 0) return toast.error('Nominal harga tidak valid');
    setBusy(true);
    try {
      await api.post(`/work-items/${cardId}/price`, { amount });
      toast.success('Harga job disimpan');
      setEditingPrice(false);
      setPriceInput('');
      afterChange();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const addPayment = async () => {
    const amount = parseAmount(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal pembayaran tidak valid');
    setBusy(true);
    try {
      const r = await api.post(`/work-items/${cardId}/payments`, {
        amount, kind: payKind, method: payMethod || undefined, note: payNote || undefined,
      });
      toast.success(
        r.data?.status === 'lunas'
          ? `Pembayaran dicatat — job LUNAS${r.data?.pic_name ? ` (atas nama ${r.data.pic_name})` : ''}`
          : 'Pembayaran dicatat',
      );
      setPayAmount(''); setPayMethod(''); setPayNote(''); setPayKind('dp');
      setPayFormOpen(false);
      afterChange();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const deletePayment = async (pid) => {
    try {
      await api.delete(`/payments/${pid}`);
      toast.success('Pembayaran dihapus');
      setConfirmDeleteId(null);
      afterChange();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="mb-3 rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-3 py-2.5 text-[13px]" data-testid="card-finance-panel">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
          <Wallet size={15} /> Harga &amp; Pembayaran
        </span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${badge.c}`}>{badge.t}</span>
      </div>

      {/* Harga */}
      {editingPrice ? (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-3">Rp</span>
          <input
            autoFocus
            inputMode="numeric"
            value={priceInput}
            onChange={(e) => setPriceInput(fmtDigits(e.target.value))}
            placeholder="4.000.000"
            className="h-[34px] w-40 rounded-[6px] border border-[#0c66e4] bg-[hsl(var(--surface))] px-2 text-[14px] font-semibold text-foreground outline-none"
          />
          <button onClick={savePrice} disabled={busy} className="h-[34px] px-3.5 rounded-[6px] bg-[#0c66e4] text-white text-xs font-bold disabled:opacity-50">Simpan</button>
          <button onClick={() => { setEditingPrice(false); setPriceInput(''); }} className="h-[34px] px-2 rounded text-2 text-xs font-semibold">Batal</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-3">Harga job</span>
            <span className="font-bold text-foreground text-[16px]">{rp(data.price)}</span>
            {canManage && (
              <button
                data-testid="card-price-edit"
                onClick={() => { setEditingPrice(true); setPriceInput(data.price ? Number(data.price).toLocaleString('id-ID') : ''); }}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0C66E4] hover:underline"
              >
                <Pencil size={11} /> {data.price != null ? 'Ubah' : 'Isi harga'}
              </button>
            )}
          </div>

          {data.price != null && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))] mb-1.5">
                <div
                  className="h-full rounded-full bg-[#1F845A] transition-[width] duration-300"
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-2 mb-2.5">
                <span>Dibayar <strong className="text-foreground">{rp(data.paid)}</strong></span>
                <span>Sisa <strong className={data.outstanding > 0 ? 'text-[#C9372C]' : 'text-[#1F845A]'}>{rp(data.outstanding)}</strong></span>
              </div>
            </>
          )}
        </>
      )}

      {/* Daftar pembayaran */}
      {(data.payments || []).length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {data.payments.map((p) =>
            confirmDeleteId === p.id ? (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-[7px] border border-[#f8b4ac] bg-[#fff5f4] px-2.5 py-2 text-[12.5px]">
                <span className="font-semibold text-[#8a271f]">Hapus catatan {rp(p.amount)}?</span>
                <span className="flex shrink-0 gap-1.5">
                  <button onClick={() => deletePayment(p.id)} className="h-[26px] rounded-[5px] bg-[#c9372c] px-2.5 text-[11.5px] font-bold text-white">Ya, hapus</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="h-[26px] rounded-[5px] border border-[hsl(var(--hairline))] px-2.5 text-[11.5px] font-semibold text-2">Batal</button>
                </span>
              </li>
            ) : (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-[7px] border border-[hsl(var(--hairline))] px-2.5 py-1.5 text-[12.5px]">
                <span className="min-w-0 flex flex-col">
                  <strong className="text-foreground">{rp(p.amount)}</strong>
                  <span className="text-[11.5px] text-3">{p.kind}{p.method ? ` · ${p.method}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
                </span>
                <span className="shrink-0 flex items-center gap-1 text-3">
                  {fmtDate(p.paid_at)}
                  {canManage && (
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      aria-label="Hapus pembayaran"
                      className="ml-1 rounded-[5px] p-1.5 text-3 hover:bg-[#ffecEB] hover:text-[#c9372c]"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {/* Form pembayaran — disembunyikan sampai diklik, biar panel tidak penuh terus */}
      {canManage ? (
        payFormOpen ? (
          <div className="rounded-[7px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-3">Pembayaran baru</span>
              <button onClick={() => setPayFormOpen(false)} className="rounded p-1 text-3 hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(fmtDigits(e.target.value))}
                placeholder="Rp 0"
                data-testid="card-payment-amount"
                className="h-8 w-32 rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 font-semibold text-foreground"
              />
              <select value={payKind} onChange={(e) => setPayKind(e.target.value)} className="h-8 rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground text-xs">
                <option value="dp">DP</option>
                <option value="pelunasan">Pelunasan</option>
                <option value="full">Bayar penuh</option>
              </select>
              <input
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                placeholder="Cara bayar (transfer/tunai)"
                className="h-8 flex-1 min-w-[140px] rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground text-xs"
              />
            </div>
            <input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Catatan (opsional)"
              className="h-8 w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground text-xs"
            />
            <button
              onClick={addPayment}
              disabled={busy}
              data-testid="card-payment-submit"
              className="h-9 w-full rounded-[6px] bg-[#1F845A] text-white text-xs font-bold disabled:opacity-50"
            >
              Simpan pembayaran
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPayFormOpen(true)}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-[#c1c7d0] text-[12.5px] font-semibold text-2 hover:border-[#0c66e4] hover:text-[#0c66e4]"
          >
            <Plus size={14} /> Catat pembayaran
          </button>
        )
      ) : (
        <p className="text-[11px] text-3">Hanya PIC job (CS) / supervisor yang bisa mengubah harga &amp; pembayaran.</p>
      )}
    </div>
  );
}
