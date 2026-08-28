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
    client_cache = {}
    for bname, title, client_raw, list_idx, label_names, due_days, with_checklist, member_name in SAMPLE_CARDS:
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
        client_name = (client_raw or "").strip()
        cid = None
        if client_name:
            c_key = client_name.lower()
            if c_key in client_cache:
                cid = client_cache[c_key]
            else:
                existing_c = await db.clients.find_one({"name": client_name})
                if existing_c:
                    cid = existing_c["id"]
                else:
                    cid = new_id()
                    b_type = "Perusahaan" if any(p in client_name.upper() for p in ["PT", "CV", "UD", "YAYASAN"]) else "Perorangan"
                    await db.clients.insert_one({
                        "id": cid,
                        "name": client_name,
                        "business_type": b_type,
                        "pic_name": "Bpk/Ibu PIC",
                        "whatsapp": "081234567890",
                        "email": f"{client_name.lower().replace(' ', '').replace('.', '')}@akseslegal.id",
                        "address": "Jakarta, Indonesia",
                        "npwp": "01.234.567.8-901.000",
                        "nib": "1234567890123",
                        "created_by": admin["id"],
                        "created_at": now_iso(),
                        "updated_at": now_iso(),
                    })
                client_cache[c_key] = cid

        assigned_members = [user_map[member_name]] if member_name and member_name in user_map else []
        work_status = "MENUNGGU" if needs_approval else ("PROSES" if assigned_members else "BARU")
        dist_status = "DIRECT_ASSIGNED" if assigned_members else "MENUNGGU_DIAMBIL"

        doc = {
            "id": new_id(),
            "title": title,
            "client_name": client_name,
            "client_id": cid,
            "description": "",
            "board_id": bid,
            "list_id": lids[list_idx],
            "position": 1000.0,
            "label_ids": [label_map[bname][l] for l in label_names if l in label_map[bname]],
            "due_date": due,
            "priority": "urgent" if "URGENT" in label_names else "none",
            "status": work_status,
            "work_status": work_status,
            "distribution_status": dist_status,
            "distribution_updated_at": now_iso(),
            "archived": False,
            "needs_approval": needs_approval,
            "created_by": admin["id"],
            "created_by_name": admin["name"],
            "member_ids": assigned_members,
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

        for did in doc["division_ids"]:
            assigned_u = assigned_members[0] if assigned_members else None
            await db.work_assignments.insert_one({
                "id": new_id(),
                "work_item_id": doc["id"],
                "division_id": did,
                "user_id": assigned_u,
                "assigned_by": admin["id"],
                "assigned_at": now_iso(),
                "claimed_at": now_iso() if assigned_u else None,
                "status": dist_status,
                "completed_at": None,
                "unassigned_reason": None,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })

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
            {"list_id": {"$in": skor5_ids}, "hari_stage": {"$exists": False}, "status": {"$nin": ["done", "SELESAI"]}},
            {"$set": {"hari_stage": 1, "hari_entered_at": now_iso()}},
        )


async def ensure_demo_passwords():
    from deps import verify_password
    for name, email, role, div_key, color in USERS:
        u = await db.users.find_one({"email": email})
        if u and not verify_password("Staff123!", u.get("password_hash", "")):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password("Staff123!")}})


