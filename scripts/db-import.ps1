# ══════════════════════════════════════════════════════════════════════
#  Import ali_db_dump.sql ke database Supabase (atau Postgres mana pun).
#
#  Pakai:
#      powershell -ExecutionPolicy Bypass -File scripts\db-import.ps1
#      powershell -ExecutionPolicy Bypass -File scripts\db-import.ps1 -Url "postgresql://..."
#      powershell -ExecutionPolicy Bypass -File scripts\db-import.ps1 -Yes
#
#  PERINGATAN: dump ini ber-DROP TABLE. Semua 26 tabel aplikasi di schema
#  `public` akan dihapus lalu dibuat ulang. Tabel lain tidak disentuh.
# ══════════════════════════════════════════════════════════════════════
param(
    [string]$Url = "",
    [string]$DumpFile = "ali_db_dump.sql",
    [switch]$Yes
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

# ── 1. Tentukan connection string ─────────────────────────────────────
# Urutan: parameter -Url → DIRECT_URL di .env → DATABASE_URL di .env.
if ([string]::IsNullOrWhiteSpace($Url)) {
    $envPath = Join-Path $root ".env"
    if (-not (Test-Path $envPath)) {
        Write-Error "File .env tidak ada. Salin .env.example jadi .env dulu, atau kirim -Url."
    }
    $vars = @{}
    foreach ($line in (Get-Content $envPath)) {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $vars[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
    if ($vars.ContainsKey("DIRECT_URL") -and $vars["DIRECT_URL"]) { $Url = $vars["DIRECT_URL"] }
    elseif ($vars.ContainsKey("DATABASE_URL")) { $Url = $vars["DATABASE_URL"] }
}

if ([string]::IsNullOrWhiteSpace($Url)) {
    Write-Error "Connection string tidak ketemu. Isi DATABASE_URL/DIRECT_URL di .env."
}
if ($Url -match '\[YOUR-PASSWORD\]' -or $Url -match 'abcdefghijklmnopqrst') {
    Write-Error ".env masih berisi contoh dari .env.example. Isi kredensial asli dulu."
}
if (-not (Test-Path $DumpFile)) {
    Write-Error "File dump '$DumpFile' tidak ditemukan."
}

# Host saja yang ditampilkan — password jangan sampai ke-echo ke terminal/log.
$safeHost = ($Url -replace '^[^@]*@', '') -replace '\?.*$', ''

Write-Host "Target   : $safeHost"
Write-Host "Dump     : $DumpFile"
Write-Host "Tindakan : DROP + CREATE 26 tabel aplikasi di schema public, lalu isi datanya."
if (-not $Yes) {
    # Kalau stdin ter-redirect (mis. `powershell -File ...` dipanggil dari shell
    # lain), Read-Host langsung dapat EOF dan mengembalikan string kosong —
    # dulu itu terlihat seperti "batal sendiri" tanpa sempat mengetik apa pun.
    if ([Console]::IsInputRedirected) {
        Write-Host ""
        Write-Host "Terminal ini tidak meneruskan ketikan ke script (stdin ter-redirect)."
        Write-Host "Ulangi dengan -Yes kalau target di atas memang benar:"
        Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\db-import.ps1 -Yes"
        exit 1
    }
    $answer = Read-Host 'Lanjut? ketik "yes"'
    if ($answer -ne "yes") { Write-Host "Dibatalkan."; exit 1 }
}

# ── 2. Siapkan dump ───────────────────────────────────────────────────
# `SET transaction_timeout` baru ada di Postgres 17 (dump dibuat pg_dump 18).
# Di Postgres 15/16 baris itu bikin error, jadi dibuang dari salinan sementara.
# Salinan ditulis di root repo (bukan %TEMP%) supaya gampang di-mount ke Docker,
# dan tanpa BOM supaya psql tidak tersedak di baris pertama.
$tmpName = ".ali_dump_tmp.sql"
$tmpPath = Join-Path $root $tmpName
$lines = Get-Content $DumpFile -Encoding UTF8 | Where-Object { $_ -notmatch '^SET transaction_timeout' }
[System.IO.File]::WriteAllLines($tmpPath, $lines, (New-Object System.Text.UTF8Encoding($false)))

try {
    # ── 3. Jalankan psql ──────────────────────────────────────────────
    # Dump memakai `COPY ... FROM stdin`, yang hanya dimengerti psql — bukan
    # SQL Editor di dashboard Supabase. Kalau psql tidak terpasang, pinjam
    # dari image Docker postgres:17-alpine.
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($psql) {
        Write-Host "-> memakai psql lokal"
        & psql $Url -v ON_ERROR_STOP=1 -f $tmpPath
    } else {
        $docker = Get-Command docker -ErrorAction SilentlyContinue
        if (-not $docker) {
            Write-Error "Butuh psql atau Docker untuk mengimpor dump."
        }
        Write-Host "-> psql tidak terpasang, memakai docker postgres:17-alpine"
        & docker run --rm -v "${root}:/work" -w /work postgres:17-alpine `
            psql $Url -v ON_ERROR_STOP=1 -f "/work/$tmpName"
    }
    if ($LASTEXITCODE -ne 0) { Write-Error "Import gagal (exit $LASTEXITCODE)." }
} finally {
    Remove-Item $tmpPath -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Selesai. Cek isinya lewat Supabase Table Editor, atau:"
Write-Host '  psql $env:DATABASE_URL -c ''select count(*) from "User";'''
