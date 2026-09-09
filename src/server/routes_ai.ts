// @ts-nocheck
/**
 * Asisten AI "Tanya AI" — dua permukaan:
 *
 *  1. POST /api/ai/chat — panel geser cepat (board / kartu), TIDAK tersimpan.
 *  2. /api/ai/conversations/* — halaman /ai: chat penuh, tag entitas (board,
 *     kartu, lampiran, user), riwayat tersimpan di DB (AiConversation / AiMessage).
 *
 * Provider bisa dipilih lewat env AI_PROVIDER:
 *  - "groq"      (default) → console.groq.com, gratis, kompatibel-OpenAI.
 *                 PDF diekstrak jadi teks di server (pdf-parse). Butuh GROQ_API_KEY.
 *  - "anthropic" → Claude (bayar per token). Baca PDF & gambar native. Butuh ANTHROPIC_API_KEY.
 * Model default per-provider bisa dioverride lewat AI_MODEL.
 *
 * Akses: requirePerm('ai.use') + canViewBoard() dicek PER entitas yang dirujuk,
 * jadi user tidak bisa "menembus" board yang tak boleh dilihatnya lewat AI.
 */
import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';
import { PDFParse } from 'pdf-parse';
import { db, getBoard, canViewBoard, getWorkItem, ROLE_LABELS } from './deps';
import { requirePerm, can } from './permissions';
import { getObject } from './storage';

const aiRouter = new Hono();

const PROVIDER = () => (process.env.AI_PROVIDER || 'groq').trim().toLowerCase();
// NB: daftar model Groq berubah-ubah — cek https://console.groq.com/docs/models.
// gpt-oss-120b: 131k context, kualitas bagus, GRATIS. Model teks saja (tanpa vision).
const DEFAULT_MODEL = { groq: 'openai/gpt-oss-120b', anthropic: 'claude-sonnet-5' };
const MODEL = () => (process.env.AI_MODEL || '').trim() || DEFAULT_MODEL[PROVIDER()] || DEFAULT_MODEL.groq;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MAX_ATTACH_MB = () => {
  const n = parseFloat(process.env.AI_MAX_ATTACH_MB || '10');
  return Number.isFinite(n) && n > 0 ? n : 10;
};
const MAX_ATTACH_FILES = 5;
const CTX_CHAR_LIMIT = 40_000;
const TEXT_FILE_CHAR_LIMIT = 20_000;

function aiConfigured() {
  return PROVIDER() === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY : !!process.env.GROQ_API_KEY;
}
function aiNotConfiguredMsg() {
  return PROVIDER() === 'anthropic'
    ? 'Asisten AI belum dikonfigurasi: ANTHROPIC_API_KEY kosong di server.'
    : 'Asisten AI belum dikonfigurasi: GROQ_API_KEY kosong di server (AI_PROVIDER=groq).';
}

const SYSTEM_PROMPT = [
  'Kamu adalah asisten di dalam aplikasi manajemen pekerjaan bergaya Trello (kanban) milik sebuah kantor jasa legal/perizinan.',
  'Kamu menerima satu blok KONTEKS berisi isi board atau kartu yang sedang dibuka user (list, kartu, label, tanggal, PIC, checklist, komentar, dan kadang isi lampiran).',
  'Jawab HANYA berdasarkan KONTEKS dan lampiran yang diberikan. Kalau informasinya tidak ada di konteks, katakan terus terang bahwa datanya tidak tersedia — jangan mengarang.',
  'Jawab ringkas, langsung ke inti, dalam Bahasa Indonesia. Gunakan poin-poin bila membantu. Sebutkan nama kartu/list/orang persis seperti di konteks.',
  'Kamu hanya membaca; kamu tidak bisa mengubah kartu. Kalau user minta perubahan, jelaskan langkahnya secara singkat.',
].join(' ');

function priorityLabel(p) {
  return ({ none: '-', low: 'rendah', medium: 'sedang', high: 'tinggi', urgent: 'URGENT' }[p] || p || '-');
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + `… [dipotong, total ${s.length} karakter]` : s;
}

