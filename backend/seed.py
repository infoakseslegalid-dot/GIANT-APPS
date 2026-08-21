import os
from datetime import datetime, timezone, timedelta

from deps import db, new_id, now_iso, hash_password

LABEL_SET = [
    ("LUNAS", "#22A06B"),
    ("DP", "#F5CD47"),
    ("BELUM PENYERAHAN", "#E56910"),
    ("URGENT", "#CA3521"),
    ("VIA GC ADMIN", "#9F8FEF"),
    ("NOT SOPPENG", "#0C66E4"),
    ("NOT BANDUNG", "#1D7AFC"),
    ("NOT TANGSEL", "#579DFF"),
    ("MKS", "#6CC3E0"),
    ("JKT", "#94C748"),
    ("SUDAH ADA LOGO", "#4BCE97"),
    ("SUDAH ADA AKUN DASHBOARD", "#8590A2"),
    ("SALINAN KEMBALI", "#F87168"),
    ("TER-MIRROR", "#2684FF"),
]

DIVISIONS = [
    ("cs", "Customer Service", "#0C66E4"),
    ("draf", "Admin Draf Input", "#E56910"),
    ("pajak", "Admin Pajak", "#22A06B"),
    ("perizinan", "Admin Perizinan", "#9F8FEF"),
    ("desain", "Desain & Konten", "#E774BB"),
]

USERS = [
    ("Dedes Ali", "dedes@ali.id", "staff", "cs", "#0C66E4"),
    ("Devi Ali", "devi@ali.id", "staff", "cs", "#1D7AFC"),
    ("Dewi Ali", "dewi@ali.id", "staff", "cs", "#579DFF"),
    ("Julia Ali", "julia@ali.id", "staff", "cs", "#6CC3E0"),
    ("Elis", "elis@ali.id", "staff", "draf", "#E56910"),
    ("Anti", "anti@ali.id", "staff", "draf", "#F5CD47"),
    ("Amel", "amel@ali.id", "staff", "pajak", "#22A06B"),
    ("Andi", "andi@ali.id", "supervisor", "perizinan", "#9F8FEF"),
    ("Rina", "rina@ali.id", "staff", "desain", "#E774BB"),
]

CS_LISTS = [
    "KOMPLAIN",
    "SKOR 1-2 (Pengumpulan Berkas)",
    "SKOR 3 (Butuh/Revisi Draf)",
    "SKOR 4 (Proses Notaris)",
    "SKOR 5 (NPWP, NIB, Yayasan)",
    "SKOR 6 (Finish/Penyerahan)",
    "SKOR 7 (Follow Up Kembali)",
]

BOARDS = [
    ("CS DEDES ALI", "cs", ["Dedes Ali"], "#0079bf", CS_LISTS),
    ("CS DEVI ALI", "cs", ["Devi Ali"], "#519839", CS_LISTS),
    ("CS DEWI ALI", "cs", ["Dewi Ali"], "#B04632", CS_LISTS),
    ("CS JULIA ALI", "cs", ["Julia Ali"], "#89609E", CS_LISTS),
    ("ADMIN DRAF INPUT", "draf", ["Elis", "Anti"], "#D29034",
     ["PRATINJAU", "FU NOTARIS", "SIAP KIRIM NOTARIS", "VIA WA/GC ADMIN", "PESAN NAMA", "INPUTAN", "FINISH", "ADMIN"]),
    ("ADMIN PAJAK", "pajak", ["Amel"], "#4BBF6B",
     ["LIST SPT TAHUNAN", "LIST PENGURUSAN PAJAK", "DOING", "FINISH", "KONTRAK PAJAK", "EMAIL NOTARIS", "ADMIN"]),
    ("ADMIN PERIZINAN", "perizinan", ["Andi"], "#CD5A91",
     ["PERIZINAN LANJUTAN", "PRODUK LAINNYA", "MEREK", "MENUNGGU HASIL VERIFIKASI", "TINDAK LANJUT MEREK", "DONE TODAY", "FINISH", "NOTARIS SOPPENG"]),
    ("DESAIN & KONTEN", "desain", ["Rina"], "#00AECC",
     ["DAILY RUTIN", "LIST LOGO/COMPRO", "DOING", "FINISH", "REVISI", "REFERENSI", "AKSES LEGAL INDONESIA & KHAL", "KONTEN LAYANAN", "INFLUENCER", "RE-DESAIN"]),
]

