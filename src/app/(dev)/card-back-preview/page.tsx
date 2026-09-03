'use client';

/**
 * Preview dev untuk Card Back — meniru trello-card-layout.html.
 * URL: /card-back-preview
 */

import React, { useState } from 'react';
import CardBack from '../../../components/kanban/card-back/CardBack';
import type {
  CardActivity,
  CardAttachment,
  CardMember,
  Checklist,
  TrelloCard,
} from '../../../components/kanban/card-back/types';

const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`;

const IL: CardMember = { id: 'u-il', name: 'Info Akses Legal', initials: 'IL', avatarColor: '#0c66e4' };
const AL: CardMember = { id: 'u-al', name: 'admin_legal', initials: 'AL', avatarColor: '#f39c12' };

const now = Date.now();

const DESC = `
<p>+62 812-1868-8039</p>
<p><strong>FORMULIR PENDIRIAN PERUSAHAAN PT</strong></p>
<p><strong>A. DATA PERUSAHAAN</strong></p>
<ul>
  <li>Nama PT: PT Juara Solusi Pintar</li>
  <li>Alamat Lengkap: Wisma Bumiputera Lt.18-02 Jalan Jenderal Sudirman Kav 75, RT 003, RW 003 Kel. Setiabudi Kec. Setiabudi Kota Jakarta Selatan - 12910</li>
  <li>Email Perusahaan: <a href="mailto:juarasolusipintar@gmail.com">juarasolusipintar@gmail.com</a></li>
  <li>Password Email: jstar2026</li>
  <li>No. Telepon/HP: 085268667530</li>
  <li>Modal dasar: Rp. 100jt</li>
  <li>Modal stor : -</li>
  <li>KBLI 2025 / Bidang Usaha: <a href="#">25 Aug 2026, 11:38</a></li>
</ul>
<p><strong>B. DATA PENGURUS &amp; PEMEGANG MODAL</strong></p>
<p><strong>1. Pengurus Pertama</strong></p>
<ul>
  <li>Nama Lengkap: Tuan MAHESA MATTIN ANTASYA</li>
  <li>Jabatan: Direktur Utama</li>
  <li>Setoran Modal/Saham: Rp 34.000.000</li>
  <li>No. HP: 085693033039</li>
  <li>Email: <a href="mailto:mahesamattinantasya@gmail.com">mahesamattinantasya@gmail.com</a></li>
  <li>Lampiran KTP &amp; NPWP: <a href="#">24 Aug 2026, 08:34</a></li>
</ul>
<p><strong>1. Pengurus Kedua</strong></p>
<ul>
  <li>Nama Lengkap: Tuan DANA DWI SATRIA</li>
  <li>Jabatan: Direktur</li>
  <li>Setoran Modal/Saham: Rp 33.000.000</li>
  <li>No. HP: 08119124091</li>
  <li>Email: <a href="mailto:satria.dana@gmail.com">satria.dana@gmail.com</a></li>
  <li>Lampiran KTP &amp; NPWP: <a href="#">24 Aug 2026, 08:34</a></li>
