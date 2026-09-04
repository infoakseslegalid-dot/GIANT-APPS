// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────
// REKAP & PERFORMA  (halaman super admin)
//  - Harga job & pembayaran (DP / lunas) per Master Card + rekap "uang masuk".
//  - Performa per user & per divisi: kartu list / doing / done, omzet, # lunas.
//  - Performa harian CS: skor dinaikkan + kartu mandek (berapa hari).
//  - Filter: harian / mingguan / bulanan.
// ─────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { requirePerm } from './permissions';

const prisma = new PrismaClient();
const router = new Hono();

const SUPERVISOR_ROLES = ['super_admin', 'supervisor'];

// ── util periode ─────────────────────────────────────────────────────────
function periodRange(period: string, dateStr?: string) {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  let from: Date, to: Date;
  if (period === 'week') {
    const d = new Date(base);
    const dow = (d.getDay() + 6) % 7; // Senin = 0
    from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    to = new Date(from); to.setDate(from.getDate() + 7);
  } else if (period === 'month') {
    from = new Date(base.getFullYear(), base.getMonth(), 1);
    to = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  } else {
    period = 'day';
    from = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    to = new Date(from); to.setDate(from.getDate() + 1);
  }
  return { from, to, period };
}
const inRange = (d: any, from: Date, to: Date) => {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= from.getTime() && t < to.getTime();
};

// ── klasifikasi kartu: list / doing / done ───────────────────────────────
const DONE_RE = /(^|\b)(FINISH|DONE|SELESAI)(\b|$)/;
const DOING_RE = /(DOING|PROSES|PROGRESS|DIKERJAKAN|ON.?GOING|PENGERJAAN|REVISI)/;
function bucketOf(item: any): 'list' | 'doing' | 'done' {
  const ln = (item.list?.name || '').toUpperCase();
  const done =
    item.status === 'done' || item.workStatus === 'COMPLETED' ||
    DONE_RE.test(ln) || ln.startsWith('SKOR 6') || ln.startsWith('SKOR 7');
  if (done) return 'done';
  if (DOING_RE.test(ln) || item.workStatus === 'IN_PROGRESS' || item.workStatus === 'CLAIMED')
    return 'doing';
  return 'list';
}
const isDoneItem = (i: any) => bucketOf(i) === 'done';

// ── status bayar sebuah MasterCard ──────────────────────────────────────
function payInfo(mc: any) {
  const price = mc.price ?? null;
  const payments = [...(mc.payments || [])].sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
  );
  const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  let status: 'no_price' | 'belum' | 'dp' | 'lunas' = 'no_price';
  if (price != null) {
    if (paid <= 0) status = 'belum';
    else if (paid >= price) status = 'lunas';
    else status = 'dp';
  }
  // pembayaran yang membuat kumulatif pertama kali >= price (jadi "lunas")
  let lunasPayment: any = null;
  if (price != null && paid >= price) {
    let acc = 0;
    for (const p of payments) {
      acc += p.amount || 0;
      if (acc >= price) { lunasPayment = p; break; }
    }
  }
  return { price, paid, outstanding: price != null ? Math.max(price - paid, 0) : null, status, payments, lunasPayment };
}

// ── siapa yang boleh input harga / pembayaran untuk kartu ini ───────────
function canManageFinance(user: any, item: any, mc: any): boolean {
  if (SUPERVISOR_ROLES.includes(user.role)) return true;
  const has = user._perms && user._perms.has('finance.manage');
  if (!has) return false;
  return (
    item.currentPicId === user.id ||
    item.createdById === user.id ||
    (mc && mc.ownerUserId === user.id)
  );
}

// Buat MasterCard jika kartu belum punya (agar harga bisa ditempel ke "job").
async function ensureMC(item: any) {
  if (item.masterCardId) {
    return prisma.masterCard.findUnique({ where: { id: item.masterCardId }, include: { payments: true } });
  }
  const ownerUserId = item.currentPicId || item.createdById || null;
  let ownerDivisionId: string | null = null;
  if (ownerUserId) {
    const u = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { divisionId: true } });
    ownerDivisionId = u?.divisionId || null;
  }
  const mc = await prisma.masterCard.create({
    data: { title: item.title, client: item.clientName || null, ownerUserId, ownerDivisionId },
  });
  await prisma.workItem.update({ where: { id: item.id }, data: { masterCardId: mc.id } });
  return prisma.masterCard.findUnique({ where: { id: mc.id }, include: { payments: true } });
}