# (board_name, title, client, list_index, labels, due_offset_days, with_checklist, member_name)
SAMPLE_CARDS = [
    ("CS DEDES ALI", "PT Illank Rezeki Abadi - Pendirian PT", "PT Illank Rezeki Abadi", 1, ["DP", "NOT TANGSEL"], 3, True, "Dedes Ali"),
    ("CS DEDES ALI", "CV Arkana Cipta Persada - Revisi Akta", "CV Arkana Cipta Persada", 2, ["URGENT"], 1, True, None),
    ("CS DEDES ALI", "UD Sinar Bahagia - Pengumpulan Berkas", "UD Sinar Bahagia", 1, [], 7, False, None),
    ("CS DEVI ALI", "PT Nusantara Jaya - Proses Notaris", "PT Nusantara Jaya", 3, ["LUNAS", "JKT"], 5, True, "Devi Ali"),
    ("CS DEVI ALI", "CV Mentari Pagi - Komplain Dokumen", "CV Mentari Pagi", 0, ["URGENT", "BELUM PENYERAHAN"], 1, False, None),
    ("CS DEWI ALI", "PT Graha Sentosa - Pendirian + NIB", "PT Graha Sentosa", 4, ["LUNAS"], 2, True, "Dewi Ali"),
    ("CS DEWI ALI", "Yayasan Cahaya Ilmu - Pendirian Yayasan", "Yayasan Cahaya Ilmu", 1, ["DP", "NOT BANDUNG"], 6, True, None),
    ("CS JULIA ALI", "PT Bintang Timur - Follow Up Klien", "PT Bintang Timur", 6, [], 4, False, "Julia Ali"),
    ("CS JULIA ALI", "CV Karya Mandala - Pengumpulan Berkas", "CV Karya Mandala", 1, ["DP"], 8, True, None),
    ("ADMIN DRAF INPUT", "PT Illank Rezeki Abadi - Draft Akta", "PT Illank Rezeki Abadi", 0, ["NOT TANGSEL"], 2, True, "Elis"),
    ("ADMIN DRAF INPUT", "CV Arkana Cipta Persada - Pesan Nama", "CV Arkana Cipta Persada", 4, ["URGENT", "VIA GC ADMIN"], 1, False, "Anti"),
    ("ADMIN DRAF INPUT", "PT Nusantara Jaya - Siap Kirim Notaris", "PT Nusantara Jaya", 2, ["LUNAS", "JKT"], 1, True, "Elis"),
    ("ADMIN PAJAK", "PT Graha Sentosa - NPWP Badan", "PT Graha Sentosa", 1, ["MKS"], 5, True, "Amel"),
    ("ADMIN PAJAK", "CV Mentari Pagi - SPT Tahunan", "CV Mentari Pagi", 0, ["BELUM PENYERAHAN"], 10, False, None),
    ("ADMIN PERIZINAN", "PT Bintang Timur - Pengurusan Merek", "PT Bintang Timur", 2, ["URGENT"], 7, True, "Andi"),
    ("ADMIN PERIZINAN", "UD Sinar Bahagia - NIB OSS", "UD Sinar Bahagia", 0, ["NOT SOPPENG"], 3, True, None),
    ("DESAIN & KONTEN", "PT Graha Sentosa - Logo & Compro", "PT Graha Sentosa", 1, ["SUDAH ADA LOGO"], 6, True, "Rina"),
    ("DESAIN & KONTEN", "Konten Layanan Pendirian PT", "Internal", 0, [], 2, False, None),
]


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "name": "Super Admin",
            "email": email,
            "password_hash": hash_password(password),
            "role": "super_admin",
            "division_id": None,
            "avatar_color": "#CA3521",
            "is_active": True,
            "created_at": now_iso(),
        })
    else:
        from deps import verify_password
        if not verify_password(password, existing.get("password_hash", "")):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})


