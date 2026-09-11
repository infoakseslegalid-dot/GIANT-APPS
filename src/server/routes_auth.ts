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
import { can } from './permissions';
import { putObject } from './storage';
import { v4 as uuidv4 } from 'uuid';

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

/**
 * Ubah profil sendiri. Nama / email / avatar masing-masing dijaga izinnya
 * (`profile.*`), yang bisa diatur per peran MAUPUN per divisi di Hak Akses.
 * Tema & bahasa adalah preferensi tampilan pribadi — selalu boleh.
 */
authApp.patch('/me', async (c) => {
    const user = await getCurrentUser(c);
    const body = await c.req.json();
    const data: any = {};

    if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== user.name) {
        if (!(await can(user, 'profile.edit_name'))) {
            throw new HTTPException(403, { message: 'Anda tidak diizinkan mengubah nama sendiri. Hubungi admin.' });
        }
        data.name = body.name.trim();
    }

    if (typeof body.email === 'string' && body.email.trim().toLowerCase() !== user.email) {
        if (!(await can(user, 'profile.edit_email'))) {
            throw new HTTPException(403, { message: 'Anda tidak diizinkan mengubah email sendiri. Hubungi admin.' });
        }
        const email = body.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new HTTPException(400, { message: 'Format email tidak valid' });
        }
        const taken = await db.user.findFirst({ where: { email, id: { not: user.id } } });
        if (taken) throw new HTTPException(400, { message: 'Email sudah dipakai pengguna lain' });
        data.email = email;
    }

    if (typeof body.avatar_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.avatar_color) && body.avatar_color !== user.avatarColor) {
        if (!(await can(user, 'profile.edit_photo'))) {
            throw new HTTPException(403, { message: 'Anda tidak diizinkan mengubah avatar sendiri. Hubungi admin.' });
        }
        data.avatarColor = body.avatar_color;
    }

    if (['light', 'dark', 'system'].includes(body.theme)) data.theme = body.theme;
    if (['id', 'en'].includes(body.locale)) data.locale = body.locale;
    if (Object.keys(data).length === 0) return c.json(publicUser(user));
    const updated = await db.user.update({ where: { id: user.id }, data });
    return c.json(publicUser(updated));
});

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

authApp.post('/me/avatar', async (c) => {
    const user = await getCurrentUser(c);
    if (!(await can(user, 'profile.edit_photo'))) {
        throw new HTTPException(403, { message: 'Anda tidak diizinkan mengubah foto profil. Hubungi admin.' });
    }
    const form = await c.req.parseBody();
    const file = form['file'] as File;
    if (!file) throw new HTTPException(400, { message: 'Tidak ada berkas' });
    const type = file.type || 'application/octet-stream';
    if (!AVATAR_TYPES.includes(type)) throw new HTTPException(400, { message: 'Format harus JPG, PNG, WEBP, atau GIF' });
    if (file.size > AVATAR_MAX_BYTES) throw new HTTPException(400, { message: 'Ukuran maksimal 3 MB' });

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name || 'avatar').split('.').pop() || 'img';
    const objectPath = `avatar/${user.id}/${uuidv4()}.${ext}`;
    await putObject(objectPath, buf, type);

    const updated = await db.user.update({
        where: { id: user.id },
        data: { avatarPath: objectPath, avatarType: type },
    });
    return c.json(publicUser(updated));
});

authApp.delete('/me/avatar', async (c) => {
    const user = await getCurrentUser(c);
    if (!(await can(user, 'profile.edit_photo'))) {
        throw new HTTPException(403, { message: 'Anda tidak diizinkan mengubah foto profil. Hubungi admin.' });
    }
    const updated = await db.user.update({
        where: { id: user.id },
        data: { avatarPath: null, avatarType: null },
    });
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
