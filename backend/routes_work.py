import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Response
from pydantic import BaseModel, Field

from deps import (
    db, now_iso, today_str, new_id, clean, clean_many, get_current_user,
    require_supervisor, get_board, can_view_board, get_work_item, log_activity,
    notify, broadcast_board, broadcast_item, run_automation, ADMIN_ROLES,
    SUPERVISOR_ROLES, public_user,
)
from storage import put_object, get_object

router = APIRouter(tags=["work"])

PRIORITIES = ("none", "low", "medium", "high", "urgent")


async def get_item_checked(item_id: str, user: dict) -> dict:
    item = await get_work_item(item_id)
    board = await get_board(item["board_id"])
    if not can_view_board(user, board):
        raise HTTPException(403, "Anda tidak memiliki akses ke pekerjaan ini")
    return item


STAGE_GATES = {4: ["AKTA", "SK"], 6: ["NPWP", "AKUN CORETAX", "SUKET"], 8: ["NIB"]}
HARI_DIVISION_KEYS = {"draf", "pajak", "perizinan", "desain"}


def done_checklist_texts(item: dict) -> list:
    done = []
    for cl in item.get("checklists", []):
        for it in cl.get("items", []):
            if it.get("done"):
                done.append(it.get("text", "").lower())
    return done


def unmet_requirements(item: dict, required: list) -> list:
    done = done_checklist_texts(item)
    missing = []
    for req in required or []:
        r = req.strip().lower()
        if r and not any(r in t for t in done):
            missing.append(req)
    return missing


async def ensure_requirement_checklist(item: dict, lst: dict):
    reqs = lst.get("entry_requirements") or []
    if not reqs:
        return
    checklists = item.get("checklists", [])
    title = f"Syarat {lst['name']}"
    target = next((c for c in checklists if c["title"] == title), None)
    changed = False
    if target is None:
        target = {"id": new_id(), "title": title, "items": []}
        checklists.append(target)
        changed = True
    existing = {i["text"].strip().lower() for i in target["items"]}
    for req in reqs:
        if req.strip().lower() not in existing:
            target["items"].append({"id": new_id(), "text": req, "done": False})
            changed = True
    if changed:
        await db.work_items.update_one({"id": item["id"]}, {"$set": {"checklists": checklists}})
        item["checklists"] = checklists


async def user_division(user: dict):
    if not user.get("division_id"):
        return None
    return await db.divisions.find_one({"id": user["division_id"]})


async def can_access_hari(user: dict) -> bool:
    if user["role"] in ADMIN_ROLES:
        return True
    div = await user_division(user)
    return bool(div and div.get("key") in HARI_DIVISION_KEYS)


class CreateItemBody(BaseModel):
    board_id: str
    list_id: str
    title: str
    client_name: str = ""
    description: str = ""
    priority: str = "none"
    due_date: Optional[str] = None
    label_ids: List[str] = Field(default_factory=list)
    member_ids: List[str] = Field(default_factory=list)
    division_ids: List[str] = Field(default_factory=list)
    needs_approval: bool = False


@router.post("/work-items")
async def create_item(body: CreateItemBody, user=Depends(get_current_user)):
    board = await get_board(body.board_id)
    lst = await db.lists.find_one({"id": body.list_id, "board_id": body.board_id})
    if not lst:
        raise HTTPException(404, "List tidak ditemukan di board ini")
    count = await db.work_items.count_documents({"list_id": body.list_id, "archived": {"$ne": True}})
    doc = {
        "id": new_id(),
        "title": body.title.strip(),
        "client_name": body.client_name.strip(),
        "description": body.description,
        "board_id": body.board_id,
        "list_id": body.list_id,
        "position": (count + 1) * 1000.0,
        "label_ids": body.label_ids,
        "due_date": body.due_date,
        "priority": body.priority if body.priority in PRIORITIES else "none",
        "status": "active",
        "archived": False,
        "needs_approval": body.needs_approval,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "member_ids": body.member_ids,
        "division_ids": body.division_ids or ([board["division_id"]] if board.get("division_id") else []),
        "mirror_board_ids": [],
        "checklists": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "completed_at": None,
        "submitted_by": None,
        "approved_by": None,
    }
    await db.work_items.insert_one(doc)
    await log_activity(doc["id"], doc["board_id"], user, f"membuat pekerjaan \"{doc['title']}\"")
    await ensure_requirement_checklist(doc, lst)
    await run_automation(doc["board_id"], "card_created", doc, user, doc["list_id"])
    if doc["member_ids"]:
        await notify(doc["member_ids"], "assigned", "Anda ditugaskan",
                     f"{user['name']} menugaskan Anda pada \"{doc['title']}\"",
                     doc["id"], doc["board_id"], exclude={user["id"]})
    await broadcast_item(doc)
    return clean(doc)


