import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errMsg, API } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import CardBack from './card-back/CardBack';
import SendWorkDialog from '../SendWorkDialog';
import MoveCardDialog from '../MoveCardDialog';
import { resolveColor } from './card-back/helpers';
import type {
  TrelloCard, CardMember, CardLabel, CardAttachment, CardActivity, Checklist,
} from './card-back/types';

/** "Info Akses Legal" -> "IA"; "admin_legal" -> "AD" */
function initialsOf(name?: string | null): string {
  const n = (name || '').trim();
  if (!n) return 'U';
  const parts = n.split(/[\s_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

export default function CardModalWrapper({ itemId, onClose, readOnly = false }: { itemId: string; onClose: () => void; readOnly?: boolean }) {
  const { user } = useAuth() as any;
  const qc = useQueryClient();
  const [showSend, setShowSend] = useState(false);
  const [showMove, setShowMove] = useState(false);
  // bisa berpindah ke assignment turunan tanpa menutup modal
  const [activeId, setActiveId] = useState(itemId);
  const [prevProp, setPrevProp] = useState(itemId);
  if (itemId !== prevProp) { setPrevProp(itemId); setActiveId(itemId); }
  const curId = activeId;

  const { data, refetch } = useQuery({
    queryKey: ['work-item', curId],
    queryFn: () => api.get(`/work-items/${curId}`).then((r) => r.data),
  });

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then((r) => r.data) });
  const { data: checklistTemplates } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () => api.get('/checklist-templates').then((r) => r.data),
    staleTime: 60000,
  });

  if (!data || !users) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-16 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-4xl rounded-xl bg-[hsl(var(--muted))] p-10 text-center text-2">Memuat...</div>
      </div>
    );
  }

  const { item, comments, attachments, activities, board_labels, list_name } = data;
  // Halaman agregat (Board Harian / Peta Skor Global): non-super_admin hanya boleh melihat.
  const forcedReadOnly = readOnly && user?.role !== 'super_admin';
  const canEdit: boolean = forcedReadOnly ? false : (data.can_edit ?? true);
  const canComment: boolean = forcedReadOnly ? false : (data.can_comment ?? true);
  const denyEdit = () => {
    toast.error(forcedReadOnly
      ? 'Halaman ini hanya untuk melihat. Buka kartu dari board aslinya untuk mengubah.'
      : 'Hanya PIC / anggota divisi terkait yang dapat mengubah kartu ini.');
  };
  const gate = (fn: () => Promise<any>) => (canEdit ? fn() : (denyEdit(), Promise.resolve()));

  const invalidate = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['board', item.board_id] });
    qc.invalidateQueries({ queryKey: ['bank-data'] });
  };

  const run = async (fn: () => Promise<any>, successMsg?: string) => {
    try {
      const r = await fn();
      if (r?.data?.warning) toast.warning(r.data.warning);
      if (r?.data?.needs_label_reassign) toast.warning('Beberapa label tidak ada di board tujuan — silakan set ulang label.');
      if (successMsg) toast.success(successMsg);
      invalidate();
      return r;
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const currentUser: CardMember = {
    id: user?.id || 'unknown',
    name: user?.name || 'Unknown',
    initials: initialsOf(user?.name),
    avatarColor: user?.avatar_color || '#091E420F',
  };

  const usersById: Record<string, any> = Object.fromEntries(users.map((u: any) => [u.id, u]));

  const mapMember = (id?: string | null): CardMember | null => {
    if (!id) return null;
    const u = usersById[id];
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      initials: initialsOf(u.name),
      avatarColor: u.avatar_color,
      avatarUrl: u.avatar_url,
    };
  };

  const cardLabels: CardLabel[] = (item.label_ids || [])
    .map((id: string) => {
      const l = (board_labels || []).find((x: any) => x.id === id);
      return l ? { id: l.id, name: l.name, color: l.color } : null;
    })
    .filter(Boolean) as CardLabel[];

  const cardMembers: CardMember[] = (item.member_ids || []).map(mapMember).filter(Boolean) as CardMember[];

  const cardAttachments: CardAttachment[] = (attachments || []).map((a: any) => {
    const isImg = (a.content_type || '').startsWith('image/');
    const url = a.content_type === 'link' ? a.external_url : `${API}/attachments/${a.id}/download`;
    return {
      id: a.id,
      fileName: a.original_filename || 'Berkas',
      url,
      mimeType: a.content_type || 'application/octet-stream',
      createdAt: a.created_at,
      size: a.size || 0,
      thumbUrl: isImg ? `${API}/attachments/${a.id}/download` : null,
    };
  });

  const cardChecklists: Checklist[] = (item.checklists || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    items: (c.items || []).map((i: any) => ({ id: i.id, text: i.text, done: !!i.done })),
  }));

  // ── Timeline gabungan: activity log + comments ──────────────────────────
  const combined: CardActivity[] = [];

  // Activity yang cuma jadi noise di timeline (komentar/lampiran sudah tampil sendiri)
  const NOISE = /(menambahkan komentar|mengubah komentar|menghapus komentar)/i;
  let lastSysKey = '';

  (activities || []).forEach((a: any) => {
    const action: string = a.action || '';
    if (!action || NOISE.test(action)) return;
    // buang duplikat beruntun persis (mis. beberapa "mengubah pekerjaan X" dalam semenit)
    const key = `${a.userId}|${action}`;
    if (key === lastSysKey) return;
    lastSysKey = key;

    const author =
      mapMember(a.userId) ||
      { id: a.userId || 'system', name: a.userName || 'Sistem', initials: initialsOf(a.userName || 'Sistem') };
    combined.push({
      id: a.id,
      kind: 'system',
      author,
      body: action, // nama author ditambahkan oleh CardActivityItem
      createdAt: a.createdAt || a.created_at || new Date().toISOString(),
      canEdit: false,
      canDelete: false,
      origin: a.origin
        ? { workItemId: a.origin.work_item_id, isMaster: a.origin.is_master, label: a.origin.label, picName: a.origin.pic_name }
        : null,
    });
  });

  (comments || []).forEach((c: any) => {
    const author = mapMember(c.created_by_id) || {
      id: c.created_by_id || 'unknown',
      name: c.created_by_name || 'Pengguna',
      initials: initialsOf(c.created_by_name),
    };
    const commentAtts = c.attachment_id ? cardAttachments.filter((att) => att.id === c.attachment_id) : [];
    const edited =
      c.updated_at && +new Date(c.updated_at) - +new Date(c.created_at) > 1500 ? c.updated_at : null;
    combined.push({
      id: c.id,
      kind: 'comment',
      author,
      body: c.text || '',
      createdAt: c.created_at || new Date().toISOString(),
      editedAt: edited,
      attachments: commentAtts,
      canEdit: author.id === currentUser.id,
      canDelete: author.id === currentUser.id || user?.role === 'super_admin',
      origin: c.origin
        ? { workItemId: c.origin.work_item_id, isMaster: c.origin.is_master, label: c.origin.label, picName: c.origin.pic_name }
        : null,
    });
  });

  // CardActivityPanel mengurutkan sendiri (lama → baru); ini hanya biar stabil.
  combined.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  const card: TrelloCard = {
    id: item.id,
    title: item.title,
    clientName: item.client_name ?? null,
    isComplete: item.status === 'done' || item.is_done,
    statusLabel: item.display_status_label,
    statusTone: item.display_status_tone,
    listId: item.list_id,
    listName: list_name || 'List',
    description: item.description || '',
    labels: cardLabels,
    members: cardMembers,
    startDate: item.start_date ?? null,
    dueDate: item.due_date ?? null,
    isWatching: (item.watcher_ids || []).includes(user?.id),
    coverColor: item.cover_color || null,
    coverImageUrl: item.cover_attachment_id ? `${API}/attachments/${item.cover_attachment_id}/download` : null,
    attachments: cardAttachments,
    checklists: cardChecklists,
    activities: combined,
    isArchived: !!(item.is_archived ?? item.archived),
  };

  /** Upload satu file → endpoint attachments (field `file`, satu per request). Return id-nya. */
  const uploadFile = async (f: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await api.post(`/work-items/${curId}/attachments`, fd);
      return r?.data?.id || null;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    }
  };

  /** Upload → URL absolut (untuk disisipkan saat MENGEDIT komentar). */
  const uploadInline = async (f: File) => {
    const id = await uploadFile(f);
    if (!id) return null;
    return {
      url: `${window.location.origin}${API}/attachments/${id}/download`,
      fileName: f.name || 'berkas',
      isImage: (f.type || '').startsWith('image/'),
    };
  };

  return (
   <>
    <CardBack
      card={card}
      currentUser={currentUser}
      open
      onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}

      canEdit={canEdit}
      canComment={canComment}
      picName={item.current_pic_name || null}
      picUserId={item.current_pic_id || null}
      ownerName={item.owner_user_name || null}
      isMasterCard={!item.target_division_id}
      isAssignment={!!data.is_assignment}
      master={data.master ? { id: data.master.id, title: data.master.title, boardName: data.master.board_name, listName: data.master.list_name } : null}
      mentionableUsers={(data.mentionable_users || []).map((u: any) => ({ id: u.id, name: u.name, initials: initialsOf(u.name), avatarColor: u.avatar_color }))}
      assignments={(data.assignments || []).map((a: any) => ({
        id: a.id, title: a.title, divisionName: a.division_name, divisionKey: a.division_key,
        picName: a.pic_name, distributionStatus: a.distribution_status, workStatus: a.work_status, listName: a.list_name,
        displayStatus: a.display_status, displayStatusLabel: a.display_status_label,
        displayStatusTone: a.display_status_tone, isDone: a.is_done,
      }))}
      groupProgress={data.group_progress || null}
      onOpenAssignment={(id: string) => setActiveId(id)}

      allUsers={(users || []).map((u: any) => ({
        id: u.id, name: u.name, initials: initialsOf(u.name), avatarColor: u.avatar_color,
      }))}
      onAssignMembers={async (userId: string, add: boolean) => {
        await gate(() => run(() => api.post(`/work-items/${curId}/assign`, add ? { add_user_ids: [userId] } : { remove_user_ids: [userId] })));
      }}
      onOpenSend={() => setShowSend(true)}
      onOpenMove={() => setShowMove(true)}

      onUpdateCard={async (patch) => {
        if (!canEdit && (patch.isComplete !== undefined || patch.title !== undefined || patch.clientName !== undefined || patch.description !== undefined || patch.startDate !== undefined || patch.dueDate !== undefined || patch.coverColor !== undefined || patch.coverImageUrl !== undefined)) {
          return denyEdit();
        }
        // status (mark complete) tidak lewat PATCH — pakai submit/reopen
        if (patch.isComplete !== undefined) {
          await run(
            () => api.post(`/work-items/${curId}/${patch.isComplete ? 'submit' : 'reopen'}`),
            patch.isComplete ? 'Ditandai selesai' : 'Dibuka kembali',
          );
        }
        if (patch.isWatching !== undefined) {
          await run(() => api.post(`/work-items/${curId}/${patch.isWatching ? 'watch' : 'unwatch'}`));
        }

        const payload: any = {};
        if (patch.title !== undefined) payload.title = patch.title;
        if (patch.clientName !== undefined) payload.client_name = patch.clientName;
        if (patch.description !== undefined) payload.description = patch.description;
        if (patch.startDate !== undefined) payload.start_date = patch.startDate;
        if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;
        if (patch.coverColor !== undefined) payload.cover_color = patch.coverColor ? resolveColor(patch.coverColor) : null;
        if (patch.coverImageUrl !== undefined) {
          // coverImageUrl berbentuk .../attachments/<id>/download → ambil id-nya
          const m = typeof patch.coverImageUrl === 'string' ? patch.coverImageUrl.match(/attachments\/([^/]+)\/download/) : null;
          payload.cover_attachment_id = m ? m[1] : null;
          if (!patch.coverImageUrl) payload.cover_attachment_id = null;
        }
        if (Object.keys(payload).length > 0) {
          await run(() => api.patch(`/work-items/${curId}`, payload));
        }
      }}

      availableLabels={(board_labels || []).map((l: any) => ({ id: l.id, name: l.name, color: l.color }))}
      onToggleLabel={async (labelId: string) => {
        const ids = item.label_ids || [];
        const next = ids.includes(labelId) ? ids.filter((x: string) => x !== labelId) : [...ids, labelId];
        await run(() => api.patch(`/work-items/${curId}`, { label_ids: next }));
      }}
      onUpdateLabel={async (labelId: string, name: string, color: string) => {
        await run(() => api.patch(`/labels/${labelId}`, { name, color }));
      }}
      onCreateLabel={async (name: string, color: string) => {
        const res = await run(() => api.post(`/boards/${item.board_id}/labels`, { name, color }));
        if (res?.data?.id) {
           const next = [...(item.label_ids || []), res.data.id];
           await run(() => api.patch(`/work-items/${curId}`, { label_ids: next }));
        }
      }}

      onUploadInline={uploadInline}
      onAddComment={async (html, files, mentionIds) => {
        let firstId: string | null = null;
        for (const f of files || []) {
          const id = await uploadFile(f);
          if (id && !firstId) firstId = id;
        }
        await run(() =>
          api.post(`/work-items/${curId}/comments`, {
            text: html,
            attachment_id: firstId || undefined,
            mention_user_ids: mentionIds && mentionIds.length ? mentionIds : undefined,
          }),
        );
      }}
      onUpdateComment={async (id, html) => { await run(() => api.patch(`/comments/${id}`, { text: html })); }}
      onDeleteComment={async (id) => { await run(() => api.delete(`/comments/${id}`)); }}

      onAddAttachments={async (files) => {
        for (const f of files) await uploadFile(f);
        invalidate();
      }}
      onDeleteAttachments={async (ids) => {
        for (const id of ids) await run(() => api.delete(`/attachments/${id}`));
      }}
      onRenameAttachment={async () => { toast.info('Ganti nama lampiran belum tersedia'); }}

      checklistTemplates={(checklistTemplates || []).map((t: any) => ({
        id: t.id, name: t.name, items: Array.isArray(t.items) ? t.items : [],
      }))}
      onAddChecklist={async (title, templateItems) => {
        const res = await run(() => api.post(`/work-items/${curId}/checklists`, { title }));
        if (res?.data?.id && templateItems && templateItems.length > 0) {
          for (const text of templateItems) {
            await run(() => api.post(`/work-items/${curId}/checklists/${res.data.id}/items`, { text }));
          }
        }
      }}
      onRenameChecklist={async () => { toast.info('Ganti nama checklist belum tersedia'); }}
      onDeleteChecklist={async (clId) => { await run(() => api.delete(`/work-items/${curId}/checklists/${clId}`)); }}
      onAddChecklistItem={async (clId, text) => {
        await run(() => api.post(`/work-items/${curId}/checklists/${clId}/items`, { text }));
      }}
      onUpdateChecklistItem={async (clId, subId, patch) => {
        await run(() => api.patch(`/work-items/${curId}/checklists/${clId}/items/${subId}`, patch));
      }}
      onDeleteChecklistItem={async (clId, subId) => {
        await run(() => api.delete(`/work-items/${curId}/checklists/${clId}/items/${subId}`));
      }}
      onReorderChecklistItems={async (clId, orderedIds) => {
        await run(() => api.post(`/work-items/${curId}/checklists/${clId}/reorder`, { ordered_ids: orderedIds }));
      }}

      onMoveCard={async (listId, position) => {
        await run(
          () => api.post(`/work-items/${curId}/move`, {
            list_id: listId,
            board_id: item.board_id,
            position: position ?? 65535,
          }),
          'Kartu dipindahkan',
        );
      }}
      onCopyCard={async () => { toast.info('Salin kartu belum tersedia'); }}
      onMirrorCard={async () => { toast.info('Mirror belum tersedia'); }}
      onMakeTemplate={async () => { toast.info('Template belum tersedia'); }}
      onArchiveCard={async () => {
        await run(
          () => api.post(`/work-items/${curId}/${card.isArchived ? 'unarchive' : 'archive'}`),
          card.isArchived ? 'Dikembalikan dari arsip' : 'Diarsipkan',
        );
      }}
      onDeleteCard={async () => {
        const r = await run(() => api.delete(`/work-items/${curId}`), 'Kartu mirror dihapus');
        if (r) {
          qc.invalidateQueries({ queryKey: ['bank-data'] });
          qc.invalidateQueries({ queryKey: ['bank-data-summary'] });
          // kalau yang dihapus adalah kartu turunan yang sedang dibuka, kembali ke master bila ada
          if (data.master?.id && curId !== data.master.id) setActiveId(data.master.id);
          else onClose();
        }
      }}
      onJoin={async () => {
        if (!user?.id) return;
        const r = await run(() => api.post(`/work-items/${curId}/assign`, { add_user_ids: [user.id] }));
        if (r) toast.success(r.data?.became_pic ? 'Anda menjadi PIC kartu ini' : 'Anda bergabung sebagai anggota');
      }}
      onTakePic={async () => {
        await run(() => api.post(`/work-items/${curId}/set-pic`), 'Anda menjadi PIC kartu ini');
      }}
      onTransferOwner={async (userId: string) => {
        await run(() => api.post(`/work-items/${curId}/transfer-owner`, { user_id: userId }), 'Kepemilikan kartu dipindahkan');
      }}
    />

    {showSend && (
      <SendWorkDialog
        item={item}
        onClose={() => setShowSend(false)}
        onDone={() => { setShowSend(false); invalidate(); qc.invalidateQueries({ queryKey: ['bank-data'] }); qc.invalidateQueries({ queryKey: ['bank-data-summary'] }); }}
      />
    )}
    {showMove && (
      <MoveCardDialog
        item={item}
        onClose={() => setShowMove(false)}
        onDone={() => {
          setShowMove(false);
          invalidate();
          qc.invalidateQueries({ queryKey: ['boards'] });
        }}
      />
    )}
   </>
  );
}