function parseChecklists(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function renderChecklists(raw) {
  const cls = parseChecklists(raw);
  if (!cls.length) return '';
  const lines = [];
  for (const cl of cls) {
    lines.push(`  Checklist "${cl.title || cl.name || 'Checklist'}":`);
    const items = cl.items || cl.tasks || [];
    for (const it of items) {
      const done = it.checked || it.done || it.completed;
      lines.push(`    [${done ? 'x' : ' '}] ${it.text || it.title || it.name || ''}`);
    }
  }
  return lines.join('\n');
}

// ── Konteks BOARD ───────────────────────────────────────────────────────
async function buildBoardContext(boardId) {
  const board = await db.board.findUnique({ where: { id: boardId }, include: { division: true } });
  const lists = await db.list.findMany({
    where: { boardId, archived: false },
    orderBy: { position: 'asc' },
  });
  const cards = await db.workItem.findMany({
    where: {
      AND: [
        { OR: [{ boardId }, { mirrorBoards: { some: { boardId } } }] },
        { archived: false },
        // Assignment Bank Data yang belum di-claim tidak tampil di board sungguhan.
        {
          OR: [
            { targetDivisionId: null },
            { currentPicId: { not: null } },
            { distributionStatus: { not: 'AVAILABLE' } },
          ],
        },
      ],
    },
    include: { labels: { include: { label: true } }, members: true },
    orderBy: { position: 'asc' },
    take: 500,
  });

  const userIds = [...new Set(cards.flatMap((c) => c.members.map((m) => m.userId)))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  const byList = new Map();
  for (const c of cards) {
    if (!byList.has(c.listId)) byList.set(c.listId, []);
    byList.get(c.listId).push(c);
  }

  const out = [];
  out.push(`BOARD: ${board?.name || boardId}${board?.division?.name ? ` (divisi ${board.division.name})` : ''}`);
  out.push(`Jumlah list: ${lists.length}, jumlah kartu aktif: ${cards.length}`);
  out.push('');

  for (const l of lists) {
    const cs = byList.get(l.id) || [];
    out.push(`LIST: ${l.name} — ${cs.length} kartu`);
    for (const c of cs) {
      const labels = c.labels.map((x) => x.label?.name).filter(Boolean).join(', ');
      const pics = c.members.map((m) => nameOf.get(m.userId)).filter(Boolean).join(', ');
      const bits = [
        `- [${priorityLabel(c.priority)}] ${c.title}`,
        c.clientName ? `klien: ${c.clientName}` : null,
        c.dueDate ? `deadline: ${c.dueDate}` : null,
        c.startDate ? `mulai: ${c.startDate}` : null,
        labels ? `label: ${labels}` : null,
        pics ? `PIC: ${pics}` : null,
        c.status && c.status !== 'active' ? `status: ${c.status}` : null,
        c.workStatus ? `progress: ${c.workStatus}` : null,
        c.description ? `catatan: ${truncate(c.description, 200)}` : null,
      ].filter(Boolean);
      out.push('  ' + bits.join(' · '));
    }
    out.push('');
  }

  return truncate(out.join('\n'), CTX_CHAR_LIMIT);
}

// ── Konteks KARTU ───────────────────────────────────────────────────────
async function buildCardContext(item, opts) {
  const includeFinance = opts.includeFinance;

  // Judul / deskripsi / checklist kanonik: kalau ini assignment, ambil dari
  // Master Card rep (targetDivisionId null) supaya sama seperti tampilan kartu.
  let host = item;
  if (item.masterCardId) {
    const rep = await db.workItem.findFirst({
      where: { masterCardId: item.masterCardId, targetDivisionId: null },
    });
    if (rep) host = rep;
  }

  const board = await db.board.findUnique({ where: { id: item.boardId }, include: { division: true } });
  const list = await db.list.findUnique({ where: { id: item.listId } });

  const groupIds = item.masterCardId
    ? (await db.workItem.findMany({ where: { masterCardId: item.masterCardId }, select: { id: true } })).map((x) => x.id)
    : [item.id];

  const comments = await db.comment.findMany({
    where: { workItemId: { in: groupIds } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  const activities = await db.activity.findMany({
    where: { workItemId: { in: groupIds } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  const labels = await db.workItemLabel.findMany({
    where: { workItemId: item.id },
    include: { label: true },
  });
  const members = await db.workItemMember.findMany({ where: { workItemId: item.id } });
  const memberUsers = members.length
    ? await db.user.findMany({ where: { id: { in: members.map((m) => m.userId) } }, select: { id: true, name: true } })
    : [];
  const pic = item.currentPicId
    ? await db.user.findUnique({ where: { id: item.currentPicId }, select: { name: true } })
    : null;

  let master = null;
  if (includeFinance && item.masterCardId) {
    master = await db.masterCard.findUnique({ where: { id: item.masterCardId } });
  }

  const out = [];
  out.push(`KARTU: ${host.title}`);
  if (host.clientName) out.push(`Klien: ${host.clientName}`);
  out.push(`Board: ${board?.name || item.boardId}${board?.division?.name ? ` (divisi ${board.division.name})` : ''}`);
  out.push(`List saat ini: ${list?.name || '-'}`);
  out.push(`Prioritas: ${priorityLabel(item.priority)}`);
  out.push(`Status: ${item.status}${item.workStatus ? ` / ${item.workStatus}` : ''}${item.distributionStatus ? ` / ${item.distributionStatus}` : ''}`);
  if (item.startDate) out.push(`Tanggal mulai: ${item.startDate}`);
  if (item.dueDate) out.push(`Deadline: ${item.dueDate}`);
  if (labels.length) out.push(`Label: ${labels.map((l) => l.label?.name).filter(Boolean).join(', ')}`);
  if (memberUsers.length) out.push(`Anggota: ${memberUsers.map((u) => u.name).join(', ')}`);
  if (pic?.name) out.push(`PIC: ${pic.name}`);
  if (item.hariStage) out.push(`Tahap HARI: ${item.hariStage}`);
  if (master && (master.price != null)) {
    out.push(`Harga job: Rp ${Number(master.price).toLocaleString('id-ID')}${master.priceNote ? ` (${master.priceNote})` : ''}`);
  }
  out.push('');
  out.push('DESKRIPSI:');
  out.push(host.description ? truncate(host.description, 8000) : '(kosong)');

  const clText = renderChecklists(host.checklists);
  if (clText) {
    out.push('');
    out.push('CHECKLIST:');
    out.push(clText);
  }

  if (comments.length) {
    out.push('');
    out.push(`KOMENTAR (${comments.length}, urut lama → baru):`);
    for (const c of comments) {
      out.push(`- ${c.createdByName || 'user'} (${new Date(c.createdAt).toISOString().slice(0, 10)}): ${truncate(c.text, 1000)}`);
    }
  }

  if (activities.length) {
    out.push('');
    out.push(`AKTIVITAS TERAKHIR (${activities.length}, urut baru → lama):`);
    for (const a of activities) {
      out.push(`- ${a.userName || 'user'} ${a.action} (${new Date(a.createdAt).toISOString().slice(0, 10)})`);
    }
  }

  return truncate(out.join('\n'), CTX_CHAR_LIMIT);
}

// ── Lampiran → content blocks ───────────────────────────────────────────
const IMG_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const TEXTy = (ct, name) =>
  /^text\//.test(ct) ||
  ct === 'application/json' ||
  /\.(md|markdown|csv|txt|json|log|yaml|yml)$/i.test(name || '');

// Konversi satu Attachment → "media parts" NETRAL (provider-agnostik).
// part: { kind:'text', text } | { kind:'image', mime, b64, name } | { kind:'pdf', b64, name }
// `budget` = { used, max } byte, di-mutate lintas pemanggilan.
async function attachmentToParts(a, budget) {
  if (a.contentType === 'link' || !a.storagePath) return { parts: [], skip: 'tautan, bukan file' };
  const ct = (a.contentType || '').toLowerCase();
  const isPdf = ct === 'application/pdf';
  const isImg = IMG_TYPES.has(ct);
  const isText = TEXTy(ct, a.originalFilename);
  if (!isPdf && !isImg && !isText) return { parts: [], skip: `tipe ${a.contentType || '?'} belum didukung` };

  let data;
  try { ({ data } = await getObject(a.storagePath)); }
  catch { return { parts: [], skip: 'gagal dibaca dari storage' }; }
  if (budget.used + data.length > budget.max) return { parts: [], skip: `total lampiran > ${Math.floor(budget.max / 1048576)} MB` };
  budget.used += data.length;

  if (isText) {
    return { parts: [{ kind: 'text', text: `--- Lampiran (teks): ${a.originalFilename} ---\n${truncate(data.toString('utf8'), TEXT_FILE_CHAR_LIMIT)}` }] };
  }
  if (isPdf) {
    return { parts: [{ kind: 'pdf', name: a.originalFilename, b64: data.toString('base64') }] };
  }
  return { parts: [{ kind: 'image', name: a.originalFilename, mime: ct === 'image/jpg' ? 'image/jpeg' : ct, b64: data.toString('base64') }] };
}

// Semua lampiran (non-hapus) milik satu kartu / grup Master Card — dipakai panel cepat.
async function buildAttachmentParts(itemId, masterCardId) {
  const scopeIds = masterCardId
    ? (await db.workItem.findMany({ where: { masterCardId }, select: { id: true } })).map((x) => x.id)
    : [itemId];
  const atts = await db.attachment.findMany({
    where: { workItemId: { in: scopeIds }, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });

  const parts = [];
  const skipped = [];
  const budget = { used: 0, max: MAX_ATTACH_MB() * 1024 * 1024 };
  let count = 0;
  for (const a of atts) {
    if (count >= MAX_ATTACH_FILES) { skipped.push(`${a.originalFilename} (batas ${MAX_ATTACH_FILES} file)`); continue; }
    const r = await attachmentToParts(a, budget);
    if (r.skip) { skipped.push(`${a.originalFilename} (${r.skip})`); continue; }
    parts.push(...r.parts);
    count++;
  }
  return { parts, skipped };
}

// ── Ekstraksi teks PDF (dipakai saat provider = groq; Claude baca PDF native) ──
async function pdfToText(b64) {
  try {
    const parser = new PDFParse({ data: Buffer.from(b64, 'base64') });
    const res = await parser.getText();
    return (res?.text || '').trim();
  } catch (e) {
    console.error('[ai] pdfToText gagal:', e?.message);
    return '';
  }
}

// ── Konteks USER ───────────────────────────────────────────────────────
async function buildUserContext(target, requester) {
  const div = target.divisionId ? await db.division.findUnique({ where: { id: target.divisionId } }) : null;
  const out = [];
  out.push(`USER: ${target.name}`);
  out.push(`Peran: ${ROLE_LABELS[target.role] || target.role}`);
  out.push(`Divisi: ${div?.name || '-'}`);
  out.push(`Status akun: ${target.isActive ? 'aktif' : 'nonaktif'}`);

  if (!(await can(requester, 'report.view'))) {
    out.push('(Ringkasan pekerjaan user ini tidak ditampilkan — perlu izin "Rekap & Performa" / report.view.)');
    return out.join('\n');
  }

  const cards = await db.workItem.findMany({
    where: {
      archived: false,
      OR: [
        { currentPicId: target.id },
        { createdById: target.id },
        { members: { some: { userId: target.id } } },
      ],
    },
    include: { board: true, list: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  out.push('');
  out.push(`PEKERJAAN ${target.name} (${cards.length}${cards.length === 100 ? '+' : ''} kartu aktif, lintas board):`);
  for (const w of cards) {
    const bits = [
      `- ${w.title}`,
      `board: ${w.board?.name || '-'}`,
      `list: ${w.list?.name || '-'}`,
      `status: ${w.status}${w.workStatus ? '/' + w.workStatus : ''}`,
      w.dueDate ? `due: ${w.dueDate}` : null,
      w.currentPicId === target.id ? 'PIC' : null,
    ].filter(Boolean);
    out.push('  ' + bits.join(' · '));
  }
  return truncate(out.join('\n'), CTX_CHAR_LIMIT);
}

// ── Resolusi ref yang di-tag user → gabungan konteks + blok lampiran ────
const REF_TYPES = new Set(['board', 'card', 'attachment', 'user']);

async function resolveRefs(refs, user) {
  const sections = [];
  const mediaParts = [];
  const skipped = [];
  const resolved = [];
  const budget = { used: 0, max: MAX_ATTACH_MB() * 1024 * 1024 };
  let fileCount = 0;

  for (const ref of (refs || []).slice(0, 8)) {
    const type = ref?.type;
    const id = String(ref?.id || '');
    if (!REF_TYPES.has(type) || !id) { skipped.push({ type: type || '?', id, reason: 'ref tidak valid' }); continue; }
    try {
      if (type === 'board') {
        const board = await db.board.findUnique({ where: { id }, include: { members: true, division: true } });
        if (!board) { skipped.push({ type, id, reason: 'board tidak ditemukan' }); continue; }
        if (!canViewBoard(user, board)) { skipped.push({ type, id, label: board.name, reason: 'tanpa akses' }); continue; }
        sections.push(`=== BOARD: ${board.name} ===\n${await buildBoardContext(id)}`);
        resolved.push({ type, id, label: board.name });
      } else if (type === 'card') {
        const item = await db.workItem.findUnique({ where: { id } });
        if (!item) { skipped.push({ type, id, reason: 'kartu tidak ditemukan' }); continue; }
        const board = await db.board.findUnique({ where: { id: item.boardId }, include: { members: true, division: true } });
        if (!board || !canViewBoard(user, board)) { skipped.push({ type, id, label: item.title, reason: 'tanpa akses' }); continue; }
        const includeFinance = await can(user, 'report.view');
        sections.push(`=== KARTU: ${item.title} ===\n${await buildCardContext(item, { includeFinance })}`);
        resolved.push({ type, id, label: item.title });
      } else if (type === 'attachment') {
        const att = await db.attachment.findUnique({ where: { id }, include: { workItem: true } });
        if (!att || att.isDeleted || !att.workItem) { skipped.push({ type, id, reason: 'lampiran tidak ditemukan' }); continue; }
        const board = await db.board.findUnique({ where: { id: att.workItem.boardId }, include: { members: true, division: true } });
        if (!board || !canViewBoard(user, board)) { skipped.push({ type, id, label: att.originalFilename, reason: 'tanpa akses' }); continue; }
        if (fileCount >= MAX_ATTACH_FILES) { skipped.push({ type, id, label: att.originalFilename, reason: `batas ${MAX_ATTACH_FILES} file` }); continue; }
        const r = await attachmentToParts(att, budget);
        if (r.skip) { skipped.push({ type, id, label: att.originalFilename, reason: r.skip }); continue; }
        mediaParts.push({ kind: 'text', text: `(Lampiran "${att.originalFilename}" dari kartu "${att.workItem.title}")` }, ...r.parts);
        fileCount++;
        resolved.push({ type, id, label: att.originalFilename });
      } else if (type === 'user') {
        const target = await db.user.findUnique({ where: { id } });
        if (!target) { skipped.push({ type, id, reason: 'user tidak ditemukan' }); continue; }
        sections.push(`=== USER: ${target.name} ===\n${await buildUserContext(target, user)}`);
        resolved.push({ type, id, label: target.name });
      }
    } catch (e) {
      console.error('[ai] resolveRefs', type, id, e?.message);
      skipped.push({ type, id, reason: 'gagal dibaca' });
    }
  }

  const contextText = sections.length
    ? sections.join('\n\n')
    : '(Tidak ada entitas yang di-tag, atau semuanya tidak bisa diakses.)';
  return { contextText, mediaParts, skipped, resolved };
}

// ══ Panggilan LLM — provider-agnostik ═════════════════════════════════
// Input: contextText (string), mediaParts (netral), history [{role,content}].
// "media parts" netral: {kind:'text'|'image'|'pdf', ...}

class LLMError extends Error {
  constructor(status, detail) { super(detail); this.status = status; this.detail = detail; }
}

// Netral → blok konten Anthropic.
function partsToAnthropic(parts) {
  const out = [];
  for (const p of parts) {
    if (p.kind === 'text') out.push({ type: 'text', text: p.text });
    else if (p.kind === 'image') out.push({ type: 'image', source: { type: 'base64', media_type: p.mime, data: p.b64 } });
    else if (p.kind === 'pdf') {
      out.push({ type: 'text', text: `--- Lampiran (PDF): ${p.name} ---` });
      out.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.b64 } });
    }
  }
  return out;
}

// Netral → konten pesan OpenAI/Groq. PDF diekstrak jadi teks di sini.
// Model Groq gratis (gpt-oss / qwen) TIDAK punya vision → gambar jadi catatan teks.
async function partsToOpenAI(parts) {
  const out = [];
  for (const p of parts) {
    if (p.kind === 'text') {
      out.push({ type: 'text', text: p.text });
    } else if (p.kind === 'image') {
      out.push({ type: 'text', text: `--- Lampiran (gambar): ${p.name} — tidak bisa dibaca oleh model Groq (tidak mendukung gambar). Ganti AI_PROVIDER=anthropic untuk membaca gambar. ---` });
    } else if (p.kind === 'pdf') {
      const text = await pdfToText(p.b64);
      out.push({
        type: 'text',
        text: text
          ? `--- Lampiran (PDF, teks diekstrak): ${p.name} ---\n${truncate(text, TEXT_FILE_CHAR_LIMIT)}`
          : `--- Lampiran (PDF): ${p.name} — teks tidak bisa diekstrak (kemungkinan hasil scan/gambar). ---`,
      });
    }
  }
  return out;
}

async function runAnthropic({ contextText, mediaParts, history }) {
  const client = new Anthropic();
  const firstUser = [{ type: 'text', text: `KONTEKS:\n${contextText}` }, ...partsToAnthropic(mediaParts)];
  const messages = [
    { role: 'user', content: firstUser },
    { role: 'assistant', content: 'Konteks diterima. Silakan ajukan pertanyaan.' },
    ...history,
  ];
  let resp;
  try {
    resp = await client.messages.create({ model: MODEL(), max_tokens: 4000, system: SYSTEM_PROMPT, messages });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new LLMError(502, 'ANTHROPIC_API_KEY ditolak (401). Periksa kunci di server.');
    if (e instanceof Anthropic.RateLimitError) throw new LLMError(429, 'Kena rate limit dari Claude. Coba lagi sebentar.');
    if (e instanceof Anthropic.APIError) throw new LLMError(502, `Claude error ${e.status || ''}: ${e.message}`);
    throw new LLMError(502, 'Gagal memanggil Claude.');
  }
  const reply = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return { reply: reply || '(tidak ada jawaban)', usage: resp.usage || null, model: resp.model || MODEL() };
}

async function runGroq({ contextText, mediaParts, history }) {
  const firstUser = [{ type: 'text', text: `KONTEKS:\n${contextText}` }, ...(await partsToOpenAI(mediaParts))];
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: firstUser },
    { role: 'assistant', content: 'Konteks diterima. Silakan ajukan pertanyaan.' },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL(), messages, max_tokens: 4000, temperature: 0.3 }),
    });
  } catch (e) {
    throw new LLMError(502, `Gagal menghubungi Groq: ${e?.message || e}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new LLMError(502, 'GROQ_API_KEY ditolak (401). Periksa kunci di server.');
    if (res.status === 429) throw new LLMError(429, 'Kena rate limit Groq (tier gratis). Coba lagi sebentar.');
    if (res.status === 413 || /too large|context/i.test(body)) throw new LLMError(502, 'Konteks kelewat besar untuk model Groq ini. Kurangi entitas/lampiran yang di-tag.');
    throw new LLMError(502, `Groq error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const reply = (data?.choices?.[0]?.message?.content || '').trim();
  return { reply: reply || '(tidak ada jawaban)', usage: data?.usage || null, model: data?.model || MODEL() };
}

async function runLLM(input) {
  return PROVIDER() === 'anthropic' ? runAnthropic(input) : runGroq(input);
}

function llmErrorResponse(c, e) {
  if (e instanceof LLMError) {
    console.error('[ai] LLM gagal:', e.status, e.detail);
    return c.json({ detail: e.detail }, e.status || 502);
  }
  console.error('[ai] LLM gagal (tak terduga):', e?.message);
  return c.json({ detail: 'Gagal memanggil asisten AI.' }, 502);
}

// ── POST /api/ai/chat — panel geser cepat (ephemeral) ──────────────────
aiRouter.post('/ai/chat', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  if (!aiConfigured()) {
    return c.json({ detail: aiNotConfiguredMsg() }, 501);
  }

  let body;
  try { body = await c.req.json(); }
  catch { return c.json({ detail: 'Body JSON tidak valid.' }, 400); }

  const scope = body.scope === 'card' ? 'card' : 'board';
  const history = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }))
    : [];
  if (!history.length || history[history.length - 1].role !== 'user') {
    return c.json({ detail: 'Pesan terakhir harus dari user.' }, 400);
  }

  let contextText = '';
  let attach = { parts: [], skipped: [] };
  try {
    if (scope === 'board') {
      const boardId = String(body.boardId || '');
      if (!boardId) return c.json({ detail: 'boardId wajib untuk scope board.' }, 400);
      const board = await getBoard(boardId);
      if (!canViewBoard(user, board)) return c.json({ detail: 'Anda tidak punya akses ke board ini.' }, 403);
      contextText = await buildBoardContext(boardId);
    } else {
      const itemId = String(body.workItemId || '');
      if (!itemId) return c.json({ detail: 'workItemId wajib untuk scope card.' }, 400);
      let item;
      try { item = await getWorkItem(itemId); }
      catch { return c.json({ detail: 'Kartu tidak ditemukan.' }, 404); }
      const board = await getBoard(item.boardId);
      if (!canViewBoard(user, board)) return c.json({ detail: 'Anda tidak punya akses ke kartu ini.' }, 403);
      const includeFinance = await can(user, 'report.view');
      contextText = await buildCardContext(item, { includeFinance });
      if (body.includeAttachments) attach = await buildAttachmentParts(itemId, item.masterCardId);
    }
  } catch (e) {
    console.error('[ai] build context gagal:', e);
    return c.json({ detail: 'Gagal menyusun konteks dari data board/kartu.' }, 500);
  }

  const mediaParts = [
    ...attach.parts,
    ...(attach.skipped.length ? [{ kind: 'text', text: `Catatan: lampiran dilewati — ${attach.skipped.join('; ')}.` }] : []),
  ];

  try {
    const r = await runLLM({ contextText, mediaParts, history });
    return c.json({ reply: r.reply, usage: r.usage, model: r.model, skipped: attach.skipped });
  } catch (e) {
    return llmErrorResponse(c, e);
  }
});

// ══ Halaman /ai — percakapan tersimpan ════════════════════════════════
function msgOut(m) {
  return { id: m.id, role: m.role, content: m.content, refs: m.refs || [], skipped: m.skipped || [], created_at: m.createdAt };
}

// GET /api/ai/conversations   (?userId= hanya untuk super_admin)
aiRouter.get('/ai/conversations', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  const asUser = String(c.req.query('userId') || '') || user.id;
  if (asUser !== user.id && user.role !== 'super_admin') {
    return c.json({ detail: 'Hanya super admin yang bisa melihat riwayat user lain.' }, 403);
  }
  const rows = await db.aiConversation.findMany({
    where: { userId: asUser },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: { _count: { select: { messages: true } } },
  });
  return c.json({
    conversations: rows.map((r) => ({
      id: r.id, title: r.title, message_count: r._count.messages,
      created_at: r.createdAt, updated_at: r.updatedAt,
    })),
    read_only: asUser !== user.id,
  });
});

