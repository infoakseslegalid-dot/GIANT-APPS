# GIANT-APPS (ALI Workspace)

Aplikasi manajemen pekerjaan berbasis papan kanban: **Next.js 16** (App Router)
+ **Hono** untuk API di `/api` + **Prisma** di atas **PostgreSQL (Supabase)**.

## Quick start

```bash
corepack enable
cp .env.example .env      # lalu isi DATABASE_URL, DIRECT_URL, dan JWT_SECRET
yarn install
yarn prisma generate
yarn db:import            # impor ali_db_dump.sql ke database (opsional, sekali saja)
yarn dev                  # http://localhost:3000
```

Pakai Docker (hot reload, tidak perlu Node/Yarn di host):

```bash
yarn docker:dev:build     # pertama kali
yarn docker:dev           # selanjutnya
```

## Dokumentasi

- **[DEV-SETUP.md](DEV-SETUP.md)** — panduan lengkap: setup Supabase, isi `.env`,
  impor `ali_db_dump.sql`, menjalankan manual maupun lewat Docker, dan
  troubleshooting.
- **[DEPLOY.md](DEPLOY.md)** — deploy ke VPS di belakang Traefik
  (`docker-compose.prod.yml`, domain `ali-dev.web.id`).
- [AGENTS.md](AGENTS.md) — catatan untuk coding agent.
- [PRD-bankdata-distribusi-pekerjaan.md](PRD-bankdata-distribusi-pekerjaan.md),
  [spesifikasi-sistem-bankdata.md](spesifikasi-sistem-bankdata.md) — spesifikasi produk.

## Struktur singkat

| Path | Isi |
|---|---|
| `src/app/` | Entry Next.js App Router; `api/[[...route]]` meneruskan semua request ke Hono |
| `src/server/` | Seluruh REST API (auth, work item, admin, report), Prisma, permission, cron |
| `src/views/`, `src/components/` | Halaman & komponen UI |
| `prisma/schema.prisma` | Skema database |
| `server.mjs` | Custom server opsional (Next + Hono + WebSocket `/api/ws`) |
