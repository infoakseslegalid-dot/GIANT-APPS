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


@router.post("/boards")
async def create_board(body: CreateBoardBody, user=Depends(get_current_user)):
    require_admin(user)
    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "division_id": body.division_id,
        "background": body.background,
        "member_ids": body.member_ids,
        "is_archived": False,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.boards.insert_one(doc)
    return clean(doc)


class UpdateBoardBody(BaseModel):
    name: Optional[str] = None
    background: Optional[str] = None
    division_id: Optional[str] = None
    member_ids: Optional[List[str]] = None


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


@router.get("/boards/{board_id}/full")
async def board_full(board_id: str, user=Depends(get_current_user)):
    board = await get_board(board_id)
    if not can_view_board(user, board):
        raise HTTPException(403, "Anda tidak memiliki akses ke board ini")
    lists = clean_many(await db.lists.find({"board_id": board_id}).sort("position", 1).to_list(200))
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
    active_filter = {"archived": {"$ne": True}, "status": {"$ne": "done"}}
    total_active = await db.work_items.count_documents(active_filter)
    unassigned = await db.work_items.count_documents({**active_filter, "$or": [{"member_ids": {"$size": 0}}, {"member_ids": {"$exists": False}}]})
    in_progress = await db.work_items.count_documents({**active_filter, "member_ids.0": {"$exists": True}})
    overdue = await db.work_items.count_documents({**active_filter, "due_date": {"$ne": None, "$lt": today_str()}})
    submitted = await db.work_items.count_documents({"archived": {"$ne": True}, "status": "submitted"})
    done_today = await db.work_items.count_documents({"completed_at": {"$regex": f"^{today_str()}"}})

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
        "by_division": by_division,
        "by_user": by_user,
    }
