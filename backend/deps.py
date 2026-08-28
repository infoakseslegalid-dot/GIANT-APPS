import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import HTTPException, Request, WebSocket
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("ali")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
ACCESS_MINUTES = 60 * 12

ADMIN_ROLES = {"super_admin", "admin"}
SUPERVISOR_ROLES = {"super_admin", "admin", "supervisor"}

ROLE_LABELS = {
    "super_admin": "Super Admin",
    "admin": "Admin",
    "supervisor": "Supervisor",
    "staff": "Staff",
    "viewer": "Viewer",
}

DISTRIBUTION_STATUSES = ("MENUNGGU_DIAMBIL", "DIAMBIL", "DILEPASKAN", "DIRECT_ASSIGNED")
WORK_STATUSES = ("BARU", "PROSES", "MENUNGGU", "REVISI", "SELESAI")

def is_done_status(status: Optional[str]) -> bool:
    return str(status or "").upper() in ("SELESAI", "DONE")

def is_submitted_status(status: Optional[str]) -> bool:
    return str(status or "").upper() in ("MENUNGGU", "SUBMITTED")

def is_active_status(status: Optional[str]) -> bool:
    return str(status or "").upper() in ("BARU", "PROSES", "REVISI", "ACTIVE")


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["name"],
        "email": u["email"],
        "role": u["role"],
        "division_id": u.get("division_id"),
        "avatar_color": u.get("avatar_color", "#0C66E4"),
        "is_active": u.get("is_active", True),
    }


def clean(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def clean_many(docs) -> list:
    return [clean(d) for d in docs]


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Belum masuk. Silakan login.")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Token tidak valid")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("is_active", True):
        raise HTTPException(401, "Pengguna tidak ditemukan atau dinonaktifkan")
    return user


def require_admin(user: dict):
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Hanya admin yang dapat melakukan ini")


def require_supervisor(user: dict):
    if user["role"] not in SUPERVISOR_ROLES:
        raise HTTPException(403, "Membutuhkan peran supervisor atau admin")


class WSManager:
    def __init__(self):
        self.conns: set = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.conns.add(ws)

    def disconnect(self, ws: WebSocket):
        self.conns.discard(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in list(self.conns):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.conns.discard(ws)


ws_manager = WSManager()


async def log_activity(work_item_id, board_id, user, action, detail=None):
    doc = {
        "id": new_id(),
        "work_item_id": work_item_id,
        "board_id": board_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "action": action,
        "detail": detail or {},
        "created_at": now_iso(),
    }
    await db.activities.insert_one(doc)
    await ws_manager.broadcast(
        {"type": "activity", "work_item_id": work_item_id, "board_id": board_id}
    )


async def notify(user_ids, ntype, title, body, work_item_id=None, board_id=None, exclude=None):
    exclude = exclude or set()
    for uid in set(user_ids or []):
        if not uid or uid in exclude:
            continue
        doc = {
            "id": new_id(),
            "user_id": uid,
            "type": ntype,
            "title": title,
            "body": body,
            "work_item_id": work_item_id,
            "board_id": board_id,
            "is_read": False,
            "created_at": now_iso(),
        }
        await db.notifications.insert_one(doc)
        await ws_manager.broadcast({"type": "notification", "user_id": uid, "title": title})


async def broadcast_board(board_id, work_item_id=None):
    await ws_manager.broadcast(
        {"type": "board_update", "board_id": board_id, "work_item_id": work_item_id}
    )


async def broadcast_item(item: dict):
    boards = {item.get("board_id")}
    for b in item.get("mirror_board_ids", []) or []:
        boards.add(b)
    for b in boards:
        if b:
            await broadcast_board(b, item["id"])


async def get_board(board_id: str) -> dict:
    b = await db.boards.find_one({"id": board_id})
    if not b:
        raise HTTPException(404, "Board tidak ditemukan")
    return clean(b)


def can_view_board(user: dict, board: dict) -> bool:
    if user["role"] in ADMIN_ROLES:
        return True
    if user["id"] in (board.get("member_ids") or []):
        return True
    if board.get("division_id") and board.get("division_id") == user.get("division_id"):
        return True
    return False


async def get_work_item(item_id: str) -> dict:
    it = await db.work_items.find_one({"id": item_id})
    if not it:
        raise HTTPException(404, "Pekerjaan tidak ditemukan")
    return clean(it)


async def run_automation(board_id: str, trigger: str, item: dict, actor: dict, context_list_id: str = None):
    rules = await db.automation_rules.find({"board_id": board_id, "trigger": trigger}).to_list(100)
    if not rules:
        return
    changed = False
    logs = []
    for rule in rules:
        if trigger == "card_moved" and rule.get("trigger_list_id") and rule["trigger_list_id"] != context_list_id:
            continue
        action = rule.get("action")
        value = rule.get("action_value")
        if action == "add_label" and value and value not in item.get("label_ids", []):
            item.setdefault("label_ids", []).append(value)
            changed = True
            logs.append("menambahkan label")
        elif action == "remove_label" and value and value in item.get("label_ids", []):
            item["label_ids"] = [l for l in item["label_ids"] if l != value]
            changed = True
            logs.append("menghapus label")
        elif action == "set_priority" and value and item.get("priority") != value:
            item["priority"] = value
            changed = True
            logs.append(f"mengubah prioritas menjadi {value}")
        elif action == "assign_division" and value and value not in item.get("division_ids", []):
            item.setdefault("division_ids", []).append(value)
            changed = True
            logs.append("menambahkan divisi")
    if changed:
        item["updated_at"] = now_iso()
        await db.work_items.update_one(
            {"id": item["id"]},
            {"$set": {
                "label_ids": item.get("label_ids", []),
                "priority": item.get("priority", "none"),
                "division_ids": item.get("division_ids", []),
                "updated_at": item["updated_at"],
            }},
        )
        for text in logs:
            await log_activity(item["id"], board_id, actor, f"Otomatisasi {text}")
        await broadcast_item(item)