// POST /api/ai/conversations
aiRouter.post('/ai/conversations', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  const convo = await db.aiConversation.create({ data: { userId: user.id } });
  return c.json({ id: convo.id, title: convo.title });
});

// GET /api/ai/conversations/:id
aiRouter.get('/ai/conversations/:id', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  const convo = await db.aiConversation.findUnique({
    where: { id: c.req.param('id') },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!convo || (convo.userId !== user.id && user.role !== 'super_admin')) {
    return c.json({ detail: 'Percakapan tidak ditemukan.' }, 404);
  }
  return c.json({
    id: convo.id, title: convo.title, user_id: convo.userId,
    read_only: convo.userId !== user.id,
    messages: convo.messages.map(msgOut),
  });
});

// PATCH /api/ai/conversations/:id   { title }
aiRouter.patch('/ai/conversations/:id', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  const convo = await db.aiConversation.findUnique({ where: { id: c.req.param('id') } });
  if (!convo || convo.userId !== user.id) return c.json({ detail: 'Percakapan tidak ditemukan.' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const title = String(body.title || '').trim().slice(0, 120) || 'Percakapan baru';
  const updated = await db.aiConversation.update({ where: { id: convo.id }, data: { title } });
  return c.json({ id: updated.id, title: updated.title });
});

// DELETE /api/ai/conversations/:id
aiRouter.delete('/ai/conversations/:id', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  const convo = await db.aiConversation.findUnique({ where: { id: c.req.param('id') } });
  if (!convo || convo.userId !== user.id) return c.json({ detail: 'Percakapan tidak ditemukan.' }, 404);
  await db.aiConversation.delete({ where: { id: convo.id } });
  return c.json({ ok: true });
});