@router.get("/work-items/{item_id}")
async def item_detail(item_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    comments = clean_many(await db.comments.find({"work_item_id": item_id}).sort("created_at", 1).to_list(500))
    attachments = clean_many(await db.attachments.find({"work_item_id": item_id, "is_deleted": {"$ne": True}}).to_list(200))
    activities = clean_many(await db.activities.find({"work_item_id": item_id}).sort("created_at", -1).to_list(60))
    board_labels = clean_many(await db.labels.find({"board_id": item["board_id"]}).to_list(200))
    lst = await db.lists.find_one({"id": item["list_id"]})
    board = await db.boards.find_one({"id": item["board_id"]})
    mirror_boards = []
    for bid in item.get("mirror_board_ids", []) or []:
        b = await db.boards.find_one({"id": bid})
        if b:
            mirror_boards.append({"id": b["id"], "name": b["name"]})
    divisions = {d["id"]: d for d in clean_many(await db.divisions.find({}).to_list(100))}
    item["division_names"] = [
        {"id": d, "name": divisions[d]["name"], "color": divisions[d]["color"]}
        for d in item.get("division_ids", []) if d in divisions
    ]
    return {
        "item": item,
        "comments": comments,
        "attachments": attachments,
        "activities": activities,
        "board_labels": board_labels,
        "list_name": lst["name"] if lst else None,
        "board_name": board["name"] if board else None,
        "mirror_boards": mirror_boards,
    }


class UpdateItemBody(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    label_ids: Optional[List[str]] = None
    needs_approval: Optional[bool] = None


@router.patch("/work-items/{item_id}")
async def update_item(item_id: str, body: UpdateItemBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    updates = {}
    data = body.model_dump()
    for field in ("title", "client_name", "description", "due_date", "needs_approval", "label_ids"):
        if data.get(field) is not None:
            updates[field] = data[field]
    if data.get("priority") is not None and data["priority"] in PRIORITIES:
        updates["priority"] = data["priority"]
    if not updates:
        return item
    updates["updated_at"] = now_iso()
    await db.work_items.update_one({"id": item_id}, {"$set": updates})
    await log_activity(item_id, item["board_id"], user, f"mengubah pekerjaan \"{item['title']}\"")
    item.update(updates)
    await broadcast_item(item)
    return item


@router.delete("/work-items/{item_id}")
async def delete_item(item_id: str, user=Depends(get_current_user)):
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Hanya admin yang dapat menghapus pekerjaan")
    item = await get_work_item(item_id)
    await db.work_items.delete_one({"id": item_id})
    await db.comments.delete_many({"work_item_id": item_id})
    await db.attachments.update_many({"work_item_id": item_id}, {"$set": {"is_deleted": True}})
    await log_activity(None, item["board_id"], user, f"menghapus pekerjaan \"{item['title']}\"")
    await broadcast_item(item)
    return {"ok": True}


class MoveBody(BaseModel):
    list_id: str
    position: float
    board_id: Optional[str] = None


@router.post("/work-items/{item_id}/move")
async def move_item(item_id: str, body: MoveBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    target_list = await db.lists.find_one({"id": body.list_id})
    if not target_list:
        raise HTTPException(404, "List tujuan tidak ditemukan")
    target_board_id = target_list["board_id"]
    target_board = await get_board(target_board_id)
    if not can_view_board(user, target_board):
        raise HTTPException(403, "Anda tidak memiliki akses ke board tujuan")
    old_list = await db.lists.find_one({"id": item["list_id"]})
    warning = None
    reqs = target_list.get("entry_requirements") or []
    if reqs and target_list["id"] != item["list_id"]:
        missing = unmet_requirements(item, reqs)
        if missing:
            if user["role"] in SUPERVISOR_ROLES:
                await log_activity(item_id, target_board_id, user,
                                   f"memindahkan \"{item['title']}\" ke {target_list['name']} tanpa syarat terpenuhi: {', '.join(missing)}")
            else:
                raise HTTPException(400, f"Syarat masuk \"{target_list['name']}\" belum terpenuhi: {', '.join(missing)}. Centang checklist syarat di kartu terlebih dahulu.")
    updates = {"list_id": body.list_id, "board_id": target_board_id, "position": body.position,
               "updated_at": now_iso(), "list_entered_at": now_iso()}
    await db.work_items.update_one({"id": item_id}, {"$set": updates})
    item.update(updates)
    if old_list and old_list["id"] != body.list_id:
        await log_activity(item_id, target_board_id, user,
                           f"memindahkan \"{item['title']}\" dari {old_list['name']} ke {target_list['name']}")
        old_name = old_list["name"].upper()
        new_name = target_list["name"].upper()
        division = None
        if target_board.get("division_id"):
            division = await db.divisions.find_one({"id": target_board["division_id"]})
        is_cs = bool(division and division.get("key") == "cs")
        if is_cs and new_name.startswith("SKOR 5") and not item.get("hari_stage"):
            await db.work_items.update_one({"id": item_id}, {"$set": {"hari_stage": 1, "hari_entered_at": now_iso()}})
            item["hari_stage"] = 1
            item["hari_entered_at"] = now_iso()
            await log_activity(item_id, target_board_id, user, f"\"{item['title']}\" masuk proses bisnis HARI 1")
        elif item.get("hari_stage") and old_name.startswith("SKOR 5") and not new_name.startswith("SKOR 5"):
            await db.work_items.update_one({"id": item_id}, {"$set": {"hari_stage": None, "hari_entered_at": None}})
            item["hari_stage"] = None
    await ensure_requirement_checklist(item, target_list)
    await run_automation(target_board_id, "card_moved", item, user, body.list_id)
    await broadcast_item(item)
    return {"ok": True, "warning": warning}


@router.post("/work-items/{item_id}/claim")
async def claim_item(item_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    members = item.get("member_ids", [])
    if user["id"] in members:
        raise HTTPException(400, "Anda sudah menjadi PIC pekerjaan ini")
    members.append(user["id"])
    await db.work_items.update_one({"id": item_id}, {"$set": {"member_ids": members, "updated_at": now_iso()}})
    await log_activity(item_id, item["board_id"], user, f"mengambil (claim) pekerjaan \"{item['title']}\"")
    await notify([item["created_by"]], "claimed", "Pekerjaan diambil",
                 f"{user['name']} mengambil pekerjaan \"{item['title']}\"",
                 item_id, item["board_id"], exclude={user["id"]})
    item["member_ids"] = members
    await broadcast_item(item)
    return {"ok": True, "member_ids": members}


@router.post("/work-items/{item_id}/release")
async def release_item(item_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    members = [m for m in item.get("member_ids", []) if m != user["id"]]
    await db.work_items.update_one({"id": item_id}, {"$set": {"member_ids": members, "updated_at": now_iso()}})
    await log_activity(item_id, item["board_id"], user, f"melepas pekerjaan \"{item['title']}\"")
    item["member_ids"] = members
    await broadcast_item(item)
    return {"ok": True, "member_ids": members}


class AssignBody(BaseModel):
    add_user_ids: List[str] = Field(default_factory=list)
    remove_user_ids: List[str] = Field(default_factory=list)
    add_division_ids: List[str] = Field(default_factory=list)
    remove_division_ids: List[str] = Field(default_factory=list)


@router.post("/work-items/{item_id}/assign")
async def assign_item(item_id: str, body: AssignBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    if body.remove_user_ids and user["role"] not in SUPERVISOR_ROLES and set(body.remove_user_ids) != {user["id"]}:
        raise HTTPException(403, "Hanya supervisor yang dapat menghapus PIC lain")
    members = list(item.get("member_ids", []))
    for uid in body.add_user_ids:
        if uid not in members:
            members.append(uid)
    members = [m for m in members if m not in body.remove_user_ids]
    divisions = list(item.get("division_ids", []))
    for did in body.add_division_ids:
        if did not in divisions:
            divisions.append(did)
    divisions = [d for d in divisions if d not in body.remove_division_ids]
    await db.work_items.update_one({"id": item_id},
        {"$set": {"member_ids": members, "division_ids": divisions, "updated_at": now_iso()}})
    if body.add_user_ids:
        await log_activity(item_id, item["board_id"], user, f"menugaskan PIC pada \"{item['title']}\"")
        await notify(body.add_user_ids, "assigned", "Anda ditugaskan",
                     f"{user['name']} menugaskan Anda pada \"{item['title']}\"",
                     item_id, item["board_id"], exclude={user["id"]})
    if body.add_division_ids:
        await log_activity(item_id, item["board_id"], user, f"menambahkan divisi pada \"{item['title']}\"")
    item["member_ids"] = members
    item["division_ids"] = divisions
    await broadcast_item(item)
    return {"ok": True, "member_ids": members, "division_ids": divisions}


@router.post("/work-items/{item_id}/submit")
async def submit_item(item_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    if item.get("status") == "done":
        raise HTTPException(400, "Pekerjaan sudah selesai")
    if item.get("needs_approval"):
        await db.work_items.update_one({"id": item_id},
            {"$set": {"status": "submitted", "submitted_by": user["id"], "updated_at": now_iso()}})
        await log_activity(item_id, item["board_id"], user, f"mengajukan penyelesaian \"{item['title']}\"")
        approvers = await db.users.find({
            "$or": [
                {"role": {"$in": ["super_admin", "admin"]}},
                {"role": "supervisor", "division_id": {"$in": item.get("division_ids", [])}},
            ], "is_active": {"$ne": False}
        }).to_list(50)
        await notify([u["id"] for u in approvers], "approval", "Butuh persetujuan",
                     f"{user['name']} mengajukan penyelesaian \"{item['title']}\"",
                     item_id, item["board_id"], exclude={user["id"]})
    else:
        await db.work_items.update_one({"id": item_id},
            {"$set": {"status": "done", "completed_at": now_iso(), "updated_at": now_iso()}})
        await log_activity(item_id, item["board_id"], user, f"menyelesaikan pekerjaan \"{item['title']}\"")
    item = await get_work_item(item_id)
    await broadcast_item(item)
    return item


@router.post("/work-items/{item_id}/approve")
async def approve_item(item_id: str, user=Depends(get_current_user)):
    require_supervisor(user)
    item = await get_item_checked(item_id, user)
    if item.get("status") != "submitted":
        raise HTTPException(400, "Pekerjaan tidak sedang menunggu persetujuan")
    await db.work_items.update_one({"id": item_id},
        {"$set": {"status": "done", "completed_at": now_iso(), "approved_by": user["id"], "updated_at": now_iso()}})
    await log_activity(item_id, item["board_id"], user, f"menyetujui penyelesaian \"{item['title']}\"")
    await notify(item.get("member_ids", []) + [item["created_by"]], "approved", "Pekerjaan disetujui",
                 f"{user['name']} menyetujui penyelesaian \"{item['title']}\"",
                 item_id, item["board_id"], exclude={user["id"]})
    item = await get_work_item(item_id)
    await broadcast_item(item)
    return item


@router.post("/work-items/{item_id}/reopen")
async def reopen_item(item_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    await db.work_items.update_one({"id": item_id},
        {"$set": {"status": "active", "completed_at": None, "approved_by": None, "updated_at": now_iso()}})
    await log_activity(item_id, item["board_id"], user, f"membuka kembali pekerjaan \"{item['title']}\"")
    item = await get_work_item(item_id)
    await broadcast_item(item)
    return item


@router.post("/work-items/{item_id}/archive")
async def archive_item(item_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    await db.work_items.update_one({"id": item_id}, {"$set": {"archived": True, "updated_at": now_iso()}})
    await log_activity(item_id, item["board_id"], user, f"mengarsipkan \"{item['title']}\"")
    await broadcast_item(item)
    return {"ok": True}


@router.post("/work-items/{item_id}/unarchive")
async def unarchive_item(item_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    await db.work_items.update_one({"id": item_id}, {"$set": {"archived": False, "updated_at": now_iso()}})
    await log_activity(item_id, item["board_id"], user, f"mengembalikan \"{item['title']}\" dari arsip")
    await broadcast_item(item)
    return {"ok": True}


class MirrorBody(BaseModel):
    board_id: str


@router.post("/work-items/{item_id}/mirror")
async def mirror_item(item_id: str, body: MirrorBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    target = await get_board(body.board_id)
    if not can_view_board(user, target):
        raise HTTPException(403, "Anda tidak memiliki akses ke board tujuan")
    mirrors = item.get("mirror_board_ids", []) or []
    if body.board_id in mirrors or body.board_id == item["board_id"]:
        raise HTTPException(400, "Pekerjaan sudah ada di board tersebut")
    mirrors.append(body.board_id)
    await db.work_items.update_one({"id": item_id}, {"$set": {"mirror_board_ids": mirrors, "updated_at": now_iso()}})
    item["mirror_board_ids"] = mirrors
    await log_activity(item_id, item["board_id"], user, f"me-mirror \"{item['title']}\" ke board {target['name']}")
    await run_automation(body.board_id, "card_mirrored", item, user)
    await broadcast_item(item)
    return {"ok": True, "mirror_board_ids": mirrors}


@router.post("/work-items/{item_id}/unmirror")
async def unmirror_item(item_id: str, body: MirrorBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    mirrors = [b for b in (item.get("mirror_board_ids") or []) if b != body.board_id]
    await db.work_items.update_one({"id": item_id}, {"$set": {"mirror_board_ids": mirrors, "updated_at": now_iso()}})
    item["mirror_board_ids"] = mirrors
    target = await db.boards.find_one({"id": body.board_id})
    await log_activity(item_id, item["board_id"], user,
                       f"menghapus mirror \"{item['title']}\" dari board {target['name'] if target else body.board_id}")
    await run_automation(body.board_id, "mirror_removed", item, user)
    await broadcast_item(item)
    return {"ok": True, "mirror_board_ids": mirrors}


# ---------- CHECKLISTS ----------

class ChecklistBody(BaseModel):
    title: str


@router.post("/work-items/{item_id}/checklists")
async def add_checklist(item_id: str, body: ChecklistBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    checklists = item.get("checklists", [])
    checklists.append({"id": new_id(), "title": body.title.strip(), "items": []})
    await db.work_items.update_one({"id": item_id}, {"$set": {"checklists": checklists, "updated_at": now_iso()}})
    await log_activity(item_id, item["board_id"], user, f"menambahkan checklist \"{body.title}\"")
    await broadcast_item(item)
    return {"ok": True, "checklists": checklists}


@router.delete("/work-items/{item_id}/checklists/{cl_id}")
async def delete_checklist(item_id: str, cl_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    checklists = [c for c in item.get("checklists", []) if c["id"] != cl_id]
    await db.work_items.update_one({"id": item_id}, {"$set": {"checklists": checklists, "updated_at": now_iso()}})
    await broadcast_item(item)
    return {"ok": True}


class ChecklistItemBody(BaseModel):
    text: str


@router.post("/work-items/{item_id}/checklists/{cl_id}/items")
async def add_checklist_item(item_id: str, cl_id: str, body: ChecklistItemBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    checklists = item.get("checklists", [])
    for c in checklists:
        if c["id"] == cl_id:
            c["items"].append({"id": new_id(), "text": body.text.strip(), "done": False})
    await db.work_items.update_one({"id": item_id}, {"$set": {"checklists": checklists, "updated_at": now_iso()}})
    await broadcast_item(item)
    return {"ok": True, "checklists": checklists}


class ChecklistItemUpdate(BaseModel):
    done: Optional[bool] = None
    text: Optional[str] = None


@router.patch("/work-items/{item_id}/checklists/{cl_id}/items/{sub_id}")
async def update_checklist_item(item_id: str, cl_id: str, sub_id: str, body: ChecklistItemUpdate, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    checklists = item.get("checklists", [])
    for c in checklists:
        if c["id"] == cl_id:
            for it in c["items"]:
                if it["id"] == sub_id:
                    if body.done is not None:
                        it["done"] = body.done
                    if body.text is not None:
                        it["text"] = body.text.strip()
    await db.work_items.update_one({"id": item_id}, {"$set": {"checklists": checklists, "updated_at": now_iso()}})
    await broadcast_item(item)
    return {"ok": True, "checklists": checklists}


@router.delete("/work-items/{item_id}/checklists/{cl_id}/items/{sub_id}")
async def delete_checklist_item(item_id: str, cl_id: str, sub_id: str, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    checklists = item.get("checklists", [])
    for c in checklists:
        if c["id"] == cl_id:
            c["items"] = [it for it in c["items"] if it["id"] != sub_id]
    await db.work_items.update_one({"id": item_id}, {"$set": {"checklists": checklists, "updated_at": now_iso()}})
    await broadcast_item(item)
    return {"ok": True}


# ---------- COMMENTS ----------

class CommentBody(BaseModel):
    text: str


@router.post("/work-items/{item_id}/comments")
async def add_comment(item_id: str, body: CommentBody, user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    if not body.text.strip():
        raise HTTPException(400, "Komentar kosong")
    all_users = await db.users.find({"is_active": {"$ne": False}}).to_list(500)
    mentioned = []
    tokens = re.findall(r"@([\w\.]+)", body.text)
    for u in all_users:
        first = u["name"].split()[0].lower()
        if any(first == t.lower() for t in tokens):
            mentioned.append(u["id"])
    doc = {
        "id": new_id(),
        "work_item_id": item_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "avatar_color": user.get("avatar_color", "#0C66E4"),
        "text": body.text.strip(),
        "mentions": mentioned,
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    await log_activity(item_id, item["board_id"], user, f"berkomentar di \"{item['title']}\"")
    targets = set(item.get("member_ids", []) + [item["created_by"]] + mentioned)
    await notify(list(targets), "comment", "Komentar baru",
                 f"{user['name']}: {body.text.strip()[:80]}",
                 item_id, item["board_id"], exclude={user["id"]})
    await broadcast_item(item)
    return clean(doc)


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user=Depends(get_current_user)):
    c = await db.comments.find_one({"id": comment_id})
    if not c:
        raise HTTPException(404, "Komentar tidak ditemukan")
    if c["user_id"] != user["id"] and user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Tidak dapat menghapus komentar orang lain")
    await db.comments.delete_one({"id": comment_id})
    item = await db.work_items.find_one({"id": c["work_item_id"]})
    if item:
        await broadcast_item(clean(item))
    return {"ok": True}


# ---------- ATTACHMENTS ----------

@router.post("/work-items/{item_id}/attachments")
async def upload_attachment(item_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    item = await get_item_checked(item_id, user)
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(400, "Ukuran file maksimal 15MB")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"ali-workspace/uploads/{item_id}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
    except Exception as e:
        raise HTTPException(500, f"Gagal mengunggah file: {e}")
    doc = {
        "id": new_id(),
        "work_item_id": item_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.attachments.insert_one(doc)
    await log_activity(item_id, item["board_id"], user, f"mengunggah lampiran {file.filename}")
    await broadcast_item(item)
    return clean(doc)


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(attachment_id: str, user=Depends(get_current_user)):
    rec = await db.attachments.find_one({"id": attachment_id, "is_deleted": {"$ne": True}})
    if not rec:
        raise HTTPException(404, "File tidak ditemukan")
    try:
        content, content_type = get_object(rec["storage_path"])
    except Exception:
        raise HTTPException(404, "File tidak tersedia di storage")
    filename = rec["original_filename"].replace('"', "")
    return Response(
        content=content,
        media_type=rec.get("content_type") or content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.delete("/attachments/{attachment_id}")
async def delete_attachment(attachment_id: str, user=Depends(get_current_user)):
    rec = await db.attachments.find_one({"id": attachment_id})
    if not rec:
        raise HTTPException(404, "File tidak ditemukan")
    if rec["uploaded_by"] != user["id"] and user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Tidak dapat menghapus lampiran orang lain")
    await db.attachments.update_one({"id": attachment_id}, {"$set": {"is_deleted": True}})
    item = await db.work_items.find_one({"id": rec["work_item_id"]})
    if item:
        await broadcast_item(clean(item))
    return {"ok": True}


# ---------- NOTIFICATIONS ----------

@router.get("/notifications/mine")
async def my_notifications(user=Depends(get_current_user)):
    items = clean_many(await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).to_list(30))
    unread = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"items": items, "unread": unread}


@router.post("/notifications/read-all")
async def read_all_notifications(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


@router.post("/notifications/{notif_id}/read")
async def read_notification(notif_id: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


# ---------- VIEWS ----------

async def enrich_items(items):
    board_ids = {i["board_id"] for i in items}
    list_ids = {i["list_id"] for i in items}
    boards = {b["id"]: b for b in await db.boards.find({"id": {"$in": list(board_ids)}}).to_list(500)}
    lists = {l["id"]: l for l in await db.lists.find({"id": {"$in": list(list_ids)}}).to_list(500)}
    for i in items:
        i["board_name"] = boards.get(i["board_id"], {}).get("name")
        i["board_background"] = boards.get(i["board_id"], {}).get("background")
        i["list_name"] = lists.get(i["list_id"], {}).get("name")
    return items


@router.get("/my-work")
async def my_work(user=Depends(get_current_user)):
    items = clean_many(await db.work_items.find(
        {"member_ids": user["id"], "archived": {"$ne": True}}
    ).sort("due_date", 1).to_list(500))
    return await enrich_items(items)


@router.get("/work-items")
async def all_work(q: Optional[str] = None, division_id: Optional[str] = None,
                   status: Optional[str] = None, user=Depends(get_current_user)):
    require_supervisor(user)
    filt = {"archived": {"$ne": True}}
    if division_id:
        filt["division_ids"] = division_id
    if status:
        filt["status"] = status
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        filt["$or"] = [{"title": rx}, {"client_name": rx}]
    items = clean_many(await db.work_items.find(filt).sort("updated_at", -1).to_list(300))
    return await enrich_items(items)


@router.get("/search")
async def search(q: str, user=Depends(get_current_user)):
    rx = {"$regex": re.escape(q), "$options": "i"}
    boards = clean_many(await db.boards.find({"name": rx, "is_archived": {"$ne": True}}).to_list(10))
    boards = [b for b in boards if can_view_board(user, b)]
    items = clean_many(await db.work_items.find(
        {"$or": [{"title": rx}, {"client_name": rx}], "archived": {"$ne": True}}
    ).to_list(20))
    visible = []
    board_cache = {}
    for i in items:
        bid = i["board_id"]
        if bid not in board_cache:
            board_cache[bid] = await db.boards.find_one({"id": bid})
        b = board_cache[bid]
        if b and can_view_board(user, clean(b)):
            visible.append(i)
    return {"boards": boards, "items": visible[:10]}


# ---------- HARI (PROSES BISNIS 1-7) ----------

class HariBody(BaseModel):
    target_stage: int


@router.post("/work-items/{item_id}/hari")
async def move_hari(item_id: str, body: HariBody, user=Depends(get_current_user)):
    item = await get_work_item(item_id)
    board = await get_board(item["board_id"])
    if not (can_view_board(user, board) or await can_access_hari(user)):
        raise HTTPException(403, "Anda tidak memiliki akses ke proses harian ini")
    current = item.get("hari_stage")
    if not current:
        raise HTTPException(400, "Pekerjaan ini tidak sedang dalam proses harian (HARI 1-7)")
    target = body.target_stage
    if target < 1 or target > 8:
        raise HTTPException(400, "Tahap tidak valid (1-7, atau 8 untuk Finish)")
    warning = None
    if target > current:
        gates = []
        for stage, reqs in STAGE_GATES.items():
            if current < stage <= target:
                gates.extend(reqs)
        missing = unmet_requirements(item, gates)
        if missing:
            if user["role"] in SUPERVISOR_ROLES:
                await log_activity(item_id, item["board_id"], user,
                                   f"memajukan \"{item['title']}\" ke HARI {min(target, 7) if target <= 7 else 'FINISH'} tanpa syarat terpenuhi: {', '.join(missing)}")
            else:
                raise HTTPException(400, f"Syarat belum terpenuhi: {', '.join(missing)}. Centang checklist syarat di kartu terlebih dahulu.")
        if not any("logo" in t for t in done_checklist_texts(item)):
            warning = "Dokumen LOGO belum ada — pekerjaan tetap dilanjutkan, mohon segera dilengkapi."
    if target == 8:
        lists = await db.lists.find({"board_id": item["board_id"]}).sort("position", 1).to_list(100)
        finish_list = next((l for l in lists if l["name"].upper().startswith("SKOR 6")), None)
        updates = {"hari_stage": None, "hari_entered_at": None, "status": "done",
                   "completed_at": now_iso(), "updated_at": now_iso()}
        if finish_list and finish_list["id"] != item["list_id"]:
            updates["list_id"] = finish_list["id"]
            updates["list_entered_at"] = now_iso()
        await db.work_items.update_one({"id": item_id}, {"$set": updates})
        await log_activity(item_id, item["board_id"], user, f"menyelesaikan proses harian \"{item['title']}\" (FINISH)")
    else:
        await db.work_items.update_one({"id": item_id},
            {"$set": {"hari_stage": target, "hari_entered_at": now_iso(), "updated_at": now_iso()}})
        await log_activity(item_id, item["board_id"], user, f"memajukan \"{item['title']}\" ke HARI {target}")
    item = await get_work_item(item_id)
    await broadcast_item(item)
    return {"ok": True, "warning": warning, "hari_stage": item.get("hari_stage")}


def _days_since(iso_str):
    if not iso_str:
        return 0
    from datetime import datetime, timezone
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except Exception:
        return 0


@router.get("/global/hari")
async def global_hari(user=Depends(get_current_user)):
    if not await can_access_hari(user):
        raise HTTPException(403, "Halaman ini hanya untuk tim Admin Draf, Pajak, Perizinan, Desain, dan admin")
    items = clean_many(await db.work_items.find(
        {"hari_stage": {"$gte": 1, "$lte": 7}, "archived": {"$ne": True}, "status": {"$ne": "done"}}
    ).to_list(1000))
    await enrich_items(items)
    for i in items:
        i["days_in_stage"] = _days_since(i.get("hari_entered_at"))
        i["is_stalled"] = i["days_in_stage"] >= 2
    return items


@router.get("/global/skor")
async def global_skor(user=Depends(get_current_user)):
    allowed = user["role"] in SUPERVISOR_ROLES
    div = await user_division(user)
    if div and div.get("key") == "cs":
        allowed = True
    if not allowed:
        raise HTTPException(403, "Halaman ini hanya untuk tim CS, supervisor, dan admin")
    divisions = clean_many(await db.divisions.find({}).to_list(100))
    key_by_id = {d["id"]: d.get("key") for d in divisions}
    boards = clean_many(await db.boards.find({"is_archived": {"$ne": True}}).to_list(500))
    board_map = {b["id"]: b for b in boards}
    lists = clean_many(await db.lists.find({}).to_list(1000))
    list_map = {l["id"]: l for l in lists}
    items = clean_many(await db.work_items.find({"archived": {"$ne": True}}).to_list(3000))
    buckets = {str(n): [] for n in range(1, 7)}
    for item in items:
        lst = list_map.get(item["list_id"])
        board = board_map.get(item["board_id"])
        if not lst or not board:
            continue
        lname = lst["name"].upper()
        dkey = key_by_id.get(board.get("division_id"))
        bucket = None
        if item.get("status") == "done" or lname.startswith("SKOR 6"):
            bucket = "6"
        elif item.get("hari_stage") or (dkey == "cs" and lname.startswith("SKOR 5")):
            bucket = "5"
        elif dkey == "cs" and lname.startswith("SKOR 4"):
            bucket = "4"
        elif dkey == "draf" and lname in ("FU NOTARIS", "SIAP KIRIM NOTARIS", "VIA WA/GC ADMIN"):
            bucket = "3"
        elif dkey == "cs" and lname.startswith("SKOR 3"):
            bucket = "3"
        elif dkey == "draf" and lname in ("PRATINJAU", "PESAN NAMA", "INPUTAN"):
            bucket = "2"
        elif dkey == "cs" and (lname.startswith("SKOR 1") or lname.startswith("SKOR 2")):
            bucket = "1"
        if bucket:
            item["board_name"] = board["name"]
            item["board_background"] = board.get("background")
            item["list_name"] = lst["name"]
            item["days_in_stage"] = _days_since(item.get("list_entered_at") or item.get("hari_entered_at"))
            item["is_stalled"] = item["days_in_stage"] >= 3
            buckets[bucket].append(item)
    return buckets


# ---------- BANK DATA ----------

@router.get("/bank-data/{division_id}")
async def bank_data(division_id: str, user=Depends(get_current_user)):
    division = await db.divisions.find_one({"id": division_id})
    if not division:
        raise HTTPException(404, "Divisi tidak ditemukan")
    boards = clean_many(await db.boards.find({"division_id": division_id, "is_archived": {"$ne": True}}).to_list(50))
    board_ids = [b["id"] for b in boards]
    lists = clean_many(await db.lists.find({"board_id": {"$in": board_ids}}).sort("position", 1).to_list(500))
    list_map = {l["id"]: l for l in lists}
    board_map = {b["id"]: b for b in boards}
    for b in boards:
        b["lists"] = [l for l in lists if l["board_id"] == b["id"]]
    items = clean_many(await db.work_items.find({
        "archived": {"$ne": True},
        "$or": [{"division_ids": division_id}, {"board_id": {"$in": board_ids}}],
    }).sort("updated_at", -1).to_list(500))
    for i in items:
        i["board_name"] = board_map.get(i["board_id"], {}).get("name")
        i["board_background"] = board_map.get(i["board_id"], {}).get("background")
        i["list_name"] = list_map.get(i["list_id"], {}).get("name")
    members = [public_user(u) for u in await db.users.find({"division_id": division_id, "is_active": {"$ne": False}}).to_list(200)]
    workload = []
    for m in members:
        mine = [i for i in items if m["id"] in (i.get("member_ids") or []) and i.get("status") != "done"]
        by_list = {}
        for i in mine:
            lname = i.get("list_name") or "?"
            by_list[lname] = by_list.get(lname, 0) + 1
        workload.append({"user": m, "total": len(mine), "by_list": by_list})
    return {"division": clean(division), "boards": boards, "items": items, "workload": workload}
