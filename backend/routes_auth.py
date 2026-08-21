from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Response, Request, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from deps import (
    db, now_iso, verify_password, hash_password, create_access_token,
    create_refresh_token, public_user, get_current_user, ACCESS_MINUTES,
    jwt_secret, JWT_ALGORITHM,
)
import jwt

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str


def set_cookies(response: Response, user: dict) -> str:
    access = create_access_token(user)
    refresh = create_refresh_token(user["id"])
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=ACCESS_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return access


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": key})
    if attempt and attempt.get("count", 0) >= 5:
        last = datetime.fromisoformat(attempt["last_at"])
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < last + timedelta(minutes=15):
            raise HTTPException(429, "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        await db.login_attempts.update_one(
            {"identifier": key},
            {"$inc": {"count": 1}, "$set": {"last_at": now_iso()}},
            upsert=True,
        )
        raise HTTPException(401, "Email atau kata sandi salah")
    if not user.get("is_active", True):
        raise HTTPException(403, "Akun Anda dinonaktifkan. Hubungi admin.")
    await db.login_attempts.delete_one({"identifier": key})
    token = set_cookies(response, user)
    return {"user": public_user(user), "token": token}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "Tidak ada refresh token")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Token tidak valid")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("is_active", True):
        raise HTTPException(401, "Pengguna tidak ditemukan")
    access = set_cookies(response, user)
    return {"user": public_user(user), "token": access}


@router.post("/change-password")
async def change_password(body: ChangePasswordBody, user=Depends(get_current_user)):
    if not verify_password(body.old_password, user.get("password_hash", "")):
        raise HTTPException(400, "Kata sandi lama salah")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Kata sandi baru minimal 6 karakter")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}