async def seed_demo():
    if await db.settings.find_one({"key": "demo_seeded"}):
        return
    admin = await db.users.find_one({"role": "super_admin"})
    if not admin:
        return

    div_map = {}
    for key, name, color in DIVISIONS:
        did = new_id()
        div_map[key] = did
        await db.divisions.insert_one({"id": did, "name": name, "color": color, "key": key, "created_at": now_iso()})

    user_map = {}
    for name, email, role, div_key, color in USERS:
        uid = new_id()
        user_map[name] = uid
        await db.users.insert_one({
            "id": uid,
            "name": name,
            "email": email,
            "password_hash": hash_password("Staff123!"),
            "role": role,
            "division_id": div_map.get(div_key),
            "avatar_color": color,
            "is_active": True,
            "created_at": now_iso(),
        })

    board_map = {}
    list_map = {}
    label_map = {}
    for bname, div_key, members, bg, list_names in BOARDS:
        bid = new_id()
        board_map[bname] = bid
        member_ids = [user_map[m] for m in members if m in user_map]
        await db.boards.insert_one({
            "id": bid,
            "name": bname,
            "division_id": div_map.get(div_key),
            "background": bg,
            "member_ids": member_ids,
            "is_archived": False,
            "created_by": admin["id"],
            "created_at": now_iso(),
        })
        lids = []
        for idx, lname in enumerate(list_names):
            lid = new_id()
            lids.append(lid)
            await db.lists.insert_one({
                "id": lid, "board_id": bid, "name": lname, "color": None,
                "position": (idx + 1) * 1000, "created_at": now_iso(),
            })
        list_map[bname] = lids
        lmap = {}
        for lname, lcolor in LABEL_SET:
            lab_id = new_id()
            lmap[lname] = lab_id
            await db.labels.insert_one({
                "id": lab_id, "board_id": bid, "name": lname, "color": lcolor, "created_at": now_iso(),
            })
        label_map[bname] = lmap
        if lmap.get("TER-MIRROR"):
            await db.automation_rules.insert_one({
                "id": new_id(), "board_id": bid, "trigger": "card_mirrored",
                "trigger_list_id": None, "action": "add_label",
                "action_value": lmap["TER-MIRROR"], "created_by": admin["id"], "created_at": now_iso(),
            })
            await db.automation_rules.insert_one({
                "id": new_id(), "board_id": bid, "trigger": "mirror_removed",
                "trigger_list_id": None, "action": "remove_label",
                "action_value": lmap["TER-MIRROR"], "created_by": admin["id"], "created_at": now_iso(),
            })

    mirror_seed = None
    for bname, title, client, list_idx, label_names, due_days, with_checklist, member_name in SAMPLE_CARDS:
        bid = board_map[bname]
        lids = list_map[bname]
        if list_idx >= len(lids):
            list_idx = 0
        due = (datetime.now(timezone.utc) + timedelta(days=due_days)).strftime("%Y-%m-%d")
        checklists = []
        if with_checklist:
            checklists = [{
                "id": new_id(),
                "title": "Syarat Berkas",
                "items": [
                    {"id": new_id(), "text": "KTP Direksi", "done": True},
                    {"id": new_id(), "text": "NPWP", "done": True},
                    {"id": new_id(), "text": "Akta Pendirian", "done": False},
                    {"id": new_id(), "text": "SK Kemenkumham", "done": False},
                ],
            }]
        needs_approval = "Siap Kirim" in title
        doc = {
            "id": new_id(),
            "title": title,
            "client_name": client,
            "description": "",
            "board_id": bid,
            "list_id": lids[list_idx],
            "position": 1000.0,
            "label_ids": [label_map[bname][l] for l in label_names if l in label_map[bname]],
            "due_date": due,
            "priority": "urgent" if "URGENT" in label_names else "none",
            "status": "submitted" if needs_approval else "active",
            "archived": False,
            "needs_approval": needs_approval,
            "created_by": admin["id"],
            "created_by_name": admin["name"],
            "member_ids": [user_map[member_name]] if member_name else [],
            "division_ids": [],
            "mirror_board_ids": [],
            "checklists": checklists,
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "completed_at": None,
            "submitted_by": user_map.get(member_name) if needs_approval else None,
            "approved_by": None,
        }
        board = await db.boards.find_one({"id": bid})
        if board and board.get("division_id"):
            doc["division_ids"] = [board["division_id"]]
        await db.work_items.insert_one(doc)
        if title.startswith("PT Graha Sentosa - Pendirian"):
            mirror_seed = doc

    if mirror_seed:
        target_bid = board_map.get("ADMIN PERIZINAN")
        if target_bid:
            await db.work_items.update_one(
                {"id": mirror_seed["id"]},
                {"$set": {
                    "mirror_board_ids": [target_bid],
                    "label_ids": mirror_seed["label_ids"] + [label_map["CS DEWI ALI"]["TER-MIRROR"]],
                }},
            )

    await db.settings.insert_one({"key": "demo_seeded", "at": now_iso()})


CS_STAGE_REQUIREMENTS = {
    "SKOR 3": ["KTP", "NPWP"],
    "SKOR 4": ["Pembayaran DP/Lunas"],
    "SKOR 5": ["Konfirmasi Klien"],
    "SKOR 6": ["Penyerahan"],
}


async def migrate_stage_requirements():
    for prefix, reqs in CS_STAGE_REQUIREMENTS.items():
        await db.lists.update_many(
            {"name": {"$regex": f"^{prefix}", "$options": "i"}, "entry_requirements": {"$exists": False}},
            {"$set": {"entry_requirements": reqs}},
        )
    skor5_lists = await db.lists.find({"name": {"$regex": "^SKOR 5", "$options": "i"}}).to_list(100)
    skor5_ids = [l["id"] for l in skor5_lists]
    if skor5_ids:
        await db.work_items.update_many(
            {"list_id": {"$in": skor5_ids}, "hari_stage": {"$exists": False}, "status": {"$ne": "done"}},
            {"$set": {"hari_stage": 1, "hari_entered_at": now_iso()}},
        )
