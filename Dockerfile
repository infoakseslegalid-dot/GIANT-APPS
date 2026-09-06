# syntax=docker/dockerfile:1
# ══════════════════════════════════════════════════════════════════════
#  Image PRODUKSI (dipakai docker-compose.prod.yml di VPS).
#  Untuk development pakai Dockerfile.dev — image ini tidak punya hot reload.
#
#  Target:
#    deps     → node_modules lengkap (dipakai stage lain)
#    builder  → prisma generate + next build (output standalone)
#    migrator → menyamakan skema database dengan prisma/schema.prisma
#    runner   → image akhir yang dijalankan
# ══════════════════════════════════════════════════════════════════════

# ── Stage 1: dependencies ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps

# openssl: dibutuhkan query engine Prisma di image -slim.
# ca-certificates: TLS ke Supabase.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive


# ── Stage 2: builder ──────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY prisma ./prisma
RUN yarn prisma generate

COPY . .

# NEXT_OUTPUT_STANDALONE dibaca next.config.ts → output: "standalone".
# Build tidak menyentuh database: tidak ada env DATABASE_URL di sini, dan itu
# memang disengaja supaya image bisa dipakai di environment mana pun.
ENV NODE_ENV=production \
    NEXT_OUTPUT_STANDALONE=true
RUN yarn build


# ── Stage 3: migrator ─────────────────────────────────────────────────
# Dijalankan sekali tiap deploy, sebelum aplikasi start. `db push` dipakai
# karena project ini tidak memakai folder prisma/migrations. Sengaja TANPA
# --accept-data-loss: kalau perubahan skema berpotensi menghapus data, perintah
# ini gagal dan deploy berhenti — bukan diam-diam membuang kolom.
FROM deps AS migrator
WORKDIR /app
COPY prisma ./prisma
CMD ["yarn", "prisma", "db", "push", "--skip-generate"]


# ── Stage 4: runner ───────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

RUN groupadd --gid 1001 nodejs \
 && useradd --uid 1001 --gid nodejs --create-home nextjs

# Output standalone sudah membawa server.js + subset node_modules yang dipakai.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# File tracing Next kadang melewatkan engine Prisma karena di-resolve secara
# dinamis, jadi client hasil generate disalin eksplisit.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Lampiran yang diunggah mendarat di sini saat EMERGENT_LLM_KEY kosong
# (src/server/storage.ts). Di compose, folder ini dipetakan ke named volume.
RUN mkdir -p /app/local_storage && chown nextjs:nodejs /app/local_storage

USER nextjs
EXPOSE 3000

# Tanpa cookie, /api/my-permissions membalas 401 — dan itu justru bukti server
# hidup serta router Hono ter-mount, tanpa perlu menyentuh database. Jadi yang
# dinilai sehat adalah "ada respons HTTP dan bukan 5xx", bukan status 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/my-permissions').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
