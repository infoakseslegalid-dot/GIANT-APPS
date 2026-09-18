// @ts-nocheck
import { getCurrentUser } from './deps';
import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { authApp } from './routes_auth';
import { adminRouter } from './routes_admin';
import workRouter from './routes_work';
import reportRouter from './routes_report';
import aiRouter from './routes_ai';
import archiveRouter from './routes_archive';
import { realtimeBus } from './deps';
import { syncPermissions, allowedKeysFor } from './permissions';
import { prefetchDivisions } from './deps';
import { advance_hari_job, notify_kelengkapan_pending } from './cron';

// Katalog permission disinkronkan sekali saat modul dimuat: aksi kurasi +
// table.<Model> untuk setiap model Prisma. Model baru → otomatis muncul di matriks.
syncPermissions().catch((e) => console.error('[permissions] sync gagal:', e));
prefetchDivisions().catch((e) => console.error('[divisions] prefetch gagal:', e));

// ── Cron in-process: HARI auto-advance, notifikasi jatuh tempo & kelengkapan
// pending (lihat src/server/cron.ts). Sebelumnya advance_hari_job() ada tapi
// tidak pernah dipanggil siapa pun — jadi fitur "otomatis maju HARI" & "jatuh
// tempo" itu mati. Guard lewat globalThis (pola sama dengan realtimeBus) biar
// tidak dobel interval tiap kali Next dev hot-reload modul ini.
const _gCron = globalThis as any;
if (!_gCron.__CRON_STARTED__) {
    _gCron.__CRON_STARTED__ = true;
    const CRON_INTERVAL_MS = 30 * 60 * 1000; // 30 menit
    const runCronJobs = async () => {
        try { await advance_hari_job(); } catch (e) { console.error('[cron] advance_hari_job gagal:', e); }
        try { await notify_kelengkapan_pending(); } catch (e) { console.error('[cron] notify_kelengkapan_pending gagal:', e); }
    };
    runCronJobs();
    setInterval(runCronJobs, CRON_INTERVAL_MS);
}

const app = new Hono().basePath('/api');

app.use('*', logger());
app.use('*', cors({
    origin: (origin) => origin || 'http://localhost:3000',
    credentials: true,
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api/auth') || c.req.path === '/api/health') {
        return next();
    }
    const user = await getCurrentUser(c);
    // Lampirkan set izin agar helper sinkron (canViewBoard, dll) bisa mengecek
    // matriks Hak Akses tanpa await.
    try {
        (user as any)._perms = new Set(await allowedKeysFor(user));
    } catch { (user as any)._perms = new Set(); }
    c.set('user', user);
    await next();
});


// ── Server-Sent Events: aliran realtime utama ke browser ─────────────────
// Dipakai oleh RealtimeContext.jsx via EventSource('/api/events'). SSE dipilih
// (bukan WebSocket) karena berjalan lewat HTTP biasa → aman baik di `next dev`
// maupun custom server, dan EventSource auto-reconnect.
app.get('/events', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ detail: 'Unauthorized' }, 401);
    return streamSSE(c, async (stream) => {
        let alive = true;
        const send = (m: any) => stream.writeSSE({ data: JSON.stringify(m) }).catch(() => { alive = false; });
        const unsub = realtimeBus.subscribe(send);
        stream.onAbort(() => { alive = false; unsub(); });
        await send({ type: 'hello', ts: Date.now() });
        try {
            while (alive && !stream.aborted) {
                await stream.sleep(25000);
                await send({ type: 'ping', ts: Date.now() });
            }
        } finally {
            unsub();
        }
    });
});

// Daftar izin milik user yang sedang login — dipakai frontend untuk
// menyembunyikan menu/tombol yang tidak diizinkan.
app.get('/my-permissions', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ role: null, permissions: [] });
    return c.json({ role: user.role, permissions: await allowedKeysFor(user) });
});

app.route('/auth', authApp);
app.route('/', adminRouter);
app.route('/', workRouter);
app.route('/', reportRouter);
app.route('/', aiRouter);
app.route('/', archiveRouter);

export { app };

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json({ detail: err.message }, err.status);
    }
    console.error(err);
    return c.json({ detail: "Internal Server Error" }, 500);
});