</ul>`;

/* disimpan lama → baru; CardActivityPanel membalik jadi terbaru di atas */
const ACTIVITIES: CardActivity[] = [
  {
    id: 's1',
    kind: 'system',
    author: AL,
    body: '<strong>admin_legal</strong> menambahkan kartu ini ke SKOR 5 BELUM PENYERAHAN',
    createdAt: '2026-08-24T08:00:00',
    canEdit: false,
    canDelete: false,
  },
  {
    id: 's2',
    kind: 'system',
    author: AL,
    body: '<strong>admin_legal</strong> menambahkan label LUNAS',
    createdAt: '2026-08-24T08:00:20',
    canEdit: false,
    canDelete: false,
  },
  {
    id: 's3',
    kind: 'system',
    author: AL,
    body: '<strong>admin_legal</strong> menambahkan label SUDAH ADA LOGO',
    createdAt: '2026-08-24T08:00:40',
    canEdit: false,
    canDelete: false,
  },
  {
    id: 's4',
    kind: 'system',
    author: AL,
    body: '<strong>admin_legal</strong> memindahkan kartu ini dari <strong>SKOR 4 DRAFT</strong> ke <strong>SKOR 5 BELUM PENYERAHAN</strong>',
    createdAt: '2026-08-28T14:20:00',
    canEdit: false,
    canDelete: false,
  },
  {
    id: 'c6',
    kind: 'comment',
    author: AL,
    body: '',
    createdAt: '2026-09-01T09:03:00',
    attachments: [
      {
        id: 'f1',
        fileName: 'AKTA_SALINAN PT JUARA SOLUSI PINTAR.pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        mimeType: 'application/pdf',
        createdAt: '2026-09-01T09:03:00',
      },
    ],
    canEdit: true,
    canDelete: true,
  },
  {
    id: 'c7',
    kind: 'comment',
    author: IL,
    body: '<p>Ini hasil scan KTP direktur utama ya</p>',
    createdAt: '2026-09-01T09:20:00',
    attachments: [
      {
        id: 'f2',
        fileName: 'ktp-direktur-utama.jpg',
        url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200',
        thumbUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
        mimeType: 'image/jpeg',
        createdAt: '2026-09-01T09:20:00',
      },
    ],
    canEdit: true,
    canDelete: true,
  },
  {
    id: 'c5',
    kind: 'comment',
    author: IL,
    body: '<p>sudah di share</p><p>dedes</p>',
    createdAt: '2026-09-01T09:58:00',
    canEdit: true,
    canDelete: true,
  },
  {
    id: 'c4',
    kind: 'comment',
    author: IL,
    body: '<p>update salinan kembali dalam tim @adm_legal</p><p>dedes</p>',
    createdAt: '2026-09-01T10:00:00',
    canEdit: true,
    canDelete: true,
  },
  {
    id: 'c3',
    kind: 'comment',
    author: AL,
    body: '<p>tolong hapus dates jika seperti sudah lengkap</p>',
    createdAt: new Date(now - 3600000 * 5).toISOString(),
    canEdit: false,
    canDelete: true,
  },
  {
    id: 'c2',
    kind: 'comment',
    author: IL,
    body: '<p>sudah di ku ke Stefani untuk pengiriman dokumennya</p><p>dedes</p>',
    createdAt: new Date(now - 3600000 * 3).toISOString(),
    canEdit: true,
    canDelete: true,
  },
  {
    id: 'c1',
    kind: 'comment',
    author: IL,
    body:
      '<p>Selamat siang Bapak/Ibu,</p>' +
      '<p>Kami ingin menginformasikan bahwa dokumen legalitas Anda saat ini sudah tersimpan secara sistematis di platform kami, sehingga Bapak/Ibu tidak perlu khawatir atau kesulitan lagi dalam mencarinya.</p>' +
      '<p>Dokumen tersebut dapat diakses secara mandiri melalui tautan berikut:<br>🌐 <a href="https://akseslegal.id/masuk">https://akseslegal.id/masuk</a></p>' +
      '<p>Detail Akun Login:<br>Username: juarasolusipintar@gmail.com<br>Password: juara2026</p>' +
      '<p>Panduan Akses Dokumen:<br>1. Silakan melakukan login terlebih dahulu menggunakan akun di atas.<br>2. Klik menu Dokumen Legal.<br>3. Pilih Nama Perusahaan Anda</p>',
    createdAt: new Date(now - 60000).toISOString(),
    canEdit: true,
    canDelete: true,
  },
];

const INITIAL: TrelloCard = {
  id: 'card-1',
  title: 'PT Juara Solusi Pintar (inc NIB)',
  isComplete: false,
  listId: 'l1',
  listName: 'SKOR 5 BELUM PENYERAHAN',
  description: DESC,
  labels: [
    { id: 'lb1', name: 'LUNAS', color: 'green' },
    { id: 'lb2', name: 'SUDAH ADA LOGO', color: 'purple' },
    { id: 'lb3', name: 'NOT SOPPENG', color: 'blue' },
    { id: 'lb4', name: 'SALINAN KEMBALI JKT', color: 'sky' },
    { id: 'lb5', name: 'SUDAH ADA AKUN DASHBOARD', color: 'gray' },
  ],
  members: [IL, AL],
  isWatching: true,
  startDate: null,
  dueDate: '2026-09-10T00:00:00',
  attachments: [
    {
      id: 'att-1',
      fileName: 'AKTA_SALINAN PT JUARA SOLUSI PINTAR (dokumen final untuk klien).pdf',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      mimeType: 'application/pdf',
      createdAt: '2026-09-01T09:03:00',
      size: 143_000,
    },
    {
      id: 'att-2',
      fileName: 'ktp-direktur-utama.jpg',
      url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200',
      thumbUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=200',
      mimeType: 'image/jpeg',
      createdAt: '2026-08-24T08:34:00',
      size: 512_000,
    },
  ],
  checklists: [
    {
      id: 'cl-1',
      title: 'Syarat Dokumen',
      items: [
        { id: 'cli-1', text: 'KTP & NPWP pengurus lengkap', done: true },
        { id: 'cli-2', text: 'Draft akta disetujui klien', done: true },
        { id: 'cli-3', text: 'Pembayaran PNBP', done: false },
        { id: 'cli-4', text: 'Pengurusan NIB di OSS', done: false },
      ],
    },
  ],
  activities: ACTIVITIES,
  isArchived: false,
};

/* Latar palsu ala board Trello (seperti di trello-card-layout.html) */
function FakeBoard() {
  return (
    <>
      <div className="flex h-14 items-center gap-3 bg-[#1d2125] px-3 text-white">
        <div className="w-[125px] text-base font-bold">▰ Trello</div>
        <div className="flex h-[34px] w-[520px] max-w-[40vw] items-center rounded-[5px] border border-[#59636e] bg-[#2b3035] px-3 text-[#c7cbd0]">
          ⌕&nbsp; Search
        </div>
        <div className="rounded-[5px] bg-[#30363b] px-[15px] py-[9px]">Create</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-14 bg-[linear-gradient(135deg,#39444d,#59606a)] opacity-85" />
      <div className="absolute left-5 top-[78px] text-xl font-bold text-white">BOARD PROYEK</div>
      <div className="absolute left-[15px] right-[15px] top-[125px] flex gap-3 max-[760px]:hidden">
        {[
          { h: 'TO DO', c: ['PT Juara Solusi Pintar', 'Dokumen Legal'] },
          { h: 'ON PROGRESS', c: ['Pembuatan Akun'] },
          { h: 'DONE', c: ['Website'] },
        ].map((col) => (
          <div key={col.h} className="w-[235px] rounded-[8px] bg-[#10121455] p-[10px] text-white">
            <h4 className="mb-[10px] mt-[2px]">{col.h}</h4>
            {col.c.map((t) => (
              <div key={t} className="mb-2 rounded-[7px] bg-white p-3 text-[#172b4d] shadow-[0_1px_2px_#0004]">
                {t}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export default function CardBackPreviewPage() {
  const [open, setOpen] = useState(true);
  const [card, setCard] = useState<TrelloCard>(INITIAL);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#24272b] text-[14px]">
      <FakeBoard />

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 rounded bg-[#0c66e4] px-4 py-2 text-white"
        >
          Buka Card
        </button>
      )}

      <CardBack
        card={card}
        currentUser={IL}
        open={open}
        onOpenChange={setOpen}
        onUpdateCard={async (patch) => setCard((c) => ({ ...c, ...patch }))}
        availableLabels={[
          { id: 'lb1', name: 'LUNAS', color: 'green' },
          { id: 'lb2', name: 'SUDAH ADA LOGO', color: 'purple' },
          { id: 'lb3', name: 'NOT SOPPENG', color: 'blue' },
        ]}
        onToggleLabel={async (id) => alert('toggle label ' + id)}
        onUpdateLabel={async (id, n, c) => alert(`update label ${id} ${n} ${c}`)}
        onCreateLabel={async (n, c) => alert(`create label ${n} ${c}`)}
        onAddComment={async (html, files) => {
          const attachments: CardAttachment[] = (files ?? []).map((f) => ({
            id: uid('att'),
            fileName: f.name,
            url: URL.createObjectURL(f),
            thumbUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
            mimeType: f.type || 'application/octet-stream',
            createdAt: new Date().toISOString(),
            size: f.size,
          }));
          const act: CardActivity = {
            id: uid('c'),
            kind: 'comment',
            author: IL,
            body: html || (attachments.length ? `<p>mengunggah ${attachments.length} lampiran</p>` : ''),
            createdAt: new Date().toISOString(),
            attachments: attachments.length ? attachments : undefined,
            canEdit: true,
            canDelete: true,
          };
          setCard((c) => ({
            ...c,
            attachments: [...c.attachments, ...attachments],
            activities: [...c.activities, act],
          }));
        }}
        onUpdateComment={async (id, html) =>
          setCard((c) => ({
            ...c,
            activities: c.activities.map((a) =>
              a.id === id ? { ...a, body: html, editedAt: new Date().toISOString() } : a,
            ),
          }))
        }
        onDeleteComment={async (id) =>
          setCard((c) => ({ ...c, activities: c.activities.filter((a) => a.id !== id) }))
        }
        onAddAttachments={async (files) => {
          const atts: CardAttachment[] = files.map((f) => ({
            id: uid('att'),
            fileName: f.name,
            url: URL.createObjectURL(f),
            thumbUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
            mimeType: f.type || 'application/octet-stream',
            createdAt: new Date().toISOString(),
            size: f.size,
          }));
          setCard((c) => ({
            ...c,
            attachments: [...c.attachments, ...atts],
            activities: [
              ...c.activities,
              {
                id: uid('s'),
                kind: 'system',
                author: IL,
                body: `<strong>${IL.name}</strong> menambahkan ${atts.length} lampiran`,
                createdAt: new Date().toISOString(),
                canEdit: false,
                canDelete: false,
              },
            ],
          }));
        }}
        onDeleteAttachments={async (ids) =>
          setCard((c) => ({
            ...c,
            attachments: c.attachments.filter((a) => !ids.includes(a.id)),
            coverImageUrl: c.attachments.some((a) => ids.includes(a.id) && a.url === c.coverImageUrl)
              ? null
              : c.coverImageUrl,
          }))
        }
        onRenameAttachment={async (id, fileName) =>
          setCard((c) => ({
            ...c,
            attachments: c.attachments.map((a) => (a.id === id ? { ...a, fileName } : a)),
          }))
        }
        onAddChecklist={async (title) =>
          setCard((c) => ({
            ...c,
            checklists: [...c.checklists, { id: uid('cl'), title, items: [] } as Checklist],
          }))
        }
        onRenameChecklist={async (checklistId, title) =>
          setCard((c) => ({
            ...c,
            checklists: c.checklists.map((cl) => (cl.id === checklistId ? { ...cl, title } : cl)),
          }))
        }
        onDeleteChecklist={async (checklistId) =>
          setCard((c) => ({ ...c, checklists: c.checklists.filter((cl) => cl.id !== checklistId) }))
        }
        onAddChecklistItem={async (checklistId, text) =>
          setCard((c) => ({
            ...c,
            checklists: c.checklists.map((cl) =>
              cl.id === checklistId
                ? { ...cl, items: [...cl.items, { id: uid('cli'), text, done: false }] }
                : cl,
            ),
          }))
        }
        onUpdateChecklistItem={async (checklistId, itemId, patch) =>
          setCard((c) => ({
            ...c,
            checklists: c.checklists.map((cl) =>
              cl.id === checklistId
                ? { ...cl, items: cl.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
                : cl,
            ),
          }))
        }
        onDeleteChecklistItem={async (checklistId, itemId) =>
          setCard((c) => ({
            ...c,
            checklists: c.checklists.map((cl) =>
              cl.id === checklistId ? { ...cl, items: cl.items.filter((it) => it.id !== itemId) } : cl,
            ),
          }))
        }
        onReorderChecklistItems={async (checklistId, orderedItemIds) =>
          setCard((c) => ({
            ...c,
            checklists: c.checklists.map((cl) =>
              cl.id === checklistId
                ? {
                    ...cl,
                    items: [...cl.items].sort(
                      (a, b) => orderedItemIds.indexOf(a.id) - orderedItemIds.indexOf(b.id),
                    ),
                  }
                : cl,
            ),
          }))
        }
        onMoveCard={async () => {}}
        onCopyCard={async () => {}}
        onArchiveCard={async () => setCard((c) => ({ ...c, isArchived: !c.isArchived }))}
        onMirrorCard={async () => {}}
        onMakeTemplate={async () => {}}
        onJoin={async () => {}}
      />
    </div>
  );
}
