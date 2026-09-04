// @ts-nocheck
import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';

import {
    db,
    nowIso,
    verifyPassword,
    hashPassword,
    createAccessToken,
    createRefreshToken,
    publicUser,
    getCurrentUser,
    ACCESS_MINUTES,
    jwtSecret,
    JWT_ALGORITHM,
} from './deps';

const authApp = new Hono();

const COOKIE_SECURE = (process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
const COOKIE_SAMESITE = COOKIE_SECURE ? "None" : "Lax";

function setCookies(c: any, user: any): string {
    const access = createAccessToken(user);
    const refresh = createRefreshToken(user.id);
    
    setCookie(c, "access_token", access, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAMESITE,
        maxAge: ACCESS_MINUTES * 60,
        path: "/",
    });
    
    setCookie(c, "refresh_token", refresh, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAMESITE,
        maxAge: 604800,
        path: "/",
    });
    
    return access;
}

authApp.post('/login', async (c) => {
    const body = await c.req.json();
    const email = (body.email || "").toLowerCase().trim();
    
    const ipHeader = c.req.header('x-forwarded-for') || "unknown";
    const ip = ipHeader.split(',')[0].trim();
    const key = `${ip}:${email}`;
    
    const attempt = await db.loginAttempt.findUnique({ where: { identifier: key } });
    if (attempt && attempt.count >= 5) {
        const last = new Date(attempt.lastAt);
        if (new Date().getTime() < last.getTime() + 15 * 60 * 1000) {
            throw new HTTPException(429, { message: "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit." });
        }
    }
    
    const user = await db.user.findUnique({ where: { email } });
    
    if (!user || !verifyPassword(body.password, user.passwordHash || "")) {
        await db.loginAttempt.upsert({
            where: { identifier: key },
            update: {
                count: { increment: 1 },
                lastAt: new Date()
            },
            create: {
                identifier: key,
                count: 1,
                lastAt: new Date()
            }
        });
        throw new HTTPException(401, { message: "Email atau kata sandi salah" });
    }
    
    if (user.isActive === false) {
        throw new HTTPException(403, { message: "Akun Anda dinonaktifkan. Hubungi admin." });
    }
    
    await db.loginAttempt.deleteMany({ where: { identifier: key } });
    const token = setCookies(c, user);
    
    return c.json({ user: publicUser(user), token });
});

authApp.get('/me', async (c) => {
    const user = await getCurrentUser(c);
    return c.json(publicUser(user));
});

// Setiap user boleh mengubah profilnya sendiri (nama & warna avatar).
authApp.patch('/me', async (c) => {
    const user = await getCurrentUser(c);
    const body = await c.req.json();
    const data: any = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.avatar_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.avatar_color)) data.avatarColor = body.avatar_color;
    if (['light', 'dark', 'system'].includes(body.theme)) data.theme = body.theme;
    if (['id', 'en'].includes(body.locale)) data.locale = body.locale;
    if (Object.keys(data).length === 0) return c.json({ error: 'Tidak ada perubahan' }, 400);
    const updated = await db.user.update({ where: { id: user.id }, data });
    return c.json(publicUser(updated));
});

authApp.post('/logout', async (c) => {
    deleteCookie(c, "access_token", { path: "/", sameSite: COOKIE_SAMESITE as any, secure: COOKIE_SECURE });
    deleteCookie(c, "refresh_token", { path: "/", sameSite: COOKIE_SAMESITE as any, secure: COOKIE_SECURE });
    return c.json({ ok: true });
});

authApp.post('/refresh', async (c) => {
    const token = getCookie(c, "refresh_token");
    if (!token) {
        throw new HTTPException(401, { message: "Tidak ada refresh token" });
    }
    try {
        const payload: any = jwt.verify(token, jwtSecret(), { algorithms: [JWT_ALGORITHM as any] });
        if (payload.type !== "refresh") {
            throw new HTTPException(401, { message: "Token tidak valid" });
        }
        const user = await db.user.findUnique({ where: { id: payload.sub as string } });
        if (!user || user.isActive === false) {
            throw new HTTPException(401, { message: "Pengguna tidak ditemukan" });
        }
        const access = setCookies(c, user);
        return c.json({ user: publicUser(user), token: access });
    } catch (e) {
        throw new HTTPException(401, { message: "Token tidak valid" });
    }
});

authApp.post('/change-password', async (c) => {
    const user = await getCurrentUser(c);
    const body = await c.req.json();
    
    if (!verifyPassword(body.old_password, user.passwordHash || "")) {
        throw new HTTPException(400, { message: "Kata sandi lama salah" });
    }
    
    if (!body.new_password || body.new_password.length < 6) {
        throw new HTTPException(400, { message: "Kata sandi baru minimal 6 karakter" });
    }
    
    await db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(body.new_password) }
    });
    
    return c.json({ ok: true });
});

export { authApp };
