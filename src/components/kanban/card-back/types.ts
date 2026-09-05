export type LabelColor =
  | 'green' | 'yellow' | 'orange' | 'red'
  | 'purple' | 'blue' | 'sky' | 'lime' | 'pink' | 'gray';

export interface CardLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export interface CardMember {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  /** Warna latar avatar (hex). Kalau kosong, di-hash dari id. */
  avatarColor?: string | null;
}

export interface CardAttachment {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  createdAt: string;
  /** URL thumbnail kecil (untuk gambar). Kalau kosong, pakai `url`. */
  thumbUrl?: string | null;
  /** Ukuran file dalam byte (opsional, untuk ditampilkan). */
  size?: number | null;
}

export type ActivityKind = 'comment' | 'system';

/** Penanda asal entri feed bila datang dari kartu lain di grup Master Card. */
export interface FeedOrigin {
  workItemId: string;
  isMaster: boolean;
  label: string;        // mis. "Admin Draf" atau "Master Card"
  picName?: string | null;
}

export interface CardActivity {
  id: string;
  kind: ActivityKind;
  author: CardMember;
  /** HTML hasil editor untuk comment, plain text/HTML pendek untuk system */
  body: string;
  createdAt: string;
  editedAt?: string | null;
  attachments?: CardAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  origin?: FeedOrigin | null;
}

export interface AssignmentSummary {
  id: string;
  title: string;
  divisionName?: string | null;
  divisionKey?: string | null;
  picName?: string | null;
  distributionStatus: string;
  workStatus?: string | null;
  listName?: string | null;
  displayStatus?: string;
  displayStatusLabel?: string;
  displayStatusTone?: string;
  isDone?: boolean;
}

export interface GroupProgress {
  done: number;
  total: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface TrelloCard {
  id: string;
  title: string;
  clientName?: string | null;   // nama klien (info klien)
  isComplete: boolean;
  statusLabel?: string;         // label status yang jelas: "Selesai" / "Sedang dikerjakan" / …
  statusTone?: string;          // green | blue | amber | slate | gray
  listId: string;
  listName: string;
  description: string;          // HTML editor
  labels: CardLabel[];
  members: CardMember[];
  startDate?: string | null;
  dueDate?: string | null;
  isWatching: boolean;
  coverColor?: LabelColor | null;
  coverImageUrl?: string | null;
  attachments: CardAttachment[];
  checklists: Checklist[];
  activities: CardActivity[];
  isArchived: boolean;
}

export interface CardBackProps {
  card: TrelloCard;
  currentUser: CardMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateCard: (patch: Partial<TrelloCard>) => Promise<void>;

  /** Hak akses (dari backend). Default true kalau tak diberi. */
  canEdit?: boolean;
  canComment?: boolean;
  /** Info kepemilikan kartu. */
  picName?: string | null;
  picUserId?: string | null;
  ownerName?: string | null;
  /**
   * Jadikan diri sendiri sebagai PIC. `isTakeover=true` berarti PIC sekarang
   * sudah ada (tombol "Ambil alih") — beda alur/izin dari klaim kartu kosong.
   */
  onTakePic?: (isTakeover?: boolean) => Promise<void>;
  /** Oper kepemilikan (Owner + PIC) ke user lain — dipakai di luar card back. */
  onTransferOwner?: (userId: string) => Promise<void>;
  isMasterCard?: boolean;
  /** Ringkasan assignment turunan (hanya di Master Card). */
  assignments?: AssignmentSummary[];
  /** Ringkasan progres grup: berapa divisi sudah selesai. */
  groupProgress?: GroupProgress | null;
  onOpenAssignment?: (id: string) => void;

  /** Penanda "kartu mirror": kartu ini adalah Assignment dari Master Card di board lain. */
  isAssignment?: boolean;
  master?: { id: string; title: string; boardName?: string | null; listName?: string | null; picName?: string | null } | null;

  /** @mention: kandidat user yang bisa disebut (punya akses). */
  mentionableUsers?: CardMember[];

  /** Labels */
  availableLabels: CardLabel[];
  onToggleLabel: (labelId: string) => Promise<void>;
  onCreateLabel: (name: string, color: LabelColor | string) => Promise<void>;
  onUpdateLabel: (labelId: string, name: string, color: LabelColor | string) => Promise<void>;

  /** Komentar. `files` = lampiran, `mentionIds` = user yang di-@mention. */
  onAddComment: (html: string, files?: File[], mentionIds?: string[]) => Promise<void>;
  /** Unggah satu berkas & kembalikan URL absolut — dipakai saat MENGEDIT komentar. */
  onUploadInline?: (f: File) => Promise<{ url: string; fileName: string; isImage: boolean } | null>;
  onUpdateComment: (id: string, html: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;

  /** Attachments (section terpisah di kolom kiri). */
  onAddAttachments: (files: File[]) => Promise<void>;
  onDeleteAttachments: (ids: string[]) => Promise<void>;
  onRenameAttachment: (id: string, fileName: string) => Promise<void>;

  /** Members / assignment. */
  allUsers?: CardMember[];
  onAssignMembers?: (userId: string, add: boolean) => Promise<void>;
  /** Buka dialog "Kirim ke Divisi" (dari kebab "Mirror"). */
  onOpenSend?: () => void;

  /** Checklist. */
  checklistTemplates?: Array<{ id: string; name: string; items: string[] }>;
  onAddChecklist: (title: string, items?: string[]) => Promise<void>;
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onAddChecklistItem: (checklistId: string, text: string) => Promise<void>;
  onUpdateChecklistItem: (
    checklistId: string,
    itemId: string,
    patch: Partial<Pick<ChecklistItem, 'text' | 'done'>>,
  ) => Promise<void>;
  onDeleteChecklistItem: (checklistId: string, itemId: string) => Promise<void>;
  onReorderChecklistItems: (checklistId: string, orderedItemIds: string[]) => Promise<void>;

  onMoveCard: (listId: string, position: number) => Promise<void>;
  /** Buka dialog pindah kartu (pilih board + list tujuan). */
  onOpenMove?: () => void;
  onCopyCard: (payload: { title: string; listId: string }) => Promise<void>;
  onArchiveCard: () => Promise<void>;
  /** Hapus kartu ini. Untuk assignment/mirror: hanya baris ini yang hilang, Master Card tetap. */
  onDeleteCard?: () => Promise<void>;
  onMirrorCard: (boardId: string) => Promise<void>;
  onMakeTemplate: () => Promise<void>;
  onJoin: () => Promise<void>;
}
