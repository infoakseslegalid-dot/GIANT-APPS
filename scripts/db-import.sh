#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  Import ali_db_dump.sql ke database Supabase (atau Postgres mana pun).
#
#  Pakai:
#      bash scripts/db-import.sh                    # baca URL dari .env
#      bash scripts/db-import.sh "postgresql://..." # URL eksplisit
#      bash scripts/db-import.sh --yes              # lewati konfirmasi
#
#  PERINGATAN: dump ini ber-DROP TABLE. Semua 26 tabel aplikasi di schema
#  `public` akan dihapus lalu dibuat ulang. Tabel lain tidak disentuh.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."

DUMP_FILE="${DUMP_FILE:-ali_db_dump.sql}"
ASSUME_YES=0
URL_ARG=""

for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    *)        URL_ARG="$arg" ;;
  esac
done

# Ambil satu key dari .env tanpa `source`: password yang mengandung $ atau `
# tidak boleh sampai dieksekusi shell. CR dibuang karena .env di Windows
# sering ber-line-ending CRLF.
read_env() {
  [ -f .env ] || return 0
  sed -n -E "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*(.*)$/\1/p" .env \
    | tail -n 1 \
    | tr -d '\r' \
    | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

# ── 1. Tentukan connection string ─────────────────────────────────────
# Urutan: argumen → DIRECT_URL → DATABASE_URL (environment dulu, lalu .env).
DB_URL="$URL_ARG"
[ -n "$DB_URL" ] || DB_URL="${DIRECT_URL:-$(read_env DIRECT_URL)}"
[ -n "$DB_URL" ] || DB_URL="${DATABASE_URL:-$(read_env DATABASE_URL)}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: connection string tidak ketemu." >&2
  echo "       Isi DATABASE_URL/DIRECT_URL di .env, atau kirim sebagai argumen." >&2
  exit 1
fi
case "$DB_URL" in
  *"[YOUR-PASSWORD]"*|*abcdefghijklmnopqrst*)
    echo "ERROR: .env masih berisi contoh dari .env.example. Isi kredensial asli dulu." >&2
    exit 1
    ;;
esac
if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: file dump '$DUMP_FILE' tidak ditemukan." >&2
  exit 1
fi

# Host saja yang ditampilkan — password jangan sampai ke-echo ke terminal/log.
SAFE_HOST="$(printf '%s' "$DB_URL" | sed -E 's#^[^@]*@##; s#\?.*$##')"

echo "Target   : $SAFE_HOST"
echo "Dump     : $DUMP_FILE"
echo "Tindakan : DROP + CREATE 26 tabel aplikasi di schema public, lalu isi datanya."
if [ "$ASSUME_YES" -ne 1 ]; then
  # Tanpa tty, `read` langsung dapat EOF dan script terlihat "batal sendiri"
  # padahal belum sempat ditanya.
  if [ ! -t 0 ]; then
    echo
    echo "Terminal ini tidak meneruskan ketikan ke script (stdin bukan tty)."
    echo "Ulangi dengan --yes kalau target di atas memang benar:"
    echo "  bash scripts/db-import.sh --yes"
    exit 1
  fi
  printf 'Lanjut? ketik "yes": '
  read -r answer
  [ "$answer" = "yes" ] || { echo "Dibatalkan."; exit 1; }
fi

# ── 2. Siapkan dump ───────────────────────────────────────────────────
# `SET transaction_timeout` baru ada di Postgres 17 (dump dibuat pg_dump 18).
# Di Postgres 15/16 baris itu bikin error, jadi dibuang dari salinan sementara.
# Salinan ditaruh di root repo (bukan /tmp) supaya gampang di-mount ke Docker.
TMP_SQL=".ali_dump_tmp.sql"
trap 'rm -f "$TMP_SQL"' EXIT
grep -v '^SET transaction_timeout' "$DUMP_FILE" > "$TMP_SQL"

# ── 3. Jalankan psql ──────────────────────────────────────────────────
# Dump memakai `COPY ... FROM stdin`, yang hanya dimengerti psql — bukan SQL
# Editor di dashboard Supabase. Kalau psql tidak terpasang, pinjam dari image
# Docker postgres:17-alpine.
if command -v psql >/dev/null 2>&1; then
  echo "-> memakai psql lokal"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$TMP_SQL"
elif command -v docker >/dev/null 2>&1; then
  echo "-> psql tidak terpasang, memakai docker postgres:17-alpine"
  # Di Git Bash, path POSIX (/d/GIANT-APPS) tidak dikenali Docker Desktop dan
  # MSYS suka mengubah argumen "/work" jadi path Windows — makanya cygpath +
  # MSYS_NO_PATHCONV.
  HOST_DIR="$(pwd)"
  if command -v cygpath >/dev/null 2>&1; then HOST_DIR="$(cygpath -w "$HOST_DIR")"; fi
  MSYS_NO_PATHCONV=1 docker run --rm -v "${HOST_DIR}:/work" -w /work postgres:17-alpine \
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "/work/$TMP_SQL"
else
  echo "ERROR: butuh psql atau docker untuk mengimpor dump." >&2
  exit 1
fi

echo
echo "Selesai. Cek isinya:"
echo "  psql \"\$DATABASE_URL\" -c 'select count(*) from \"User\";'"