// ═══════════════════════════════════════════════════════════════════════
//  HARGA & PEMBAYARAN per kartu
// ═══════════════════════════════════════════════════════════════════════

// Ringkas untuk modal kartu.
router.get('/work-items/:id/finance', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const item = await prisma.workItem.findUnique({ where: { id } });
  if (!item) return c.json({ detail: 'Kartu tidak ditemukan' }, 404);
  const mc = item.masterCardId
    ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId }, include: { payments: true } })
    : null;
  const info = mc ? payInfo(mc) : { price: null, paid: 0, outstanding: null, status: 'no_price', payments: [] };
  const recorderIds = [...new Set(info.payments.map((p: any) => p.recordedById).filter(Boolean))];
  return c.json({
    master_card_id: mc?.id || null,
    price: info.price,
    price_note: mc?.priceNote || null,
    paid: info.paid,
    outstanding: info.outstanding,
    status: info.status, // no_price | belum | dp | lunas
    can_manage: canManageFinance(user, item, mc),
    payments: info.payments.map((p: any) => ({
      id: p.id, amount: p.amount, kind: p.kind, method: p.method || null,
      note: p.note || null, paid_at: p.paidAt, recorded_by_name: p.recordedByName || null,
    })),
  });
});

// Set / ubah harga job.
router.post('/work-items/:id/price', async (c) => {
  await requirePerm(c, 'finance.manage');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const item = await prisma.workItem.findUnique({ where: { id } });
  if (!item) return c.json({ detail: 'Kartu tidak ditemukan' }, 404);
  let mc = item.masterCardId
    ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId }, include: { payments: true } })
    : null;
  if (!canManageFinance(user, item, mc)) {
    return c.json({ detail: 'Hanya PIC job / supervisor yang boleh mengubah harga.' }, 403);
  }
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 0) return c.json({ detail: 'Nominal tidak valid' }, 400);
  if (!mc) mc = await ensureMC(item);
  const updated = await prisma.masterCard.update({
    where: { id: mc.id },
    data: {
      price: amount, priceNote: (body.note || '').trim() || null,
      priceSetById: user.id, priceSetAt: new Date(),
    },
    include: { payments: true },
  });
  return c.json({ ok: true, ...payInfo(updated) });
});

// Catat satu pembayaran masuk.
router.post('/work-items/:id/payments', async (c) => {
  await requirePerm(c, 'finance.manage');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const item = await prisma.workItem.findUnique({ where: { id } });
  if (!item) return c.json({ detail: 'Kartu tidak ditemukan' }, 404);
  let mc = item.masterCardId
    ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId }, include: { payments: true } })
    : null;
  if (!canManageFinance(user, item, mc)) {
    return c.json({ detail: 'Hanya PIC job / supervisor yang boleh mencatat pembayaran.' }, 403);
  }
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return c.json({ detail: 'Nominal pembayaran tidak valid' }, 400);
  if (!mc) mc = await ensureMC(item);

  // Atribusi performa: owner job (CS) → fallback PIC kartu → pembuat.
  const picUserId = mc.ownerUserId || item.currentPicId || item.createdById || null;
  let picDivisionId: string | null = null;
  let picName: string | null = null;
  if (picUserId) {
    const u = await prisma.user.findUnique({ where: { id: picUserId }, select: { divisionId: true, name: true } });
    picDivisionId = u?.divisionId || null;
    picName = u?.name || null;
  }
  const kind = ['dp', 'pelunasan', 'full'].includes(body.kind) ? body.kind : 'dp';
  const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();
  await prisma.payment.create({
    data: {
      masterCardId: mc.id, amount, kind,
      method: (body.method || '').trim() || null,
      note: (body.note || '').trim() || null,
      paidAt,
      picUserId, picDivisionId,
      recordedById: user.id, recordedByName: user.name || null,
    },
  });
  const fresh = await prisma.masterCard.findUnique({ where: { id: mc.id }, include: { payments: true } });
  return c.json({ ok: true, pic_name: picName, ...payInfo(fresh) });
});

