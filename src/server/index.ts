// @ts-nocheck
import { getCurrentUser } from './deps';
import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { authApp } from './routes_auth';
import { adminRouter } from './routes_admin';
import workRouter from './routes_work';

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
    c.set('user', user);
    await next();
});


app.route('/auth', authApp);
app.route('/', adminRouter);
app.route('/', workRouter);

export { app };

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json({ detail: err.message }, err.status);
    }
    console.error(err);
    return c.json({ detail: "Internal Server Error" }, 500);
});
