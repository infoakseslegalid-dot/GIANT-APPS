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
import { api, errMsg, fmtDate } from '../../../lib/api';

const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'));
const parseAmount = (s) => Math.round(Number(String(s).replace(/[^\d]/g, '')));

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
  const [payAmount, setPayAmount] = useState('');
  const [payKind, setPayKind] = useState('dp');
  const [payMethod, setPayMethod] = useState('');
  const [payNote, setPayNote] = useState('');
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

  const afterChange = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['reports-overview'] });
    qc.invalidateQueries({ queryKey: ['card', cardId] });
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
      afterChange();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const deletePayment = async (pid) => {
    if (!window.confirm('Hapus catatan pembayaran ini?')) return;
    try {
      await api.delete(`/payments/${pid}`);
      toast.success('Pembayaran dihapus');
      afterChange();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="mb-3 rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-3 py-2.5 text-[13px]" data-testid="card-finance-panel">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-bold text-foreground">💰 Harga &amp; Pembayaran</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${badge.c}`}>{badge.t}</span>
      </div>

      {/* Harga */}
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="w-[92px] shrink-0 font-semibold text-3">Harga job</span>
        {editingPrice ? (
          <>
            <input
              autoFocus
              inputMode="numeric"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="mis. 4.000.000"
              className="h-8 w-40 rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground"
            />
            <button onClick={savePrice} disabled={busy} className="h-8 px-3 rounded bg-[#0c66e4] text-white text-xs font-bold disabled:opacity-50">Simpan</button>
            <button onClick={() => { setEditingPrice(false); setPriceInput(''); }} className="h-8 px-2 rounded text-2 text-xs">Batal</button>
          </>
        ) : (
          <>
            <span className="font-bold text-foreground text-[15px]">{rp(data.price)}</span>
            {canManage && (
              <button
                data-testid="card-price-edit"
                onClick={() => { setEditingPrice(true); setPriceInput(data.price ? String(data.price) : ''); }}
                className="text-[12px] font-semibold text-[#0C66E4] hover:underline"
              >
                {data.price != null ? 'ubah' : '+ isi harga'}
              </button>
            )}
          </>
        )}
      </div>

      {data.price != null && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 pl-[100px] text-[12px] text-2 mb-1.5">
          <span>Sudah dibayar: <strong className="text-foreground">{rp(data.paid)}</strong></span>
          <span>Sisa: <strong className={data.outstanding > 0 ? 'text-[#C9372C]' : 'text-[#1F845A]'}>{rp(data.outstanding)}</strong></span>
        </div>
      )}

      {/* Daftar pembayaran */}
      {(data.payments || []).length > 0 && (
        <ul className="mt-1 mb-2 space-y-1">
          {data.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-[hsl(var(--hairline))] px-2 py-1 text-[12px]">
              <span className="min-w-0">
                <strong className="text-foreground">{rp(p.amount)}</strong>
                <span className="text-3"> · {p.kind}{p.method ? ` · ${p.method}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
              </span>
              <span className="shrink-0 flex items-center gap-2 text-3">
                {fmtDate(p.paid_at)}
                {canManage && (
                  <button onClick={() => deletePayment(p.id)} className="text-[#C9372C] font-bold hover:underline">hapus</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Form pembayaran */}
      {canManage ? (
        <div className="mt-2 rounded border border-dashed border-[hsl(var(--hairline))] p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              inputMode="numeric"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Nominal masuk (mis. 2.000.000)"
              data-testid="card-payment-amount"
              className="h-8 w-48 rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground"
            />
            <select value={payKind} onChange={(e) => setPayKind(e.target.value)} className="h-8 rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground text-xs">
              <option value="dp">DP</option>
              <option value="pelunasan">Pelunasan</option>
              <option value="full">Bayar penuh</option>
            </select>
            <input
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              placeholder="cara bayar (transfer/tunai)"
              className="h-8 w-40 rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="catatan (opsional)"
              className="h-8 flex-1 rounded border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-2 text-foreground text-xs"
            />
            <button
              onClick={addPayment}
              disabled={busy}
              data-testid="card-payment-submit"
              className="h-8 px-4 rounded bg-[#1F845A] text-white text-xs font-bold disabled:opacity-50"
            >
              + Catat pembayaran
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-3">Hanya PIC job (CS) / supervisor yang bisa mengubah harga &amp; pembayaran.</p>
      )}
    </div>
  );
}
