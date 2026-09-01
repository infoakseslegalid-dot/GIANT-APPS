// @ts-nocheck
import { db, logActivity, broadcastItem } from './deps';

const STAGE_GATES: Record<number, string[]> = {
  4: ["AKTA", "SK"],
  6: ["NPWP", "AKUN CORETAX", "SUKET"]
};

function _done_texts(item: any): string[] {
  const done: string[] = [];
  const checklists = (item.checklists as any[]) || [];
  for (const cl of checklists) {
    const items = cl.items || [];
    for (const it of items) {
      if (it.done) {
        done.push((it.text || "").toLowerCase());
      }
    }
  }
  return done;
}

function _unmet(item: any, required: string[]): string[] {
  const done = _done_texts(item);
  return required.filter(r => !done.some(t => t.includes(r.trim().toLowerCase())));
}

export async function advance_hari_job() {
  const items = await db.workItem.findMany({
    where: {
      hariStage: { gte: 1, lte: 6 },
      archived: false,
      status: { not: "done" }
    }
  });

  const now = new Date();
  const system = { id: "system", name: "Sistem" };
  let advanced = 0;

  for (const item of items) {
    const entered = item.hariEnteredAt;
    const enteredDt = entered ? new Date(entered) : now;
    
    if (now.getTime() - enteredDt.getTime() < 20 * 60 * 60 * 1000) {
      continue;
    }

    const current = item.hariStage!;
    const target = current + 1;
    const missing = _unmet(item, STAGE_GATES[target] || []);

    if (missing.length > 0) {
      continue;
    }

    const updatedItem = await db.workItem.update({
      where: { id: item.id },
      data: {
        hariStage: target,
        hariEnteredAt: new Date(),
        updatedAt: new Date()
      }
    });

    await logActivity(item.id, item.boardId, system.id, system.name, `otomatis maju ke HARI ${target}`);
    await broadcastItem(updatedItem);
    advanced += 1;
  }

  const today = now.toISOString().split('T')[0];
  const tomorrowDt = new Date(now);
  tomorrowDt.setDate(tomorrowDt.getDate() + 1);
  const tomorrow = tomorrowDt.toISOString().split('T')[0];

  const dueItems = await db.workItem.findMany({
    where: {
      dueDate: { in: [today, tomorrow] },
      archived: false,
      status: { not: "done" }
    },
    include: {
      members: true,
    }
  });

  for (const item of dueItems) {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const already = await db.notification.findFirst({
      where: {
        workItemId: item.id,
        type: "due",
        createdAt: { gte: startOfDay }
      }
    });

    if (already) {
      continue;
    }

    const targetsSet = new Set<string>();
    for (const mem of item.members) {
      targetsSet.add(mem.userId);
    }
    targetsSet.add(item.createdById);
    
    const label = item.dueDate === today ? "hari ini" : "besok";
    const targets = Array.from(targetsSet);

    for (const uid of targets) {
      if (!uid) continue;
      await db.notification.create({
        data: {
          userId: uid,
          type: "due",
          title: `Jatuh tempo ${label}`,
          body: `"${item.title}" jatuh tempo ${label} (${item.dueDate})`,
          workItemId: item.id,
          boardId: item.boardId,
          isRead: false
        }
      });
    }
  }

  return advanced;
}
