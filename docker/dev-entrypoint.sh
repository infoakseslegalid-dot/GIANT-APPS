#!/bin/sh
# Dijalankan tiap container dev start, sebelum `yarn dev`.
set -e

cd /app

# node_modules ada di named volume yang bisa ketinggalan zaman dibanding image
# (mis. setelah menambah dependency). Dua penjagaan di bawah bikin container
# tetap bisa start tanpa harus rebuild manual.
if [ ! -d node_modules/next ]; then
  echo "[entrypoint] node_modules kosong — menjalankan yarn install..."
  yarn install --frozen-lockfile --non-interactive
fi

if [ ! -d node_modules/.prisma/client ]; then
  echo "[entrypoint] Prisma Client belum ada — menjalankan prisma generate..."
  yarn prisma generate
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] PERINGATAN: DATABASE_URL kosong. Isi .env dulu, jika tidak"
  echo "[entrypoint] semua query ke database akan gagal."
fi

exec "$@"
