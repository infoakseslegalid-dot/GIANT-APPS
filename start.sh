#!/bin/bash
echo "Menjalankan ALI-APP (Next.js + Hono + Postgres)..."
cd /home/alvansyahwardhana/GIANT-APPS

# Pastikan container postgres menyala
docker start giant-apps-db-1 2>/dev/null

# Jalankan server.mjs
export NODE_ENV=production
yarn tsx server.mjs
