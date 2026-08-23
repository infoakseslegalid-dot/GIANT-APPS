from datetime import datetime, timezone, timedelta

from deps import db, now_iso, log_activity, broadcast_item

STAGE_GATES = {4: ["AKTA", "SK"], 6: ["NPWP", "AKUN CORETAX", "SUKET"]}


def _done_texts(item):
    done = []
    for cl in item.get("checklists", []):
        for it in cl.get("items", []):
            if it.get("done"):
                done.append(it.get("text", "").lower())
    return done


def _unmet(item, required):
    done = _done_texts(item)
    return [r for r in required if not any(r.strip().lower() in t for t in done)]


async def advance_hari_job():
    items = await db.work_items.find({
        "hari_stage": {"$gte": 1, "$lte": 6},
        "archived": {"$ne": True},
        "status": {"$ne": "done"},
    }).to_list(2000)
    now = datetime.now(timezone.utc)
    system = {"id": "system", "name": "Sistem"}
    advanced = 0
    for item in items:
        entered = item.get("hari_entered_at")
        try:
            entered_dt = datetime.fromisoformat(entered) if entered else now
        except Exception:
            entered_dt = now
        if entered_dt.tzinfo is None:
            entered_dt = entered_dt.replace(tzinfo=timezone.utc)
        if now - entered_dt < timedelta(hours=20):
            continue
        current = item["hari_stage"]
        target = current + 1
        missing = _unmet(item, STAGE_GATES.get(target, []))
        if missing:
            continue
        await db.work_items.update_one(
            {"id": item["id"]},
            {"$set": {"hari_stage": target, "hari_entered_at": now_iso(), "updated_at": now_iso()}},
        )
        await log_activity(item["id"], item["board_id"], system, f"otomatis maju ke HARI {target}")
        item["hari_stage"] = target
        await broadcast_item(item)
        advanced += 1

    today = now.strftime("%Y-%m-%d")
    tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    due_items = await db.work_items.find({
        "due_date": {"$in": [today, tomorrow]},
        "archived": {"$ne": True},
        "status": {"$ne": "done"},
    }).to_list(2000)
    for item in due_items:
        already = await db.notifications.find_one({
            "work_item_id": item["id"], "type": "due",
            "created_at": {"$regex": f"^{today}"},
        })
        if already:
            continue
        targets = list(set(
            (item.get("member_ids") or []) + (item.get("watcher_ids") or []) + [item.get("created_by")]
        ))
        label = "hari ini" if item["due_date"] == today else "besok"
        for uid in targets:
            if not uid:
                continue
            await db.notifications.insert_one({
                "id": __import__("uuid").uuid4().hex, "user_id": uid, "type": "due",
                "title": f"Jatuh tempo {label}",
                "body": f"\"{item['title']}\" jatuh tempo {label} ({item['due_date']})",
                "work_item_id": item["id"], "board_id": item.get("board_id"),
                "is_read": False, "created_at": now_iso(),
            })
    return advanced