// Hapus pembayaran (koreksi) — supervisor / super admin saja.
router.delete('/payments/:pid', async (c) => {
  const user = c.get('user');
  if (!SUPERVISOR_ROLES.includes(user.role)) {
    return c.json({ detail: 'Hanya supervisor / super admin yang boleh menghapus pembayaran.' }, 403);
  }
  const pid = c.req.param('pid');
  await prisma.payment.delete({ where: { id: pid } }).catch(() => {});
  return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════
//  REKAP OVERVIEW
// ═══════════════════════════════════════════════════════════════════════
router.get('/reports/overview', async (c) => {
  await requirePerm(c, 'report.view');
  const period = c.req.query('period') || 'day';
  const date = c.req.query('date') || undefined;
  const { from, to, period: p } = periodRange(period, date);

  const [users, divisions, items, mcs, activities] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, divisionId: true, role: true } }),
    prisma.division.findMany({ select: { id: true, key: true, name: true } }),
    prisma.workItem.findMany({
      where: { archived: false },
      select: {
        id: true, title: true, status: true, workStatus: true, completedAt: true,
        currentPicId: true, createdById: true, boardId: true,
        list: { select: { name: true } },
        board: { select: { divisionId: true } },
      },
    }),
    prisma.masterCard.findMany({
      where: { price: { not: null } },
      include: { payments: true },
    }),
    prisma.activity.findMany({
      where: { createdAt: { gte: from, lt: to }, action: { startsWith: 'memindahkan' } },
      select: { userId: true, action: true, createdAt: true, boardId: true },
    }),
  ]);

  const divById: Record<string, any> = Object.fromEntries(divisions.map((d) => [d.id, d]));
  const csDivIds = new Set(divisions.filter((d) => d.key === 'cs').map((d) => d.id));

  // ---- per user: init ----
  const U: Record<string, any> = {};
  for (const u of users) {
    U[u.id] = {
      user_id: u.id, name: u.name, role: u.role,
      division_id: u.divisionId || null,
      division_key: u.divisionId ? divById[u.divisionId]?.key || null : null,
      division_name: u.divisionId ? divById[u.divisionId]?.name || null : null,
      cards_total: 0, list: 0, doing: 0, done_now: 0,
      done_period: 0, revenue_period: 0, lunas_period: 0,
    };
  }
  const bumpUser = (uid: string) => {
    if (uid && !U[uid]) U[uid] = { user_id: uid, name: '(user nonaktif)', role: null, division_id: null, division_key: null, division_name: null, cards_total: 0, list: 0, doing: 0, done_now: 0, done_period: 0, revenue_period: 0, lunas_period: 0 };
    return U[uid];
  };

  // ---- snapshot buckets (kartu "milik" = PIC, fallback pembuat) ----
  for (const it of items) {
    const uid = it.currentPicId || it.createdById;
    const row = bumpUser(uid);
    if (!row) continue;
    row.cards_total += 1;
    row[bucketOf(it) === 'done' ? 'done_now' : bucketOf(it)] += 1;
    if (inRange(it.completedAt, from, to) && isDoneItem(it)) row.done_period += 1;
  }

  // ---- keuangan ----
  let total_in = 0;
  let total_piutang = 0;
  let piutang_cards = 0;
  let count_lunas_period = 0;
  let count_dp = 0, count_belum = 0, count_lunas_total = 0;
  const byDayMap: Record<string, number> = {};
  for (const mc of mcs) {
    const info = payInfo(mc);
    if (info.status === 'lunas') count_lunas_total += 1;
    else if (info.status === 'dp') count_dp += 1;
    else if (info.status === 'belum') count_belum += 1;

    if (info.outstanding && info.outstanding > 0) {
      total_piutang += info.outstanding;
      piutang_cards += 1;
    }

    for (const pay of info.payments) {
      if (!inRange(pay.paidAt, from, to)) continue;
      total_in += pay.amount || 0;
      const dk = new Date(pay.paidAt).toISOString().slice(0, 10);
      byDayMap[dk] = (byDayMap[dk] || 0) + (pay.amount || 0);
      const uid = pay.picUserId || mc.ownerUserId;
      const row = uid ? bumpUser(uid) : null;
      if (row) row.revenue_period += pay.amount || 0;
    }
    if (info.lunasPayment && inRange(info.lunasPayment.paidAt, from, to)) {
      count_lunas_period += 1;
      const uid = info.lunasPayment.picUserId || mc.ownerUserId;
      const row = uid ? bumpUser(uid) : null;
      if (row) row.lunas_period += 1;
    }
  }
  const by_day = Object.entries(byDayMap).sort().map(([d, amount]) => ({ date: d, amount }));

  // ---- per divisi ----
  const D: Record<string, any> = {};
  for (const d of divisions) {
    D[d.id] = {
      division_id: d.id, key: d.key, name: d.name,
      users: 0, cards_total: 0, list: 0, doing: 0, done_now: 0,
      done_period: 0, revenue_period: 0, lunas_period: 0,
    };
  }
  const NO_DIV = { division_id: null, key: null, name: '(tanpa divisi)', users: 0, cards_total: 0, list: 0, doing: 0, done_now: 0, done_period: 0, revenue_period: 0, lunas_period: 0 };
  for (const row of Object.values(U) as any[]) {
    const bucket = row.division_id && D[row.division_id] ? D[row.division_id] : NO_DIV;
    bucket.users += 1;
    for (const k of ['cards_total', 'list', 'doing', 'done_now', 'done_period', 'revenue_period', 'lunas_period']) bucket[k] += row[k];
  }

  // ---- CS harian: skor dinaikkan + kartu mandek ----
  const csUserIds = new Set(users.filter((u) => u.divisionId && csDivIds.has(u.divisionId)).map((u) => u.id));
  const csBoards = await prisma.board.findMany({ where: { divisionId: { in: [...csDivIds] } }, select: { id: true } });
  const csBoardIds = new Set(csBoards.map((b) => b.id));

  const skorUp: Record<string, number> = {};
  const SKOR_MOVE = /dari "SKOR\s*(\d)[^"]*" ke "SKOR\s*(\d)[^"]*"/i;
  for (const a of activities) {
    if (!a.boardId || !csBoardIds.has(a.boardId)) continue;
    const m = String(a.action).match(SKOR_MOVE);
    if (!m) continue;
    if (parseInt(m[2], 10) > parseInt(m[1], 10)) skorUp[a.userId] = (skorUp[a.userId] || 0) + 1;
  }

  // kartu CS yang belum selesai & lama tidak pindah list
  const csCards = await prisma.workItem.findMany({
    where: { archived: false, boardId: { in: [...csBoardIds] }, targetDivisionId: null },
    select: {
      id: true, title: true, clientName: true, currentPicId: true, createdAt: true, updatedAt: true,
      list: { select: { name: true } },
    },
  });
  const lastMove: Record<string, Date> = {};
  const moveActs = await prisma.activity.findMany({
    where: { action: { startsWith: 'memindahkan' }, workItemId: { in: csCards.map((x) => x.id) } },
    select: { workItemId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  for (const m of moveActs) if (!lastMove[m.workItemId]) lastMove[m.workItemId] = m.createdAt;

  const now = Date.now();
  const STUCK_DAYS = 3;
  const stuck: any[] = [];
  for (const cc of csCards) {
    const ln = (cc.list?.name || '').toUpperCase();
    if (!/SKOR\s*[1-5]\b/.test(ln)) continue; // hanya SKOR 1-5 (belum finish)
    const ref = lastMove[cc.id] || cc.createdAt;
    const days = Math.floor((now - new Date(ref).getTime()) / 86400000);
    if (days < STUCK_DAYS) continue;
    const picRow = cc.currentPicId ? U[cc.currentPicId] : null;
    stuck.push({
      id: cc.id, title: cc.title, client: cc.clientName || null,
      list_name: cc.list?.name || null, days,
      pic_id: cc.currentPicId || null, pic_name: picRow?.name || null,
    });
  }
  stuck.sort((a, b) => b.days - a.days);

  const cs_daily = users
    .filter((u) => csUserIds.has(u.id))
    .map((u) => ({
      user_id: u.id, name: u.name,
      skor_up: skorUp[u.id] || 0,
      stuck_count: stuck.filter((s) => s.pic_id === u.id).length,
    }))
    .sort((a, b) => b.skor_up - a.skor_up);

  return c.json({
    range: { from, to, period: p, date: date || new Date().toISOString().slice(0, 10) },
    finance: {
      total_in,
      count_lunas_period,
      count_lunas_total, count_dp, count_belum, total_piutang, piutang_cards,
      by_day,
    },
    by_user: (Object.values(U) as any[])
      .filter((r) => r.cards_total > 0 || r.revenue_period > 0 || r.done_period > 0)
      .sort((a, b) => b.revenue_period - a.revenue_period || b.done_period - a.done_period || b.cards_total - a.cards_total),
    by_division: [...(Object.values(D) as any[]), ...(NO_DIV.users ? [NO_DIV] : [])]
      .filter((d) => d.users > 0)
      .sort((a, b) => b.revenue_period - a.revenue_period || b.done_period - a.done_period),
    cs: { skor_stuck_threshold_days: STUCK_DAYS, daily: cs_daily, stuck },
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  DETAIL SATU USER
// ═══════════════════════════════════════════════════════════════════════
router.get('/reports/user/:userId', async (c) => {
  await requirePerm(c, 'report.view');
  const userId = c.req.param('userId');
  const period = c.req.query('period') || 'day';
  const { from, to, period: p } = periodRange(period, c.req.query('date') || undefined);

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, division: { select: { key: true, name: true } } },
  });
  if (!u) return c.json({ detail: 'User tidak ditemukan' }, 404);

  const items = await prisma.workItem.findMany({
    where: { archived: false, OR: [{ currentPicId: userId }, { createdById: userId }] },
    select: {
      id: true, title: true, clientName: true, status: true, workStatus: true, completedAt: true, createdAt: true,
      masterCardId: true, currentPicId: true,
      list: { select: { name: true } },
      board: { select: { name: true, division: { select: { name: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const mcIds = [...new Set(items.map((i) => i.masterCardId).filter(Boolean))] as string[];
  const mcs = mcIds.length
    ? await prisma.masterCard.findMany({ where: { id: { in: mcIds } }, include: { payments: true } })
    : [];
  const mcById: Record<string, any> = Object.fromEntries(mcs.map((m) => [m.id, m]));

  const cards = items.map((it) => {
    const mc = it.masterCardId ? mcById[it.masterCardId] : null;
    const info = mc ? payInfo(mc) : null;
    return {
      id: it.id, title: it.title, client: it.clientName || null,
      board_name: it.board?.name || null,
      division_name: it.board?.division?.name || null,
      bucket: bucketOf(it),
      list_name: it.list?.name || null,
      is_done: isDoneItem(it),
      completed_at: it.completedAt || null, created_at: it.createdAt,
      done_in_period: inRange(it.completedAt, from, to) && isDoneItem(it),
      price: info?.price ?? null,
      paid: info?.paid ?? 0,
      pay_status: info?.status ?? 'no_price',
    };
  });

  const payments = await prisma.payment.findMany({
    where: { picUserId: userId, paidAt: { gte: from, lt: to } },
    include: { masterCard: { select: { title: true, client: true, price: true } } },
    orderBy: { paidAt: 'desc' },
  });

  return c.json({
    user: { id: u.id, name: u.name, role: u.role, division: u.division?.name || null },
    range: { from, to, period: p },
    summary: {
      cards_total: cards.length,
      list: cards.filter((x) => x.bucket === 'list').length,
      doing: cards.filter((x) => x.bucket === 'doing').length,
      done_now: cards.filter((x) => x.bucket === 'done').length,
      done_period: cards.filter((x) => x.done_in_period).length,
      revenue_period: payments.reduce((s, x) => s + (x.amount || 0), 0),
    },
    cards,
    payments: payments.map((x) => ({
      id: x.id, amount: x.amount, kind: x.kind, method: x.method || null,
      note: x.note || null, paid_at: x.paidAt,
      job_title: x.masterCard?.title || null, job_client: x.masterCard?.client || null,
      job_price: x.masterCard?.price ?? null,
    })),
  });
});

export default router;
