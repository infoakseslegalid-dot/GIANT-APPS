import os
import logging

import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware

from deps import db, client, ws_manager, jwt_secret, JWT_ALGORITHM
from storage import init_storage
from routes_auth import router as auth_router
from routes_admin import router as admin_router
from routes_work import router as work_router
from seed import seed_admin, seed_demo

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ali.server")

app = FastAPI(title="ALI Workspace")

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(work_router, prefix="/api")


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.cookies.get("access_token") or websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise ValueError("bad type")
    except Exception:
        await websocket.close(code=4401)
        return
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        ws_manager.disconnect(websocket)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.work_items.create_index("board_id")
    await db.work_items.create_index("list_id")
    await db.work_items.create_index("member_ids")
    await db.notifications.create_index("user_id")
    await db.activities.create_index("work_item_id")
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await seed_admin()
    await seed_demo()
    logger.info("Seeding complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@app.get("/api/")
async def root():
    return {"message": "ALI Workspace API"}
