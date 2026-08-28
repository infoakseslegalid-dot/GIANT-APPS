from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from deps import (
    db, now_iso, today_str, new_id, hash_password, public_user, clean, clean_many,
    get_current_user, require_admin, require_supervisor, get_board, can_view_board,
    broadcast_board, ADMIN_ROLES,
)

router = APIRouter(tags=["admin"])


# ---------- USERS ----------

@router.get("/users")
async def list_users(user=Depends(get_current_user)):
    users = await db.users.find({}).to_list(500)
    return [public_user(u) for u in users]


class CreateUserBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "staff"
    division_id: Optional[str] = None
    avatar_color: str = "#0C66E4"


@router.post("/users")
async def create_user(body: CreateUserBody, user=Depends(get_current_user)):
    require_admin(user)
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    if body.role not in ("super_admin", "admin", "supervisor", "staff", "viewer"):
        raise HTTPException(400, "Peran tidak valid")
    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "email": email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "division_id": body.division_id,
        "avatar_color": body.avatar_color,
        "is_active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return public_user(doc)


class UpdateUserBody(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    division_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    avatar_color: Optional[str] = None


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserBody, user=Depends(get_current_user)):
    require_admin(user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    if "role" in updates and updates["role"] not in ("super_admin", "admin", "supervisor", "staff", "viewer"):
        raise HTTPException(400, "Peran tidak valid")
    if not updates:
        raise HTTPException(400, "Tidak ada perubahan")
    await db.users.update_one({"id": user_id}, {"$set": updates})
    updated = await db.users.find_one({"id": user_id})
    if not updated:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    return public_user(updated)


# ---------- DIVISIONS ----------

@router.get("/divisions")
async def list_divisions(user=Depends(get_current_user)):
    return clean_many(await db.divisions.find({}).sort("name", 1).to_list(100))


class DivisionBody(BaseModel):
    name: str
    color: str = "#0C66E4"


@router.post("/divisions")
async def create_division(body: DivisionBody, user=Depends(get_current_user)):
    require_admin(user)
    doc = {"id": new_id(), "name": body.name.strip(), "color": body.color, "created_at": now_iso()}
    await db.divisions.insert_one(doc)
    return clean(doc)


@router.patch("/divisions/{division_id}")
async def update_division(division_id: str, body: DivisionBody, user=Depends(get_current_user)):
    require_admin(user)
    await db.divisions.update_one({"id": division_id}, {"$set": {"name": body.name.strip(), "color": body.color}})
    return clean(await db.divisions.find_one({"id": division_id}))


@router.delete("/divisions/{division_id}")
async def delete_division(division_id: str, user=Depends(get_current_user)):
    require_admin(user)
    boards = await db.boards.count_documents({"division_id": division_id, "is_archived": {"$ne": True}})
    users = await db.users.count_documents({"division_id": division_id})
    if boards or users:
        raise HTTPException(400, "Divisi masih memiliki board atau pengguna")
    await db.divisions.delete_one({"id": division_id})
    return {"ok": True}


# ---------- CLIENTS (CRM-LITE) ----------

class ClientBody(BaseModel):
    name: str
    business_type: str = "Perusahaan"
    pic_name: str = ""
    whatsapp: str = ""
    email: str = ""
    address: str = ""
    npwp: str = ""
    nib: str = ""


class UpdateClientBody(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    pic_name: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    npwp: Optional[str] = None
    nib: Optional[str] = None


@router.get("/clients")
async def list_clients(q: Optional[str] = None, user=Depends(get_current_user)):
    import re
    filt = {}
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        filt["$or"] = [
            {"name": rx}, {"pic_name": rx}, {"whatsapp": rx},
            {"email": rx}, {"npwp": rx}, {"nib": rx}
        ]
    clients = clean_many(await db.clients.find(filt).sort("name", 1).to_list(500))
    for c in clients:
        c["work_items_count"] = await db.work_items.count_documents({
            "$or": [{"client_id": c["id"]}, {"client_name": c["name"]}],
            "archived": {"$ne": True}
        })
        c["active_items_count"] = await db.work_items.count_documents({
            "$or": [{"client_id": c["id"]}, {"client_name": c["name"]}],
            "archived": {"$ne": True},
            "status": {"$nin": ["done", "SELESAI"]}
        })
    return clients


@router.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(404, "Klien tidak ditemukan")
    client = clean(c)
    items = clean_many(await db.work_items.find({
        "$or": [{"client_id": client_id}, {"client_name": client["name"]}],
        "archived": {"$ne": True}
    }).sort("updated_at", -1).to_list(200))
    boards = {b["id"]: b for b in await db.boards.find({}).to_list(500)}
    lists = {l["id"]: l for l in await db.lists.find({}).to_list(1000)}
    for it in items:
        it["board_name"] = boards.get(it.get("board_id"), {}).get("name")
        it["list_name"] = lists.get(it.get("list_id"), {}).get("name")
    client["work_items"] = items
    client["work_items_count"] = len(items)
    return client


@router.post("/clients")
async def create_client(body: ClientBody, user=Depends(get_current_user)):
    import re
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Nama klien / badan usaha wajib diisi")
    existing = await db.clients.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
    if existing:
        raise HTTPException(400, "Klien dengan nama ini sudah terdaftar")
    doc = {
        "id": new_id(),
        "name": name,
        "business_type": body.business_type.strip() or "Perusahaan",
        "pic_name": body.pic_name.strip(),
        "whatsapp": body.whatsapp.strip(),
        "email": body.email.strip(),
        "address": body.address.strip(),
        "npwp": body.npwp.strip(),
        "nib": body.nib.strip(),
        "created_by": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.clients.insert_one(doc)
    return clean(doc)


@router.patch("/clients/{client_id}")
async def update_client(client_id: str, body: UpdateClientBody, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(404, "Klien tidak ditemukan")
    updates = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Tidak ada data yang diubah")
    updates["updated_at"] = now_iso()
    old_name = c["name"]
    await db.clients.update_one({"id": client_id}, {"$set": updates})
    if "name" in updates and updates["name"] != old_name:
        await db.work_items.update_many(
            {"$or": [{"client_id": client_id}, {"client_name": old_name}]},
            {"$set": {"client_name": updates["name"], "client_id": client_id}}
        )
    return clean(await db.clients.find_one({"id": client_id}))


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user=Depends(get_current_user)):
    require_admin(user)
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(404, "Klien tidak ditemukan")
    count = await db.work_items.count_documents({
        "$or": [{"client_id": client_id}, {"client_name": c["name"]}],
        "archived": {"$ne": True},
        "status": {"$nin": ["done", "SELESAI"]}
    })
    if count > 0:
        raise HTTPException(400, f"Klien masih memiliki {count} pekerjaan aktif")
    await db.clients.delete_one({"id": client_id})
    return {"ok": True}



# ---------- BOARDS ----------

@router.get("/boards")
async def list_boards(user=Depends(get_current_user)):
    boards = clean_many(await db.boards.find({"is_archived": {"$ne": True}}).to_list(500))
    visible = [b for b in boards if can_view_board(user, b)]
    divisions = {d["id"]: d for d in clean_many(await db.divisions.find({}).to_list(100))}
    for b in visible:
        d = divisions.get(b.get("division_id"))
        b["division_name"] = d["name"] if d else None
        b["division_color"] = d["color"] if d else None
        b["card_count"] = await db.work_items.count_documents(
            {"board_id": b["id"], "archived": {"$ne": True}}
        )
    return visible


class CreateBoardBody(BaseModel):
    name: str
    division_id: Optional[str] = None
    background: str = "#0079bf"
    member_ids: List[str] = Field(default_factory=list)
    description: str = ""
    visibility: str = "workspace"
    template: Optional[str] = None


@router.post("/boards")
async def create_board(body: CreateBoardBody, user=Depends(get_current_user)):
    require_admin(user)
    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "division_id": body.division_id,
        "background": body.background,
        "description": body.description,
        "visibility": body.visibility,
        "member_ids": body.member_ids,
        "is_archived": False,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.boards.insert_one(doc)
    if body.template == "skor":
        for idx, lname in enumerate([
            "KOMPLAIN", "SKOR 1-2 (Pengumpulan Berkas)", "SKOR 3 (Butuh/Revisi Draf)",
            "SKOR 4 (Proses Notaris)", "SKOR 5 (NPWP, NIB, Yayasan)",
            "SKOR 6 (Finish/Penyerahan)", "SKOR 7 (Follow Up Kembali)",
        ]):
            await db.lists.insert_one({
                "id": new_id(), "board_id": doc["id"], "name": lname, "color": None,
                "position": (idx + 1) * 1000, "created_at": now_iso(),
            })
    return clean(doc)


class UpdateBoardBody(BaseModel):
    name: Optional[str] = None
    background: Optional[str] = None
    division_id: Optional[str] = None
    member_ids: Optional[List[str]] = None
    description: Optional[str] = None
    visibility: Optional[str] = None


@router.patch("/boards/{board_id}")
async def update_board(board_id: str, body: UpdateBoardBody, user=Depends(get_current_user)):
    require_admin(user)
    board = await get_board(board_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.boards.update_one({"id": board_id}, {"$set": updates})
        await broadcast_board(board_id)
    return clean(await db.boards.find_one({"id": board_id}))


@router.delete("/boards/{board_id}")
async def archive_board(board_id: str, user=Depends(get_current_user)):
    require_admin(user)
    await db.boards.update_one({"id": board_id}, {"$set": {"is_archived": True}})
    return {"ok": True}


@router.post("/boards/{board_id}/unarchive")
async def unarchive_board(board_id: str, user=Depends(get_current_user)):
    require_admin(user)
    await db.boards.update_one({"id": board_id}, {"$set": {"is_archived": False}})
    return {"ok": True}


@router.get("/boards-archived")
async def list_archived_boards(user=Depends(get_current_user)):
    require_admin(user)
    return clean_many(await db.boards.find({"is_archived": True}).to_list(200))


class CopyBoardBody(BaseModel):
    name: str
    with_cards: bool = False


@router.post("/boards/{board_id}/copy")
async def copy_board(board_id: str, body: CopyBoardBody, user=Depends(get_current_user)):
    require_admin(user)
    src = await get_board(board_id)
    new_board = {
        "id": new_id(),
        "name": body.name.strip(),
        "division_id": src.get("division_id"),
        "background": src.get("background", "#0079bf"),
        "description": src.get("description", ""),
        "visibility": src.get("visibility", "workspace"),
        "member_ids": src.get("member_ids", []),
        "is_archived": False,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.boards.insert_one(new_board)
    lists = clean_many(await db.lists.find({"board_id": board_id, "archived": {"$ne": True}}).sort("position", 1).to_list(200))
    list_id_map = {}
    for l in lists:
        nl = {"id": new_id(), "board_id": new_board["id"], "name": l["name"], "color": l.get("color"),
              "entry_requirements": l.get("entry_requirements"), "position": l["position"], "created_at": now_iso()}
        list_id_map[l["id"]] = nl["id"]
        await db.lists.insert_one(nl)
    for lab in clean_many(await db.labels.find({"board_id": board_id}).to_list(200)):
        await db.labels.insert_one({"id": new_id(), "board_id": new_board["id"], "name": lab["name"], "color": lab["color"], "created_at": now_iso()})
    if body.with_cards:
        cards = clean_many(await db.work_items.find({"board_id": board_id, "archived": {"$ne": True}}).to_list(500))
        pos_counter = {}
        for c in cards:
            target_list = list_id_map.get(c["list_id"])
            pos_counter[target_list] = pos_counter.get(target_list, 0) + 1000
            nc = {
                "id": new_id(), "title": c["title"], "client_name": c.get("client_name", ""),
                "client_id": c.get("client_id"),
                "description": c.get("description", ""), "board_id": new_board["id"],
                "list_id": target_list, "position": float(pos_counter[target_list]),
                "label_ids": [], "due_date": c.get("due_date"), "start_date": None, "priority": c.get("priority", "none"),
                "status": "BARU", "work_status": "BARU", "archived": False, "needs_approval": c.get("needs_approval", False),
                "created_by": user["id"], "created_by_name": user["name"],
                "member_ids": [], "division_ids": c.get("division_ids", []),
                "mirror_board_ids": [], "checklists": [
                    {**cl, "items": [{**it, "done": False} for it in cl.get("items", [])]}
                    for cl in c.get("checklists", [])
                ], "watcher_ids": [],
                "cover_color": None, "cover_attachment_id": None, "custom_fields": c.get("custom_fields", []),
                "distribution_status": "MENUNGGU_DIAMBIL", "distribution_updated_at": now_iso(),
                "created_at": now_iso(), "updated_at": now_iso(),
                "completed_at": None, "submitted_by": None, "approved_by": None,
            }
            if nc["list_id"]:
                await db.work_items.insert_one(nc)
                for did in nc["division_ids"]:
                    await db.work_assignments.insert_one({
                        "id": new_id(),
                        "work_item_id": nc["id"],
                        "division_id": did,
                        "user_id": None,
                        "assigned_by": user["id"],
                        "assigned_at": now_iso(),
                        "claimed_at": None,
                        "status": "MENUNGGU_DIAMBIL",
                        "completed_at": None,
                        "unassigned_reason": None,
                        "created_at": now_iso(),
                        "updated_at": now_iso(),
                    })
    return clean(new_board)


@router.get("/boards/{board_id}/full")
async def board_full(board_id: str, user=Depends(get_current_user)):
    board = await get_board(board_id)
    if not can_view_board(user, board):
        raise HTTPException(403, "Anda tidak memiliki akses ke board ini")
    lists = clean_many(await db.lists.find({"board_id": board_id, "archived": {"$ne": True}}).sort("position", 1).to_list(200))
    labels = clean_many(await db.labels.find({"board_id": board_id}).to_list(200))
    cards = clean_many(await db.work_items.find(
        {"$or": [{"board_id": board_id}, {"mirror_board_ids": board_id}], "archived": {"$ne": True}}
    ).to_list(2000))
    archived_count = await db.work_items.count_documents({"board_id": board_id, "archived": True})
    division = None
    if board.get("division_id"):
        division = clean(await db.divisions.find_one({"id": board["division_id"]}))
    users = [public_user(u) for u in await db.users.find({"is_active": {"$ne": False}}).to_list(500)]
    return {
        "board": board,
        "lists": lists,
        "labels": labels,
        "cards": cards,
        "division": division,
        "users": users,
        "archived_count": archived_count,
    }


@router.get("/boards/{board_id}/archived")
async def board_archived(board_id: str, user=Depends(get_current_user)):
    board = await get_board(board_id)
    if not can_view_board(user, board):
        raise HTTPException(403, "Anda tidak memiliki akses ke board ini")
    return clean_many(await db.work_items.find({"board_id": board_id, "archived": True}).to_list(500))


# ---------- LISTS ----------

class CreateListBody(BaseModel):
    name: str
    color: Optional[str] = None


@router.post("/boards/{board_id}/lists")
async def create_list(board_id: str, body: CreateListBody, user=Depends(get_current_user)):
    board = await get_board(board_id)
    if not can_view_board(user, board):
        raise HTTPException(403, "Tidak ada akses")
    count = await db.lists.count_documents({"board_id": board_id})
    doc = {
        "id": new_id(),
        "board_id": board_id,
        "name": body.name.strip(),
        "color": body.color,
        "position": (count + 1) * 1000,
        "created_at": now_iso(),
    }
    await db.lists.insert_one(doc)
    await broadcast_board(board_id)
    return clean(doc)


class UpdateListBody(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    entry_requirements: Optional[List[str]] = None
    archived: Optional[bool] = None


@router.patch("/lists/{list_id}")
async def update_list(list_id: str, body: UpdateListBody, user=Depends(get_current_user)):
    lst = await db.lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(404, "List tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.lists.update_one({"id": list_id}, {"$set": updates})
        await broadcast_board(lst["board_id"])
    return clean(await db.lists.find_one({"id": list_id}))


@router.delete("/lists/{list_id}")
async def delete_list(list_id: str, user=Depends(get_current_user)):
    lst = await db.lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(404, "List tidak ditemukan")
    await db.work_items.update_many(
        {"list_id": list_id}, {"$set": {"archived": True, "updated_at": now_iso()}}
    )
    await db.lists.delete_one({"id": list_id})
    await broadcast_board(lst["board_id"])
    return {"ok": True}


class ReorderListsBody(BaseModel):
    ordered_ids: List[str]


@router.post("/boards/{board_id}/lists/reorder")
async def reorder_lists(board_id: str, body: ReorderListsBody, user=Depends(get_current_user)):
    for idx, lid in enumerate(body.ordered_ids):
        await db.lists.update_one({"id": lid, "board_id": board_id}, {"$set": {"position": (idx + 1) * 1000}})
    await broadcast_board(board_id)
    return {"ok": True}


@router.post("/lists/{list_id}/copy")
async def copy_list(list_id: str, user=Depends(get_current_user)):
    src = await db.lists.find_one({"id": list_id})
    if not src:
        raise HTTPException(404, "List tidak ditemukan")
    count = await db.lists.count_documents({"board_id": src["board_id"]})
    nl = {
        "id": new_id(), "board_id": src["board_id"], "name": f"{src['name']} (salinan)",
        "color": src.get("color"), "entry_requirements": src.get("entry_requirements"),
        "position": (count + 1) * 1000, "created_at": now_iso(),
    }
    await db.lists.insert_one(nl)
    cards = clean_many(await db.work_items.find({"list_id": list_id, "archived": {"$ne": True}}).to_list(500))
    for c in cards:
        nc = dict(c)
        nc["id"] = new_id()
        nc["list_id"] = nl["id"]
        nc["member_ids"] = []
        nc["mirror_board_ids"] = []
        nc["watcher_ids"] = []
        nc["distribution_status"] = "MENUNGGU_DIAMBIL"
        nc["status"] = "BARU"
        nc["work_status"] = "BARU"
        nc["created_by"] = user["id"]
        nc["created_by_name"] = user["name"]
        nc["created_at"] = now_iso()
        nc["updated_at"] = now_iso()
        nc["completed_at"] = None
        await db.work_items.insert_one(nc)
        for did in nc.get("division_ids", []):
            await db.work_assignments.insert_one({
                "id": new_id(),
                "work_item_id": nc["id"],
                "division_id": did,
                "user_id": None,
                "assigned_by": user["id"],
                "assigned_at": now_iso(),
                "claimed_at": None,
                "status": "MENUNGGU_DIAMBIL",
                "completed_at": None,
                "unassigned_reason": None,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
    await broadcast_board(src["board_id"])
    return clean(nl)


@router.post("/lists/{list_id}/archive-all-cards")
async def archive_all_cards(list_id: str, user=Depends(get_current_user)):
    lst = await db.lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(404, "List tidak ditemukan")
    res = await db.work_items.update_many(
        {"list_id": list_id, "archived": {"$ne": True}},
        {"$set": {"archived": True, "updated_at": now_iso()}},
    )
    await broadcast_board(lst["board_id"])
    return {"ok": True, "archived": res.modified_count}


class MoveListBody(BaseModel):
    board_id: str


@router.post("/lists/{list_id}/move")
async def move_list(list_id: str, body: MoveListBody, user=Depends(get_current_user)):
    require_supervisor(user)
    lst = await db.lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(404, "List tidak ditemukan")
    target = await get_board(body.board_id)
    count = await db.lists.count_documents({"board_id": body.board_id})
    old_board = lst["board_id"]
    await db.lists.update_one({"id": list_id}, {"$set": {"board_id": body.board_id, "position": (count + 1) * 1000}})
    await db.work_items.update_many({"list_id": list_id}, {"$set": {"board_id": body.board_id, "updated_at": now_iso()}})
    await broadcast_board(old_board)
    await broadcast_board(target["id"])
    return {"ok": True}


# ---------- LABELS ----------

class LabelBody(BaseModel):
    name: str
    color: str


@router.post("/boards/{board_id}/labels")
async def create_label(board_id: str, body: LabelBody, user=Depends(get_current_user)):
    await get_board(board_id)
    doc = {"id": new_id(), "board_id": board_id, "name": body.name.strip(), "color": body.color, "created_at": now_iso()}
    await db.labels.insert_one(doc)
    await broadcast_board(board_id)
    return clean(doc)


@router.patch("/labels/{label_id}")
async def update_label(label_id: str, body: LabelBody, user=Depends(get_current_user)):
    lbl = await db.labels.find_one({"id": label_id})
    if not lbl:
        raise HTTPException(404, "Label tidak ditemukan")
    await db.labels.update_one({"id": label_id}, {"$set": {"name": body.name.strip(), "color": body.color}})
    await broadcast_board(lbl["board_id"])
    return clean(await db.labels.find_one({"id": label_id}))


@router.delete("/labels/{label_id}")
async def delete_label(label_id: str, user=Depends(get_current_user)):
    lbl = await db.labels.find_one({"id": label_id})
    if not lbl:
        raise HTTPException(404, "Label tidak ditemukan")
    await db.labels.delete_one({"id": label_id})
    await db.work_items.update_many({"label_ids": label_id}, {"$pull": {"label_ids": label_id}})
    await broadcast_board(lbl["board_id"])
    return {"ok": True}


# ---------- AUTOMATION ----------

@router.get("/boards/{board_id}/automation")
async def list_automation(board_id: str, user=Depends(get_current_user)):
    return clean_many(await db.automation_rules.find({"board_id": board_id}).to_list(100))


class AutomationBody(BaseModel):
    trigger: str
    trigger_list_id: Optional[str] = None
    action: str
    action_value: Optional[str] = None


@router.post("/boards/{board_id}/automation")
async def create_automation(board_id: str, body: AutomationBody, user=Depends(get_current_user)):
    require_supervisor(user)
    if body.trigger not in ("card_created", "card_moved", "card_mirrored", "mirror_removed"):
        raise HTTPException(400, "Trigger tidak valid")
    if body.action not in ("add_label", "remove_label", "set_priority", "assign_division"):
        raise HTTPException(400, "Aksi tidak valid")
    doc = {
        "id": new_id(),
        "board_id": board_id,
        "trigger": body.trigger,
        "trigger_list_id": body.trigger_list_id,
        "action": body.action,
        "action_value": body.action_value,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.automation_rules.insert_one(doc)
    return clean(doc)


@router.delete("/automation/{rule_id}")
async def delete_automation(rule_id: str, user=Depends(get_current_user)):
    require_supervisor(user)
    await db.automation_rules.delete_one({"id": rule_id})
    return {"ok": True}


# ---------- ACTIVITIES & STATS ----------

@router.get("/activities")
async def global_activities(limit: int = 50, user=Depends(get_current_user)):
    require_supervisor(user)
    return clean_many(await db.activities.find({}).sort("created_at", -1).to_list(limit))


@router.get("/stats")
async def stats(user=Depends(get_current_user)):
    active_filter = {"archived": {"$ne": True}, "status": {"$nin": ["done", "SELESAI"]}}
    total_active = await db.work_items.count_documents(active_filter)
    unassigned = await db.work_items.count_documents({**active_filter, "$or": [{"member_ids": {"$size": 0}}, {"member_ids": {"$exists": False}}]})
    in_progress = await db.work_items.count_documents({**active_filter, "member_ids.0": {"$exists": True}})
    overdue = await db.work_items.count_documents({**active_filter, "due_date": {"$ne": None, "$lt": today_str()}})
    submitted = await db.work_items.count_documents({"archived": {"$ne": True}, "status": {"$in": ["submitted", "MENUNGGU"]}})
    done_today = await db.work_items.count_documents({"completed_at": {"$regex": f"^{today_str()}"}})
    clients_count = await db.clients.count_documents({})

    divisions = clean_many(await db.divisions.find({}).sort("name", 1).to_list(100))
    by_division = []
    for d in divisions:
        c = await db.work_items.count_documents({**active_filter, "division_ids": d["id"]})
        by_division.append({"id": d["id"], "name": d["name"], "color": d["color"], "count": c})

    pipeline = [
        {"$match": active_filter},
        {"$unwind": "$member_ids"},
        {"$group": {"_id": "$member_ids", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 12},
    ]
    agg = await db.work_items.aggregate(pipeline).to_list(20)
    user_map = {u["id"]: u for u in await db.users.find({}).to_list(500)}
    by_user = [
        {"id": a["_id"], "name": user_map.get(a["_id"], {}).get("name", "?"), "color": user_map.get(a["_id"], {}).get("avatar_color", "#0C66E4"), "count": a["count"]}
        for a in agg
    ]

    return {
        "total_active": total_active,
        "unassigned": unassigned,
        "in_progress": in_progress,
        "overdue": overdue,
        "submitted": submitted,
        "done_today": done_today,
        "clients_count": clients_count,
        "by_division": by_division,
        "by_user": by_user,
    }

