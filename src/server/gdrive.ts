// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────
// Google Drive (REST v3, tanpa SDK) untuk Arsip & Backup.
//
// - Satu akun Google (mis. info.akseslegal.id@gmail.com) dihubungkan SEKALI
//   oleh super admin lewat OAuth; refresh token disimpan di tabel Setting.
// - Scope `drive.file`: aplikasi hanya bisa melihat/mengubah file & folder yang
//   ia buat sendiri — folder pribadi lain di Drive tidak tersentuh.
// - Butuh env GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET (lihat docs/ARSIP-GOOGLE-DRIVE.md).
// ─────────────────────────────────────────────────────────────────────────
import { getSetting, setSetting } from './deps';

export const GDRIVE_SETTING_KEY = 'gdrive';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];
const FOLDER_MIME = 'application/vnd.google-apps.folder';
// GOOGLE_API_BASE_URL / GOOGLE_TOKEN_URL hanya untuk pengujian dengan server tiruan.
const BASE = (process.env.GOOGLE_API_BASE_URL || 'https://www.googleapis.com').replace(/\/$/, '');
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const API = `${BASE}/drive/v3`;
const UPLOAD = `${BASE}/upload/drive/v3`;

export function gdriveConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Alamat publik aplikasi — dipakai sebagai redirect URI OAuth. */
export function publicBaseUrl(c?: any) {
  const env = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (env) return env;
  if (!c) return 'http://localhost:3000';
  const proto = c.req.header('x-forwarded-proto') || new URL(c.req.url).protocol.replace(':', '');
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || new URL(c.req.url).host;
  return `${proto}://${host}`;
}
export const redirectUri = (c?: any) => `${publicBaseUrl(c)}/api/integrations/google/callback`;

export function authUrl(c: any, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri(c),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // paksa refresh_token selalu dikirim
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(c: any, code: string) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri(c),
      grant_type: 'authorization_code',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || `Google menolak (${r.status})`);
  return j; // { access_token, refresh_token, expires_in, ... }
}

// ── token ────────────────────────────────────────────────────────────────
let _token: { value: string; exp: number } | null = null;

export async function getDriveSettings() {
  return (await getSetting(GDRIVE_SETTING_KEY)) || null;
}
export async function saveDriveSettings(patch: any) {
  const cur = (await getDriveSettings()) || {};
  const next = { ...cur, ...patch };
  await setSetting(GDRIVE_SETTING_KEY, next);
  return next;
}
export async function clearDrive() {
  _token = null;
  await setSetting(GDRIVE_SETTING_KEY, null);
}

export async function isConnected() {
  const s = await getDriveSettings();
  return !!(s?.refresh_token && gdriveConfigured());
}

async function accessToken() {
  if (_token && Date.now() < _token.exp - 60_000) return _token.value;
  const s = await getDriveSettings();
  if (!s?.refresh_token) throw new Error('Google Drive belum dihubungkan');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: s.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    // invalid_grant = akses dicabut / token kedaluwarsa → admin harus hubungkan ulang.
    if (j.error === 'invalid_grant') await saveDriveSettings({ broken: 'Akses Google Drive dicabut atau kedaluwarsa — hubungkan ulang.' });
    throw new Error(j.error_description || j.error || `Gagal refresh token (${r.status})`);
  }
  _token = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return _token.value;
}

async function gfetch(url: string, init: any = {}) {
  const tok = await accessToken();
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${tok}`, ...(init.headers || {}) } });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); msg = j.error?.message || JSON.stringify(j); } catch { /* */ }
    const err: any = new Error(`Google Drive: ${msg}`);
    err.status = r.status;
    throw err;
  }
  return r;
}
const gjson = async (url: string, init: any = {}) => (await gfetch(url, init)).json();

// ── operasi ──────────────────────────────────────────────────────────────
export async function about() {
  return gjson(`${API}/about?fields=user(emailAddress,displayName),storageQuota`);
}

export async function userEmailFromToken(accessTok: string) {
  const r = await fetch(`${BASE}/oauth2/v2/userinfo`, { headers: { Authorization: `Bearer ${accessTok}` } });
  const j = await r.json().catch(() => ({}));
  return j.email || null;
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function findFolder(name: string, parentId: string) {
  const query = `name='${q(name)}' and '${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
  const j = await gjson(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=5`);
  return j.files?.[0]?.id || null;
}

export async function createFolder(name: string, parentId?: string) {
  const j = await gjson(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return j.id;
}

export async function ensureFolder(name: string, parentId: string) {
  return (await findFolder(name, parentId)) || createFolder(name, parentId);
}

/** Pastikan rantai folder (mis. ["2026", "02 - Februari"]) ada di bawah parentId. */
export async function ensurePath(parts: string[], parentId: string) {
  let cur = parentId;
  for (const p of parts) cur = await ensureFolder(p, cur);
  return cur;
}

export async function getFile(id: string, fields = 'id,name,parents,trashed,webViewLink') {
  return gjson(`${API}/files/${id}?fields=${fields}`);
}

/** Upload resumable (aman untuk file besar). `asMime` = konversi (mis. jadi Google Docs). */
export async function uploadFile({ name, parentId, mimeType, data, asMime }: { name: string; parentId: string; mimeType: string; data: Buffer; asMime?: string }) {
  const init = await gfetch(`${UPLOAD}/files?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(data.length),
    },
    body: JSON.stringify({ name, parents: [parentId], ...(asMime ? { mimeType: asMime } : {}) }),
  });
  const location = init.headers.get('location');
  if (!location) throw new Error('Google Drive tidak memberi alamat upload');
  const tok = await accessToken();
  const put = await fetch(location, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': mimeType || 'application/octet-stream', 'Content-Length': String(data.length) },
    body: data,
  });
  const j = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(`Upload ke Google Drive gagal: ${j.error?.message || put.status}`);
  return { id: j.id, webViewLink: j.webViewLink || `https://drive.google.com/file/d/${j.id}/view` };
}

export async function updateFileContent(id: string, data: Buffer, mimeType: string) {
  await gfetch(`${UPLOAD}/files/${id}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': mimeType },
    body: data,
  });
}

export async function renameFile(id: string, name: string) {
  await gfetch(`${API}/files/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
}

/** Pindah file/folder ke parent baru. Link file TIDAK berubah. */
export async function moveFile(id: string, newParentId: string) {
  const f = await getFile(id, 'id,parents');
  const old = (f.parents || []).filter((p: string) => p !== newParentId);
  if (!old.length && (f.parents || []).includes(newParentId)) return;
  const params = new URLSearchParams({ addParents: newParentId, fields: 'id' });
  if (old.length) params.set('removeParents', old.join(','));
  await gfetch(`${API}/files/${id}?${params}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
}

/** "Siapa saja yang punya link bisa melihat" — HANYA untuk dokumen hasil. */
export async function shareAnyoneReader(id: string) {
  await gfetch(`${API}/files/${id}/permissions?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
}
export async function unshareAnyone(id: string) {
  try {
    await gfetch(`${API}/files/${id}/permissions/anyoneWithLink`, { method: 'DELETE' });
  } catch (e: any) {
    if (e.status !== 404) throw e;
  }
}

export const folderUrl = (id?: string | null) => (id ? `https://drive.google.com/drive/folders/${id}` : null);