// POST /api/ai/conversations/:id/messages   { content, refs: [{type,id}] }
aiRouter.post('/ai/conversations/:id/messages', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  if (!aiConfigured()) {
    return c.json({ detail: aiNotConfiguredMsg() }, 501);
  }
  const convo = await db.aiConversation.findUnique({ where: { id: c.req.param('id') } });
  if (!convo || convo.userId !== user.id) return c.json({ detail: 'Percakapan tidak ditemukan.' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const content = String(body.content || '').trim();
  if (!content) return c.json({ detail: 'Pesan kosong.' }, 400);
  const refs = Array.isArray(body.refs) ? body.refs : [];

  let ctx;
  try {
    ctx = await resolveRefs(refs, user);
  } catch (e) {
    console.error('[ai] resolveRefs gagal:', e);
    return c.json({ detail: 'Gagal menyusun konteks dari entitas yang di-tag.' }, 500);
  }

  const prior = await db.aiMessage.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: 'asc' },
  });
  const history = [
    ...prior.slice(-16).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content },
  ];

  const mediaParts = [
    ...ctx.mediaParts,
    ...(ctx.skipped.length
      ? [{ kind: 'text', text: `Catatan: referensi berikut dilewati — ${ctx.skipped.map((s) => `${s.type} ${s.label || s.id} (${s.reason})`).join('; ')}.` }]
      : []),
  ];

  let r;
  try {
    r = await runLLM({ contextText: ctx.contextText, mediaParts, history });
  } catch (e) {
    return llmErrorResponse(c, e);
  }

  const userMsg = await db.aiMessage.create({
    data: { conversationId: convo.id, role: 'user', content, refs: ctx.resolved, skipped: ctx.skipped },
  });
  const aiMsg = await db.aiMessage.create({
    data: { conversationId: convo.id, role: 'assistant', content: r.reply, refs: [], skipped: [] },
  });

  const isFirst = prior.length === 0;
  await db.aiConversation.update({
    where: { id: convo.id },
    data: {
      updatedAt: new Date(),
      ...(isFirst && convo.title === 'Percakapan baru'
        ? { title: content.replace(/\s+/g, ' ').slice(0, 60) || 'Percakapan baru' }
        : {}),
    },
  });

  return c.json({ user_message: msgOut(userMsg), assistant_message: msgOut(aiMsg), skipped: ctx.skipped, usage: r.usage });
});

