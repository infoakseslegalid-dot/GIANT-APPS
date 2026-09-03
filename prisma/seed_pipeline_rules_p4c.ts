// @ts-nocheck
/**
 * Fase 4c — seed rule pipeline otomasi berantai Bank Data.
 * Idempoten: hapus rule pipeline lama (action pipeline) lalu buat ulang.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PIPELINE_ACTIONS = ['send_to_division', 'check_checklist_item', 'notify', 'move_master_card', 'move_card'];

/**
 * board target rule per divisi.
 *  - cs  : SEMUA board CS yg punya list template (satu per CS person)
 *  - lain: hanya board dgn list terbanyak (yang "real", buang duplikat kosong)
 */
async function targetBoards() {
  const divs = await prisma.division.findMany();
  const out: Record<string, any[]> = {};
  for (const d of divs) {
    const bs = await prisma.board.findMany({
      where: { divisionId: d.id, isArchived: false, lists: { some: {} } },
      include: { lists: true, _count: { select: { lists: true } } },
    });
    bs.sort((a, b) => b._count.lists - a._count.lists);
    out[d.key] = d.key === 'cs' ? bs.filter((b) => b._count.lists >= 8) : bs.slice(0, 1);
  }
  return out;
}

function listId(board: any, name: string) {
  const l = board?.lists.find((x: any) => (x.name || '').trim().toLowerCase() === name.trim().toLowerCase());
  return l?.id || null;
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'super_admin' } });
  const t = await targetBoards();

  const del = await prisma.automationRule.deleteMany({ where: { action: { in: PIPELINE_ACTIONS } } });

  const rules: any[] = [];
  const add = (boards: any[], triggerListName: string, action: string, actionValue: any) => {
    for (const board of boards || []) {
      const tlid = listId(board, triggerListName);
      if (!tlid) { console.warn('  ! list tidak ketemu:', board.name, '/', triggerListName); continue; }
      rules.push({
        id: crypto.randomUUID(), boardId: board.id, trigger: 'card_moved', triggerListId: tlid,
        action, actionValue: typeof actionValue === 'string' ? actionValue : JSON.stringify(actionValue),
        createdById: admin.id,
      });
    }
  };

  // 1) CS geser kartu ke "SKOR 5 SIAP KIRIM NOTARIS" → kirim ke Bank Data Admin Draf
  add(t.cs, 'SKOR 5 SIAP KIRIM NOTARIS', 'send_to_division', {
    division_keys: ['draf'], carry_attachments: true, stage: 'Akta',
    title_suffix: ' — Draft/Minuta Akta', note: 'Penyusunan Draf / Minuta Akta & pengecekan nama AHU',
  });

  // 2) CS geser ke "SKOR 5 (NPWP)" → kirim ke Bank Data Pajak + Desain
  add(t.cs, 'SKOR 5 (NPWP)', 'send_to_division', {
    division_keys: ['pajak'], carry_attachments: true, stage: 'NPWP',
    title_suffix: ' — NPWP & EFIN', note: 'Pendaftaran NPWP Badan & Aktivasi Akun DJP Online',
  });
  add(t.cs, 'SKOR 5 (NPWP)', 'send_to_division', {
    division_keys: ['desain'],
    title_suffix: ' — Materi Promo Legalitas', note: 'Desain Ucapan Selamat / Mockup Legalitas PT baru',
  });

  // 3) CS geser ke "SKOR 5 (NIB)" → kirim ke Bank Data Perizinan
  add(t.cs, 'SKOR 5 (NIB)', 'send_to_division', {
    division_keys: ['perizinan'], carry_attachments: true, stage: 'NIB',
    title_suffix: ' — OSS & NIB', note: 'Proses Akun OSS RBA & Penerbitan NIB',
  });

  // 4) Admin Draf assignment → "FINISH TODAY" → centang Akta di Master
  add(t.draf, 'FINISH TODAY', 'check_checklist_item', 'Akta');

  // 5) Admin Pajak → "FINISH" → centang NPWP + notif Owner
  add(t.pajak, 'FINISH', 'check_checklist_item', 'NPWP');
  add(t.pajak, 'FINISH', 'notify', { to: 'owner', title: 'NPWP terbit', message: 'NPWP untuk "{title}" sudah terbit.' });

  // 6) Admin Perizinan → "DONE TODAY" → centang SK+NIB, pindah Master ke "SKOR 6 FINISH", notif Owner
  add(t.perizinan, 'DONE TODAY', 'check_checklist_item', 'SK Kemenkumham, NIB');
  add(t.perizinan, 'DONE TODAY', 'move_master_card', 'SKOR 6 FINISH');
  add(t.perizinan, 'DONE TODAY', 'notify', {
    to: 'owner', title: 'Legalitas lengkap',
    message: 'Seluruh dokumen "{title}" rampung (Akta, SK, NPWP, NIB). Siap serah terima!',
  });

  await prisma.automationRule.createMany({ data: rules });
  console.log(`rule pipeline lama dihapus: ${del.count} | rule baru dibuat: ${rules.length}`);
  const byBoard: Record<string, number> = {};
  rules.forEach((r) => { byBoard[r.boardId.slice(0, 8)] = (byBoard[r.boardId.slice(0, 8)] || 0) + 1; });
  console.log('  per board:', JSON.stringify(byBoard));
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