async def migrate_tier0_foundations():
    """Migrates legacy work items to ensure Client separation, WorkAssignment records, and double status enums."""
    items = await db.work_items.find({}).to_list(5000)
    admin = await db.users.find_one({"role": "super_admin"})
    admin_id = admin["id"] if admin else "system"

    client_map = {}
    existing_clients = await db.clients.find({}).to_list(5000)
    for c in existing_clients:
        client_map[c["name"].strip().lower()] = c["id"]

    for item in items:
        cname = (item.get("client_name") or "").strip()
        cid = item.get("client_id")
        if cname:
            key = cname.lower()
            if key not in client_map:
                cid_new = new_id()
                b_type = "Perusahaan" if any(p in cname.upper() for p in ["PT", "CV", "UD", "YAYASAN"]) else "Perorangan"
                cdoc = {
                    "id": cid_new,
                    "name": cname,
                    "business_type": b_type,
                    "pic_name": "Bpk/Ibu PIC",
                    "whatsapp": "081234567890",
                    "email": f"{cname.lower().replace(' ', '').replace('.', '')}@akseslegal.id",
                    "address": "Jakarta, Indonesia",
                    "npwp": "01.234.567.8-901.000",
                    "nib": "1234567890123",
                    "created_by": admin_id,
                    "created_at": item.get("created_at") or now_iso(),
                    "updated_at": item.get("updated_at") or now_iso(),
                }
                await db.clients.insert_one(cdoc)
                client_map[key] = cid_new
            cid = client_map[key]

        old_status = str(item.get("status") or "").strip()
        old_dist = str(item.get("distribution_status") or "").strip()
        member_ids = item.get("member_ids") or []

        # 1. Distribution status mapping
        if old_dist in ("DIAMBIL", "diambil"):
            new_dist = "DIAMBIL"
        elif old_dist in ("DIRECT_ASSIGNED", "direct_assigned"):
            new_dist = "DIRECT_ASSIGNED"
        elif old_dist in ("DILEPASKAN", "dilepaskan", "lepas"):
            new_dist = "DILEPASKAN"
        elif old_dist in ("MENUNGGU_DIAMBIL", "menunggu", "menunggu_diambil"):
            new_dist = "MENUNGGU_DIAMBIL"
        else:
            new_dist = "DIRECT_ASSIGNED" if member_ids else "MENUNGGU_DIAMBIL"

        # 2. Work status mapping
        if old_status in ("SELESAI", "done", "Done"):
            new_status = "SELESAI"
        elif old_status in ("MENUNGGU", "submitted", "Submitted"):
            new_status = "MENUNGGU"
        elif old_status in ("REVISI", "revisi"):
            new_status = "REVISI"
        elif old_status in ("PROSES", "proses"):
            new_status = "PROSES"
        elif old_status in ("BARU", "baru"):
            new_status = "BARU"
        elif old_status in ("active", "Active"):
            new_status = "PROSES" if member_ids else "BARU"
        else:
            new_status = "PROSES" if member_ids else "BARU"

        item_updates = {}
        if item.get("client_id") != cid and cid:
            item_updates["client_id"] = cid
        if item.get("status") != new_status:
            item_updates["status"] = new_status
        if item.get("work_status") != new_status:
            item_updates["work_status"] = new_status
        if item.get("distribution_status") != new_dist:
            item_updates["distribution_status"] = new_dist

        if item_updates:
            await db.work_items.update_one({"id": item["id"]}, {"$set": item_updates})

        # 3. Create missing WorkAssignments
        existing_assignments = await db.work_assignments.count_documents({"work_item_id": item["id"]})
        if existing_assignments == 0:
            div_ids = item.get("division_ids") or []
            if not div_ids and item.get("board_id"):
                board = await db.boards.find_one({"id": item["board_id"]})
                if board and board.get("division_id"):
                    div_ids = [board["division_id"]]
            for did in div_ids:
                assigned_u = member_ids[0] if member_ids else None
                await db.work_assignments.insert_one({
                    "id": new_id(),
                    "work_item_id": item["id"],
                    "division_id": did,
                    "user_id": assigned_u,
                    "assigned_by": item.get("created_by") or admin_id,
                    "assigned_at": item.get("created_at") or now_iso(),
                    "claimed_at": (item.get("created_at") or now_iso()) if assigned_u else None,
                    "status": new_dist,
                    "completed_at": item.get("completed_at"),
                    "unassigned_reason": None,
                    "created_at": item.get("created_at") or now_iso(),
                    "updated_at": item.get("updated_at") or now_iso(),
                })