// GET /api/ai/mentionables?q=&types=board,card,attachment,user   (sudah difilter izin)
aiRouter.get('/ai/mentionables', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  const q = (c.req.query('q') || '').trim();
  if (q.length < 1) return c.json({ results: [] });
  const types = new Set((c.req.query('types') || 'board,card,attachment,user').split(',').map((s) => s.trim()));
  const results = [];

  if (types.has('board')) {
    const rows = await db.board.findMany({
      where: { name: { contains: q, mode: 'insensitive' }, isArchived: false },
      include: { members: true, division: true },
      take: 25,
    });
    let n = 0;
    for (const b of rows) {
      if (!canViewBoard(user, b)) continue;
      results.push({ type: 'board', id: b.id, label: b.name, sub: b.division?.name || 'Board' });
      if (++n >= 8) break;
    }
  }

  if (types.has('card')) {
    const rows = await db.workItem.findMany({
      where: {
        archived: false,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { clientName: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { board: { include: { members: true, division: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    let n = 0;
    for (const w of rows) {
      if (!w.board || !canViewBoard(user, w.board)) continue;
      results.push({ type: 'card', id: w.id, label: w.title, sub: w.board.name });
      if (++n >= 8) break;
    }
  }

  if (types.has('user')) {
    const rows = await db.user.findMany({
      where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
      take: 8,
    });
    for (const u of rows) {
      results.push({ type: 'user', id: u.id, label: u.name, sub: ROLE_LABELS[u.role] || u.role });
    }
  }

  if (types.has('attachment')) {
    const rows = await db.attachment.findMany({
      where: { originalFilename: { contains: q, mode: 'insensitive' }, isDeleted: false, contentType: { not: 'link' } },
      include: { workItem: { include: { board: { include: { members: true, division: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    let n = 0;
    for (const a of rows) {
      if (!a.workItem?.board || !canViewBoard(user, a.workItem.board)) continue;
      results.push({ type: 'attachment', id: a.id, label: a.originalFilename, sub: a.workItem.title });
      if (++n >= 8) break;
    }
  }

  return c.json({ results });
});

// GET /api/ai/chat-users   (super_admin: daftar user yang punya percakapan)
aiRouter.get('/ai/chat-users', async (c) => {
  await requirePerm(c, 'ai.use');
  const user = c.get('user');
  if (user.role !== 'super_admin') return c.json({ users: [] });
  const rows = await db.aiConversation.findMany({ distinct: ['userId'], select: { userId: true } });
  const ids = rows.map((r) => r.userId);
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } })
    : [];
  return c.json({ users });
});

export default aiRouter;
