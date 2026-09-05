--
-- PostgreSQL database dump
--

\restrict z00izcuHzOlgH8ivlmAN8y5396I4kIkLytNOBQSjMVEMwSzyhJwhlULemjm6r2e

-- Dumped from database version 15.19
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AssignmentAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AssignmentAction" AS ENUM (
    'CLAIM',
    'UNCLAIM',
    'DIRECT_ASSIGN',
    'TAKE_OVER',
    'REASSIGN'
);


--
-- Name: DistributionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DistributionStatus" AS ENUM (
    'AVAILABLE',
    'CLAIMED',
    'DIRECT_ASSIGNED',
    'RELEASED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Activity" (
    id text NOT NULL,
    "workItemId" text NOT NULL,
    "boardId" text,
    "userId" text NOT NULL,
    "userName" text,
    action text NOT NULL,
    detail jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AppPermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AppPermission" (
    key text NOT NULL,
    label text NOT NULL,
    category text NOT NULL,
    kind text DEFAULT 'feature'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attachment" (
    id text NOT NULL,
    "workItemId" text NOT NULL,
    "storagePath" text NOT NULL,
    "originalFilename" text NOT NULL,
    "contentType" text NOT NULL,
    size integer NOT NULL,
    "uploadedById" text NOT NULL,
    "uploadedByName" text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AutomationRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AutomationRule" (
    id text NOT NULL,
    "boardId" text NOT NULL,
    trigger text NOT NULL,
    "triggerListId" text,
    action text NOT NULL,
    "actionValue" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Board; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Board" (
    id text NOT NULL,
    name text NOT NULL,
    "divisionId" text,
    background text,
    "isArchived" boolean DEFAULT false NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "backgroundImagePath" text,
    "backgroundImageType" text,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BoardMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BoardMember" (
    "boardId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: ChecklistTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChecklistTemplate" (
    id text NOT NULL,
    name text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    "position" double precision DEFAULT 0 NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "workItemId" text NOT NULL,
    "createdById" text NOT NULL,
    "createdByName" text NOT NULL,
    text text NOT NULL,
    "attachmentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CronRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CronRun" (
    "runId" text NOT NULL,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    job text NOT NULL
);


--
-- Name: Division; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Division" (
    id text NOT NULL,
    name text NOT NULL,
    color text,
    key text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Label; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Label" (
    id text NOT NULL,
    "boardId" text NOT NULL,
    name text NOT NULL,
    color text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: List; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."List" (
    id text NOT NULL,
    "boardId" text NOT NULL,
    name text NOT NULL,
    color text,
    "position" double precision NOT NULL,
    "entryRequirements" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    "archivedAt" timestamp(3) without time zone
);


--
-- Name: LoginAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LoginAttempt" (
    identifier text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    "lastAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MasterCard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MasterCard" (
    id text NOT NULL,
    title text NOT NULL,
    client text,
    "ownerUserId" text,
    "ownerDivisionId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "sharedLabels" jsonb DEFAULT '[]'::jsonb NOT NULL,
    price integer,
    "priceNote" text,
    "priceSetAt" timestamp(3) without time zone,
    "priceSetById" text
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    "workItemId" text,
    "boardId" text,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "masterCardId" text NOT NULL,
    amount integer NOT NULL,
    kind text DEFAULT 'dp'::text NOT NULL,
    method text,
    note text,
    "paidAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "picUserId" text,
    "picDivisionId" text,
    "recordedById" text NOT NULL,
    "recordedByName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RolePermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RolePermission" (
    id text NOT NULL,
    role text NOT NULL,
    "permKey" text NOT NULL,
    allowed boolean DEFAULT false NOT NULL
);


--
-- Name: Setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Setting" (
    key text NOT NULL,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    "divisionId" text,
    "avatarColor" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    locale text DEFAULT 'id'::text NOT NULL,
    theme text DEFAULT 'system'::text NOT NULL
);


--
-- Name: WorkItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkItem" (
    id text NOT NULL,
    title text NOT NULL,
    "clientName" text,
    description text,
    "boardId" text NOT NULL,
    "listId" text NOT NULL,
    "position" double precision NOT NULL,
    "dueDate" text,
    priority text DEFAULT 'none'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    "needsApproval" boolean DEFAULT false NOT NULL,
    "createdById" text NOT NULL,
    "createdByName" text,
    "submittedById" text,
    "approvedById" text,
    "hariStage" integer,
    "hariEnteredAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "masterCardId" text,
    "sourceUserId" text,
    "sourceBoardId" text,
    "sourceListId" text,
    "targetDivisionId" text,
    "targetBoardId" text,
    "targetListId" text,
    "currentPicId" text,
    "distributionStatus" public."DistributionStatus" DEFAULT 'AVAILABLE'::public."DistributionStatus" NOT NULL,
    "workStatus" text,
    "claimedAt" timestamp(3) without time zone,
    "releasedAt" timestamp(3) without time zone,
    checklists jsonb,
    "startDate" text,
    "coverAttachmentId" text,
    "coverColor" text,
    "watcherUserIds" text[] DEFAULT ARRAY[]::text[]
);


--
-- Name: WorkItemAssignmentHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkItemAssignmentHistory" (
    id text NOT NULL,
    "workItemId" text NOT NULL,
    "fromUserId" text,
    "toUserId" text,
    action public."AssignmentAction" NOT NULL,
    reason text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkItemDivision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkItemDivision" (
    "workItemId" text NOT NULL,
    "divisionId" text NOT NULL
);


--
-- Name: WorkItemLabel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkItemLabel" (
    "workItemId" text NOT NULL,
    "labelId" text NOT NULL
);


--
-- Name: WorkItemMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkItemMember" (
    "workItemId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: WorkItemMirror; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkItemMirror" (
    "workItemId" text NOT NULL,
    "boardId" text NOT NULL
);


--
-- Data for Name: Activity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Activity" (id, "workItemId", "boardId", "userId", "userName", action, detail, "createdAt") FROM stdin;
e44c4f39-4bbf-44cb-a4ea-0512b0ad41cb	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "PT Nusantara Jaya - Siap Kirim Notaris" dari "FINISH TODAY" ke "FU NOTARIS (ELIS)"	\N	2026-09-04 02:27:26.405
0f4837c5-3eb9-48e4-a9f8-044d3da47525	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 02:55:26.899
993fba82-fa21-4812-9235-6c09b8233133	7dc03ff6-521c-4240-9827-17ff30f0b949	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV Arkana Cipta Persada - Pesan Nama" dari "SIAP KIRIM NOTARIS (ELIS)" ke "LIST"	\N	2026-09-04 03:11:47.512
017677f7-35f4-491a-9e33-6d21659f1203	7dc03ff6-521c-4240-9827-17ff30f0b949	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Pesan Nama" dari "LIST" ke "SIAP KIRIM NOTARIS (ELIS)"	\N	2026-09-04 03:11:47.862
e39f51c5-7b60-4029-a7de-43921e64ddf9	653537b8-3b61-4416-8179-f510392cbf41	c25ed925-60cd-4e6c-9033-a847a6f22ee5	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "PT Graha Sentosa - Pendirian + NIB" tanpa syarat: SK Kemenkumham	\N	2026-09-03 08:28:14.757
cc970e41-09b1-42d6-a751-5bfc9f06d945	653537b8-3b61-4416-8179-f510392cbf41	c25ed925-60cd-4e6c-9033-a847a6f22ee5	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	"PT Graha Sentosa - Pendirian + NIB" masuk HARI 1	\N	2026-09-03 08:28:14.808
6e3fe0c5-6417-443a-8318-c7c674ae96eb	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah label "PT Nusantara Jaya - Siap Kirim Notaris"	\N	2026-09-04 03:11:48.227
205e74d2-1cb3-40d4-b1e6-1195cf47c5b5	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Revisi Akta" dari "SKOR 2" ke "SKOR 3 BUTUH DRAFT"	\N	2026-09-04 03:14:49.006
7d4c0568-4e55-4d8d-bcfe-0a805c1399aa	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Revisi Akta" dari "SKOR 3 BUTUH DRAFT" ke "SKOR 3 REVISI DRAFT"	\N	2026-09-04 05:10:57.21
3195984b-8efe-42fc-95c3-2e4ec8bdcd9a	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 05:47:17.243
94e9dee7-e6e4-4859-bf4c-e1f6c91c4a50	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah pekerjaan "PT Illank Rezeki Abadi - Pendirian PT"	\N	2026-09-03 08:32:01.328
2a3e93e1-2e4e-4fbb-8ab6-9412d8268eaa	a0d1106e-19ae-430b-99df-a0631f79f57b	227bc34c-05cf-428e-a302-e9abb512c955	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan checklist "Checklist"	\N	2026-09-03 08:49:58.057
042c58c1-bf5a-4008-9757-e045a5c5f80e	9c3c889d-171a-4f9b-817e-d7ff4fa159e3	\N	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengirim pekerjaan "UD Sinar Bahagia - NIB OSS" ke Bank Data Admin Draf Input	\N	2026-09-03 08:50:52.284
85e86cd7-de0e-4687-9ef5-8a7a1e735bcd	a0d1106e-19ae-430b-99df-a0631f79f57b	227bc34c-05cf-428e-a302-e9abb512c955	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "UD Sinar Bahagia - NIB OSS"	\N	2026-09-03 08:50:52.299
35062053-429f-4e30-9e43-5323c303f0e6	9c3c889d-171a-4f9b-817e-d7ff4fa159e3	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-03 08:51:28.605
ce6781ba-95e2-4c0d-a7ac-04738a5337d8	f589af2c-4103-4b7c-9880-424a11304c9e	\N	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengirim pekerjaan "PT Nusantara Jaya - Proses Notaris" ke Bank Data Admin Draf Input	\N	2026-09-03 08:53:32.477
36f17960-8b8f-42c5-8270-e9a463476779	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-03 08:53:32.489
a22dba7e-9e7f-473d-b860-408464dca35a	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-03 08:53:56.475
4163017a-fc5c-4d27-8add-21a2d504d910	653537b8-3b61-4416-8179-f510392cbf41	c25ed925-60cd-4e6c-9033-a847a6f22ee5	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "PT Graha Sentosa - Pendirian + NIB" tanpa syarat: SK Kemenkumham	\N	2026-09-03 09:09:08.183
e9272862-b1c6-4c50-afb1-92da408f5051	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan komentar	\N	2026-09-03 09:12:06.697
b0a388fd-e161-446f-aaca-5ab0d6384152	653537b8-3b61-4416-8179-f510392cbf41	c25ed925-60cd-4e6c-9033-a847a6f22ee5	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "PT Graha Sentosa - Pendirian + NIB" tanpa syarat: SK Kemenkumham	\N	2026-09-03 09:22:41.627
2e0ec742-debc-4e1b-a148-a966b9408208	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menugaskan PIC pada "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-03 09:28:13.823
d3d75647-dec2-4157-8135-05fa08bb74e1	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan komentar	\N	2026-09-03 09:29:16.26
ba03cd90-8891-4948-a06b-00a1e8038dc9	7c827bbf-e16f-4de5-8a47-c8400dd90e7b	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengarsipkan "PT Illank Rezeki Abadi - Draft Akta"	\N	2026-09-04 00:33:37.686
3865b622-86f3-43f3-8964-f91f9c3f8984	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "PT Illank Rezeki Abadi - Pendirian PT"	\N	2026-09-04 00:34:08.116
b9359731-35f3-4f13-9705-6e22f6fe35c2	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan checklist "Checklist"	\N	2026-09-04 00:42:29.946
375611c4-18f8-4277-8985-c43d87b410df	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 00:50:10.325
3e1ba1df-1737-4a31-8b79-ff1cf2accc39	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 00:50:25.183
e8104efb-c6ac-4434-a3f7-fbdc789d79a2	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "PT Illank Rezeki Abadi - Pendirian PT"	\N	2026-09-04 01:11:59.51
3160ef0e-e1ff-4234-ab65-1c566d760b83	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 01:16:45.38
73d88b33-2880-416c-b07a-f33579e2cdb1	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 01:18:00.248
73e0c67f-1425-4240-a068-e65f395ac530	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	Otomatisasi: progres "Akta" selesai	{}	2026-09-04 01:21:20.035
232966d6-4fa5-451a-abd9-28fe2f346e3d	9c3c889d-171a-4f9b-817e-d7ff4fa159e3	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "UD Sinar Bahagia - NIB OSS" dari "LIST" ke "DOING"	\N	2026-09-04 02:40:35.915
e6184db7-9319-48da-a81a-fee710f74a1b	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Revisi Akta" dari "SKOR 2" ke "COWORKING & VO"	\N	2026-09-04 01:34:33.052
834bac83-3f37-49ee-842b-3f7e747e5e76	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Revisi Akta" dari "COWORKING & VO" ke "SKOR 2"	\N	2026-09-04 01:34:33.293
1ab2d636-20be-4aa0-a84c-52ba7211a509	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan komentar	\N	2026-09-04 01:34:47.202
4c60afd5-d915-496e-97b7-a8279f3471e2	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 01:46:38.712
9c2e420f-b803-4097-b9f2-1d486edae5d0	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-04 03:07:15.952
a87b2855-17a6-49b3-aaa3-3f78da085cea	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	memindahkan "PT Illank Rezeki Abadi - Pendirian PT" dari "SKOR 1" ke "SKOR 2"	\N	2026-09-04 01:52:01.357
e90f7750-47b0-4254-9494-9427dd4836a9	31e21678-2353-4070-a1e4-e13bfb60eae9	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "CV Arkana Cipta Persada - Revisi Akta" ke Bank Data Admin Draf Input	\N	2026-09-04 01:56:11.146
d6e14270-75af-4123-aeb9-e966bb78c726	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 01:56:11.194
af3365c2-0bfd-432f-b95a-aa76f092822e	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 01:57:29.086
90754f92-9946-488c-a57f-4ec32e1cc449	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "CV Arkana Cipta Persada - Revisi Akta" ke Bank Data Admin Draf Input	\N	2026-09-04 01:59:32.303
1b558794-18a0-47e6-be2f-6ac6479cb1ba	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 01:59:32.324
dda7e4df-8485-4c82-a816-af013a1924b5	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-04 03:07:48.313
db657ae3-01e2-4d0b-ae8b-ee218bcb2298	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan komentar	\N	2026-09-04 02:11:32.172
9768e565-731e-4ccd-a1e4-1c79fb3ac8ef	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:14:23.13
df655446-9629-4486-81ff-dc56977a69ec	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus assignment "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input (Master Card tetap ada)	\N	2026-09-04 02:14:23.927
67d2545c-8ca1-4488-8062-341e88edeec7	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan komentar	\N	2026-09-04 02:15:45.316
418f1c2d-ff24-4c4f-8c75-d61347ee49b9	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan komentar	\N	2026-09-04 03:11:11.214
587fb70c-f74f-40a5-a2ab-53684f54e3dd	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:15:47.15
c5620024-34f5-4023-9768-0c5f98f5f6a3	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus assignment "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input (Master Card tetap ada)	\N	2026-09-04 02:15:47.445
15a7614c-aecc-4ca3-8807-5550c9cb5ba8	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah label "PT Nusantara Jaya - Siap Kirim Notaris"	\N	2026-09-04 03:11:13.023
27f554ad-9189-4419-9624-60416825df34	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:16:55.98
1b7cec4f-6999-4c99-833f-193bd2e17d06	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 02:16:56.124
e6be2a14-03e7-4006-868b-9fe2eaa02f56	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "PT Nusantara Jaya - Siap Kirim Notaris"	\N	2026-09-04 03:11:13.336
d37bda3b-a000-4b27-9bfc-574acabd713d	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:16:57.084
164cbacd-c9eb-49e6-83ad-bb96ce6d863c	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 02:16:57.205
ab19c964-17a8-4ec9-a162-93651eb4ce3b	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:16:57.977
a0c03996-4975-4d16-b22f-38044b65645c	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 02:16:58.269
1a045ec6-486e-44e6-bfaf-bc438b503671	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 2 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:19:27.289
b3e9ae8c-c010-452e-9d9f-6702b3433860	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 02:19:28.16
06305552-bfea-489b-8855-723310d0088a	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Pajak — Master Card tetap ada	\N	2026-09-04 02:19:28.291
e69699d3-5171-44e1-bec6-33fa52e7520f	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah label "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:21:05.634
f0bfab13-593b-4886-a169-7f72886f9c5d	9c3c889d-171a-4f9b-817e-d7ff4fa159e3	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "UD Sinar Bahagia - NIB OSS" dari "DOING" ke "LIST"	\N	2026-09-04 02:40:38.567
332b5c53-8882-4b32-b927-59b0461c9d33	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "PT Nusantara Jaya - Siap Kirim Notaris" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 03:11:14.477
d870bd6e-74f7-4311-b104-cf7d1bbddd69	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 2 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:21:06.079
cb1ab2d1-4759-4e95-b17e-434c30b739fb	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 02:21:07.779
2364ebbb-e9d8-4f4a-9a09-daf355d26e0a	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Pajak — Master Card tetap ada	\N	2026-09-04 02:21:07.958
61a7727c-169b-47ec-a221-a4bb15b679da	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah label "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:21:08.442
7adb7806-d019-44ba-bbdf-1dbeef8bd04e	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menambahkan komentar	\N	2026-09-04 02:21:33.631
fd3aa3db-bf2b-452a-88a0-13343106f4a0	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 03:24:45.532
3b45e37e-696e-4282-a4c5-6a68283d66c7	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "CV Arkana Cipta Persada - Revisi Akta"	\N	2026-09-04 02:21:35.382
6a1720a2-e64f-4e9a-9c73-3ac2320b204b	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 02:21:36.063
936e5bbe-0501-4038-86a2-f6decb75b77a	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 02:24:18.884
240ad12f-b3e0-467f-8068-b93af7efc47d	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menghapus kartu mirror "PT Illank Rezeki Abadi - Pendirian PT" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 02:25:52.58
70612712-166f-46ba-b395-0e33dac8f332	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "CV Arkana Cipta Persada - Revisi Akta" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-04 03:24:47.711
d156c8bd-c050-4f6a-834e-239bf0e4bfc0	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Revisi Akta" dari "SKOR 3 REVISI DRAFT" ke "SKOR 3 BUTUH DRAFT"	\N	2026-09-04 05:11:00.657
56ec7895-f1fa-489e-b43b-23a6eb1b1717	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengunggah lampiran "contoh layout.jpeg"	\N	2026-09-04 05:47:16.756
16a81027-f439-44fe-bbee-f0fcbc3b2a26	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengunggah lampiran "Sertifikat-DID2023065179.pdf"	\N	2026-09-04 05:49:17.251
8c2a2963-71ab-42a9-8bdf-2a3f7d25495b	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-04 05:49:17.566
52b82235-7456-4aef-9a6a-aac9a478edeb	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 05:50:55.762
6a09890c-65d9-4e9d-87ed-2e7480e1ed40	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 05:51:09.823
a447340d-f5a3-4477-bd89-b158722969ef	a2accb54-08ed-40b4-a27f-b2a11613088a	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat pekerjaan "PT ABC"	\N	2026-09-04 05:59:31.247
019ae5bc-1302-4130-8ef7-9eeeb9c80490	a2accb54-08ed-40b4-a27f-b2a11613088a	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengarsipkan "PT ABC"	\N	2026-09-04 05:59:57.274
0e9bd709-a589-48b4-96e6-202ec2de577a	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat pekerjaan "PT MAJU MUNDUR"	\N	2026-09-04 06:00:17.805
45f4c4cf-b246-4e56-8005-8b9cb51f98ee	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "PT MAJU MUNDUR" ke Bank Data Admin Draf Input	\N	2026-09-04 06:06:06.087
b089a167-88da-4c35-8c0d-8ad385f516d0	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "PT MAJU MUNDUR"	\N	2026-09-04 06:06:06.096
1599f34d-686d-4187-af8a-3e8d71e8d2e7	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengambil pekerjaan "PT MAJU MUNDUR"	\N	2026-09-04 06:06:16.575
eb922f7c-0d63-4334-b03d-ce30b3cf8ff1	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 06:07:14.172
e7c56d34-621b-48db-987c-60004910ba2c	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-04 06:07:27.803
96d38f88-e67f-42d1-b1b1-9835bac50b3b	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengubah label "PT MAJU MUNDUR"	\N	2026-09-04 06:09:27.662
86de0c14-d010-4ecd-bca5-eb0d0e748298	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengubah label "PT MAJU MUNDUR"	\N	2026-09-04 06:09:30.182
a494321d-e766-4b45-8b40-f42606a35382	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengubah label "PT MAJU MUNDUR"	\N	2026-09-04 06:09:37.896
d335e898-9067-47f6-bf6d-66a8ea9ba2b2	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengubah label "PT MAJU MUNDUR"	\N	2026-09-04 06:09:42.383
a6a7e2a5-7173-434b-8fe6-2fb4ed480fb5	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:11:04.861
209eeaae-1e9f-475a-b204-4828326c2601	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:11:06.974
f40be080-372a-4a82-b13f-d2188b918dcf	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:11:08.225
eb89a4b9-ed2e-4de1-8b33-cb5a315eecec	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:21:54.758
d84233fb-7794-49bc-8233-3a695e0b1b2d	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:21:55.745
6a92a511-81cf-4106-9df5-979f127e2d84	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:21:56.333
72c621eb-39f9-412c-9470-4f0cef8c66cf	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:21:57.944
8afcc322-e583-442d-a729-48ef9bfb1e5a	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:22:12.236
4a47ba0d-f692-4ca7-ab2e-55a785292701	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengubah pekerjaan "PT MAJU MUNDUR"	\N	2026-09-04 06:22:15.267
0298b182-4be8-4e33-96ac-14b96ef2fdf6	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengubah pekerjaan "PT MAJU MUNDUR"	\N	2026-09-04 06:22:31.434
8b619ebf-df41-4df3-9b73-f667ec64d8c6	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menugaskan PIC pada "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:23:46.256
df7cd367-7a11-4cc1-aea3-b645057502de	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:27:49.183
231ca7d4-52ab-4504-ae80-791c25c05339	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 06:41:17.775
55a0b0de-8042-4c96-93ff-3b086ce5c7bc	c5808557-38b5-4010-9cae-afbdcca1ffd2	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "CV MAJU MUNDUR" ke Bank Data Admin Draf Input	\N	2026-09-04 06:41:47.884
98b3acbb-0478-469c-b48f-61eb3a12f08c	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "CV MAJU MUNDUR"	\N	2026-09-04 06:41:47.912
b6f2a228-0e84-47fc-a584-184800118a61	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengambil pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 06:41:58.999
00d97d22-a9a4-4a60-8e3f-147e6445750c	5a2e0b65-4590-455c-b95f-9fb634005ed1	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "PT Nusantara Jaya - Proses Notaris" dari "SKOR 3 BUTUH DRAFT" ke "COWORKING & VO" (board CS DEDES ALI)	\N	2026-09-04 06:42:36.15
2e59b9e1-36af-4c34-8b1c-6e9c24dc0186	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "PT Nusantara Jaya - Proses Notaris" dari "COWORKING & VO" ke "COWORKING & VO" (board CS DEVI ALI)	\N	2026-09-04 06:42:37.393
922f9d65-5c14-4291-9b33-cce45510a0bd	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-04 06:47:39.363
e8b9ae08-a3c3-45f4-b89e-af030ab1d28a	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menyelesaikan pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:59:11.157
2589d360-e1ea-489f-ba62-581f75f0538e	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuka kembali pekerjaan "PT Nusantara Jaya - Proses Notaris"	\N	2026-09-04 06:59:12.697
41853ce8-567a-43a3-95e9-371d61391051	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "PT Nusantara Jaya - Proses Notaris" dari "LIST" ke "FINISH TODAY"	\N	2026-09-04 06:59:14.118
3ea94e55-2ac5-49c4-bd0c-e90b944df2b1	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "PT Nusantara Jaya - Proses Notaris" dari "FINISH TODAY" ke "LIST"	\N	2026-09-04 06:59:15.525
9932a834-738e-49a2-bdec-550fc9e9ac85	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV MAJU MUNDUR" dari "LIST" ke "FINISH TODAY"	\N	2026-09-04 07:01:45.095
7e4c59fb-1e35-4560-9327-bdeb7a27f0a8	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	memindahkan "CV MAJU MUNDUR" dari "SKOR 1" ke "SKOR 2"	\N	2026-09-04 07:09:09.579
0bfb1395-a94a-46b9-9809-4d3a0cf48023	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	memindahkan "CV MAJU MUNDUR" dari "SKOR 2" ke "SKOR 1"	\N	2026-09-04 07:09:13.311
d8ee72be-9dbf-4550-a3df-7ccae8147efd	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:09:31.534
7a35f354-a3b2-4a7e-a100-6eec9f8a1062	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menyelesaikan pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:09:39.657
deeb9f3e-d978-49fb-af65-a24556825842	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menyelesaikan pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:09:47.069
3cb64618-e262-40f2-827b-d6a0af162516	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:09:51.49
3d8da361-4173-4534-be72-e652f944970f	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:09:56.391
6a5a9df1-00a2-49ef-8827-a826b4c3a862	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:10:25.646
39439777-2a51-4d34-8f80-4b612a0bac56	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:10:22.133
3d51e4bc-b296-4ce8-877f-7e2c4dc33635	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengubah pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:10:28.311
50cc0cd6-8f49-4939-9baa-16bcd7e48b32	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menyelesaikan pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:10:32.898
770d6a1f-9eb1-405f-afdd-6eefca0e5b4c	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:10:37.315
4e392232-0a64-4d9a-b09e-2b069976d643	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:10:43.534
a017deb6-50ff-42ca-93c7-52ac9c47199a	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:10:51.1
0e0913e4-1c08-4305-9544-17100a228850	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	pekerjaan "CV MAJU MUNDUR" dibuka kembali — masih ada divisi yang belum selesai	\N	2026-09-04 07:18:36.327
8af8ae19-1fbf-4688-978a-1f16a96d21c7	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menyelesaikan pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:19:38.881
2b784e47-d697-4331-a430-f8abd6a7f9ba	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV MAJU MUNDUR" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-04 07:19:39.021
7c6e8c68-6a3f-4922-b51b-c26a3a86ceaa	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:19:47.053
b2f8fb66-c216-4423-acf2-5e990a38e265	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV MAJU MUNDUR" dibuka kembali — masih ada divisi yang belum selesai	\N	2026-09-04 07:19:47.21
0f298476-ba4b-449d-9ddc-d76255ae2cf5	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "CV MAJU MUNDUR" ke Bank Data Admin Pajak	\N	2026-09-04 07:20:40.779
4e726043-33e7-40c0-9365-8887575bccf5	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "CV MAJU MUNDUR"	\N	2026-09-04 07:20:40.792
6cfee0e9-b412-4ed0-93cb-314e06f1ce5c	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	mengambil pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:20:56.65
43deb1b3-bb36-4a32-acaf-9b5e58a02470	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	memindahkan "CV MAJU MUNDUR" dari "LIST SPT TAHUNAN" ke "LIST NPWP"	\N	2026-09-04 07:21:07.708
236a6128-8beb-4489-9837-c2de6a9076ef	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menyelesaikan pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:21:38.088
4e2a3fbe-b68e-45bd-ac7f-19f9ff3dd019	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	menyelesaikan pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:21:44.837
8858325f-99df-40fe-8f2e-d74cf77aa0ef	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	pekerjaan "CV MAJU MUNDUR" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-04 07:21:44.895
77d1ec4a-64f4-4eee-94f1-0cbd0e39190a	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	membuka kembali pekerjaan "CV MAJU MUNDUR"	\N	2026-09-04 07:21:58.868
16c49a12-1f2e-4315-92de-217068357dac	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV MAJU MUNDUR" dibuka kembali — masih ada divisi yang belum selesai	\N	2026-09-04 07:21:59.024
9d14d927-7f72-44b2-ab5e-73bf008a524e	b8189e4d-65dc-4eec-8b39-d2bf461b242b	c7bcde01-3e94-41fb-8925-1a0c73301b05	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menugaskan PIC pada "CV MAJU MUNDUR"	\N	2026-09-04 07:22:21.695
2461824e-0489-4ac6-aec5-83dc9d8d3c81	b8189e4d-65dc-4eec-8b39-d2bf461b242b	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	memindahkan "CV MAJU MUNDUR" dari "SKOR 1" ke "SKOR 2" (board CS DEDES ALI)	\N	2026-09-04 07:22:37.596
5de45af0-8897-4364-90f3-1f1ddafad597	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	menambahkan komentar	\N	2026-09-04 07:37:28.124
243568e9-22cc-4b1b-ba84-7fa147b26d72	1d425560-b11a-4af8-84ed-620af29bdbbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat pekerjaan "PT MAJU JAYA"	\N	2026-09-04 08:04:50.831
9df7dcf7-3fe2-4d58-adb4-9c11cd1adfcf	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "PT MAJU JAYA" ke Bank Data Admin Draf Input	\N	2026-09-04 08:05:58.413
a77b072c-684c-4a7c-b7ca-6a87e17d8489	1d425560-b11a-4af8-84ed-620af29bdbbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "PT MAJU JAYA"	\N	2026-09-04 08:05:58.493
37d77040-1a42-4b78-9c15-4bfaceb34b31	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengunggah lampiran "Sertifikat-DID2023065179.pdf"	\N	2026-09-04 08:06:45.532
88bb1c28-f7f4-4c75-9164-a83c0e6b2091	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menambahkan komentar	\N	2026-09-04 08:06:47.052
bf9540c7-1f91-43af-a2cb-a7c730b2c2b5	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menyelesaikan pekerjaan "PT MAJU JAYA"	\N	2026-09-04 08:06:57.91
87a40e97-ead5-4c58-b74e-4bc3f55da640	1d425560-b11a-4af8-84ed-620af29bdbbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "PT MAJU JAYA" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-04 08:06:58.061
9eb015b1-8484-4193-ad45-5881f892a19f	ad56ba40-ff17-4316-bb16-89758d84fb71	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "PT MAJU JAYA" ke Bank Data Admin Pajak	\N	2026-09-04 08:08:05.937
d674578e-7cc6-44fe-9068-079ee6bedead	1d425560-b11a-4af8-84ed-620af29bdbbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "PT MAJU JAYA"	\N	2026-09-04 08:08:05.965
6914c0ec-d420-43c6-958d-dcb6f9e959e3	1d425560-b11a-4af8-84ed-620af29bdbbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	pekerjaan "PT MAJU JAYA" dibuka kembali — masih ada divisi yang belum selesai	\N	2026-09-04 08:08:07.678
18351ada-565b-4f68-8e38-4f4136feb2a7	ad56ba40-ff17-4316-bb16-89758d84fb71	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	mengambil pekerjaan "PT MAJU JAYA"	\N	2026-09-04 08:08:36.238
ebdeb605-16ca-4611-8829-3027ab49523d	f76d4aae-53bb-4fcc-9e78-93e6e6eb7126	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	menambahkan komentar	\N	2026-09-04 08:38:37.861
e1452a75-4905-409a-a485-8e31f833ed1f	f76d4aae-53bb-4fcc-9e78-93e6e6eb7126	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengambil "UD Sinar Bahagia - Pengumpulan Berkas" sebagai PIC	\N	2026-09-04 08:44:15.607
ad62ffb4-ae47-4729-9e93-390d2a4ada69	1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	input pekerjaan client offline "PT SATU DUA TIGA" ke Bank Data Customer Service	\N	2026-09-04 09:11:11.675
7be1fe53-ccf5-4034-ae69-c20df1d50566	1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengambil pekerjaan "PT SATU DUA TIGA"	\N	2026-09-04 09:12:11.528
55164285-608b-4fc8-bdcb-b5c9a9ec07cf	653537b8-3b61-4416-8179-f510392cbf41	c25ed925-60cd-4e6c-9033-a847a6f22ee5	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memajukan HARI 2	\N	2026-09-04 09:23:53.461
5aae428c-aa00-448a-be7f-7e718042139c	653537b8-3b61-4416-8179-f510392cbf41	c25ed925-60cd-4e6c-9033-a847a6f22ee5	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memajukan HARI 1	\N	2026-09-04 09:23:56.088
bf084833-2756-4132-b30e-9c3ab4651ccb	8057a7b1-0471-4a41-b699-cb043e935555	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat pekerjaan "tes"	\N	2026-09-04 09:37:55.561
c3fcf287-aaae-4fbf-8ad9-a722c7015ca0	852e6b2b-3826-4020-84a0-320833b9abbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat pekerjaan "tes"	\N	2026-09-04 10:25:50.841
154e63a4-1d19-445c-846f-f853d39f0d10	852e6b2b-3826-4020-84a0-320833b9abbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengarsipkan "tes"	\N	2026-09-04 10:26:02.149
f7b7cbce-2155-4348-bb4a-0025e2892c23	8057a7b1-0471-4a41-b699-cb043e935555	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengarsipkan "tes"	\N	2026-09-04 10:26:17.169
495d6abc-e3a2-41b6-aaab-f1a3975c8f87	7dc03ff6-521c-4240-9827-17ff30f0b949	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV Arkana Cipta Persada - Pesan Nama" dari "SIAP KIRIM NOTARIS (ELIS)" ke "LIST"	\N	2026-09-04 10:52:32.654
6faaad5d-ed3e-4d17-a335-f78acc082527	7dc03ff6-521c-4240-9827-17ff30f0b949	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV Arkana Cipta Persada - Pesan Nama" dari "LIST" ke "SIAP KIRIM NOTARIS (ELIS)"	\N	2026-09-04 10:53:04.992
c2785d02-5cd9-4d72-8dc5-afd984386d45	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Revisi Akta" dari "SKOR 3 BUTUH DRAFT" ke "SKOR 3 REVISI DRAFT"	\N	2026-09-04 10:56:42.607
0115518d-d2f1-43e6-b27d-1b86ab9c67dc	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	memindahkan "CV Arkana Cipta Persada - Revisi Akta" dari "SKOR 3 REVISI DRAFT" ke "SKOR 3 BUTUH DRAFT"	\N	2026-09-04 10:56:44.731
db454575-b0a9-45ce-ac3b-affe93ead7fa	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	menambahkan komentar	\N	2026-09-04 11:31:40.649
c6afd062-6be1-43f8-817b-def8e418b01c	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV MAJU MUNDUR" dari "FINISH TODAY" ke "FU NOTARIS (ELIS)"	\N	2026-09-04 13:11:48.7
84f4749d-a157-4c13-9e65-ae619a12fd0e	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV MAJU MUNDUR" dari "FU NOTARIS (ELIS)" ke "FINISH TODAY"	\N	2026-09-04 13:11:51.679
b20b53a9-8098-4314-a720-4e313a1df8cc	b8189e4d-65dc-4eec-8b39-d2bf461b242b	128957a0-cc7a-4087-9ec1-ca6ab0977f34	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV MAJU MUNDUR" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-04 13:11:51.788
fa8cbb56-647a-4dcc-b883-f27d27be05a8	199835d1-7b23-4b48-b614-584246a93847	\N	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengirim pekerjaan "PT MAJU JAYA" ke Bank Data Admin Draf Input	\N	2026-09-05 00:33:27.749
dca49ef0-a5fa-4e2d-802d-713b1a6182f9	1d425560-b11a-4af8-84ed-620af29bdbbc	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat 1 assignment dari "PT MAJU JAYA"	\N	2026-09-05 00:33:27.768
c228648c-aa52-4333-91af-fd178bdc2499	199835d1-7b23-4b48-b614-584246a93847	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengambil pekerjaan "PT MAJU JAYA"	\N	2026-09-05 00:34:23.554
24000206-4572-4b8e-8c01-8ea0e033e0dd	fdcccffc-2f2a-46d0-be5c-f40af4d32c14	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat pekerjaan "PT SATWA"	\N	2026-09-05 00:37:24.169
a4e0a729-4d7e-430d-93a3-be9592610b7f	fdcccffc-2f2a-46d0-be5c-f40af4d32c14	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengoper kepemilikan "PT SATWA" ke Dewi Ali	\N	2026-09-05 00:37:41.977
e60ec399-1821-4400-ac78-f3b4be197509	fdcccffc-2f2a-46d0-be5c-f40af4d32c14	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengoper kepemilikan "PT SATWA" ke Dedes Ali	\N	2026-09-05 00:37:56.43
ce2571b1-a60a-4c9f-ac38-f316f72aedec	e98913e0-1bcf-4904-b0e2-33f07a20a2b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	membuat pekerjaan "PT ABC"	\N	2026-09-05 00:38:24.207
2b63d9f6-ef2d-4ce5-a54f-2fdcbac97d27	fdcccffc-2f2a-46d0-be5c-f40af4d32c14	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengarsipkan "PT SATWA"	\N	2026-09-05 00:38:30.72
a449f907-db04-40ab-ba0f-e0dd1ad493f4	e98913e0-1bcf-4904-b0e2-33f07a20a2b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	mengoper kepemilikan "PT ABC" ke Dedes Ali	\N	2026-09-05 00:39:06.236
ef319688-d505-495b-9f0b-c7721d4ce6f2	41fbface-ec6a-417c-af5a-5150ed584853	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat pekerjaan "PT DANANTARA INC NIB"	\N	2026-09-05 00:42:26.76
fcf3b3bc-41bf-4c0f-b460-76f8797d80e6	ed22a6df-71c0-4748-aa74-167c0ae7297d	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	mengirim pekerjaan "PT DANANTARA INC NIB" ke Bank Data Admin Draf Input	\N	2026-09-05 00:42:50.503
e7585b92-8017-4620-863c-a57ca0574f29	41fbface-ec6a-417c-af5a-5150ed584853	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "PT DANANTARA INC NIB"	\N	2026-09-05 00:42:50.518
75b78961-2102-4f0c-8168-2d5d585d12af	5839a909-35b1-4528-a30b-9af575616c61	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	input pekerjaan client offline "TES KIRIM DATA" ke Bank Data Customer Service	\N	2026-09-05 00:44:06.718
4b364be1-0ea3-4d9f-9275-a83d8c2f71ab	929450fa-2614-47b0-9ba6-b322fd78bc6d	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	input pekerjaan client offline "TES KIRIM DATA" ke Bank Data Customer Service	\N	2026-09-05 00:44:27.891
a4c2d6a1-928a-4f46-88e4-6cc3a395ff3e	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	membuat 1 assignment dari "PT MAJU MUNDUR"	\N	2026-09-05 00:58:45.116
20265417-7f06-4b54-a6f3-70e9519a42d6	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	menghapus kartu mirror "PT MAJU MUNDUR" di Bank Data Admin Draf Input — Master Card tetap ada	\N	2026-09-05 00:59:49.374
116299c2-d500-4a1c-a82a-9d3a35b41e6b	b25c564d-1446-4476-9eca-3ceee16bcb3e	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	input pekerjaan client offline "PT TES TES" ke Bank Data Customer Service	\N	2026-09-05 01:09:09.828
aa6c622a-75ae-497d-b5a5-1d15abaa52fc	b25c564d-1446-4476-9eca-3ceee16bcb3e	128957a0-cc7a-4087-9ec1-ca6ab0977f34	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	mengambil pekerjaan "PT TES TES"	\N	2026-09-05 01:11:48.586
a10b1ab6-4c73-44ed-9b8e-67c73413464b	24b28ecc-1eaf-40e0-9e39-3ca47212e496	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	mengirim pekerjaan "PT TES TES" ke Bank Data Admin Draf Input	\N	2026-09-05 01:12:18.356
fefbfc9a-e8f0-4628-8281-77d79c9f3e2d	b25c564d-1446-4476-9eca-3ceee16bcb3e	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	membuat 1 assignment dari "PT TES TES"	\N	2026-09-05 01:12:18.366
4c33b602-e247-42c6-bfcf-4bba670323ae	24b28ecc-1eaf-40e0-9e39-3ca47212e496	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengambil pekerjaan "PT TES TES"	\N	2026-09-05 01:12:28.872
ae41ad6f-c62c-4699-980d-139fbe34fa36	24b28ecc-1eaf-40e0-9e39-3ca47212e496	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menyelesaikan pekerjaan "PT TES TES"	\N	2026-09-05 01:16:05.019
b53a4591-91f1-41e8-9c1e-a9c747f216af	b25c564d-1446-4476-9eca-3ceee16bcb3e	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	menyelesaikan pekerjaan "PT TES TES"	\N	2026-09-05 01:22:57.826
1190e47b-8357-46f7-a263-7aae41684151	b25c564d-1446-4476-9eca-3ceee16bcb3e	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	membuka kembali pekerjaan "PT TES TES"	\N	2026-09-05 01:23:11.046
8464ab0b-3111-4752-8892-a32da9872ddf	b25c564d-1446-4476-9eca-3ceee16bcb3e	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	menyelesaikan pekerjaan "PT TES TES"	\N	2026-09-05 02:37:11.13
8ef7e395-fde3-4379-88c4-f9096ecad128	b25c564d-1446-4476-9eca-3ceee16bcb3e	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	membuka kembali pekerjaan "PT TES TES"	\N	2026-09-05 02:37:13.234
51c41df7-395d-4574-9e5e-bf7c96ba376d	b25c564d-1446-4476-9eca-3ceee16bcb3e	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	pekerjaan "PT TES TES" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-05 02:43:26.593
09692e77-6f77-45fa-997a-e945f4c6f8ea	b25c564d-1446-4476-9eca-3ceee16bcb3e	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "PT TES TES" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-05 02:43:26.599
a1d02d76-0915-4cc5-be3c-02beac4a8e95	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	mengambil "CV Mentari Pagi - Komplain Dokumen" sebagai PIC	\N	2026-09-05 03:16:56.613
47a6c9a4-8bba-4df4-8b7e-f6e49e25f5d9	cfce7263-8a62-453f-99e1-b5ea25df6bcc	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	mengirim pekerjaan "CV Mentari Pagi - Komplain Dokumen" ke Bank Data Admin Draf Input	\N	2026-09-05 03:17:06.701
66a85724-7475-45a4-b61a-375779098706	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	membuat 1 assignment dari "CV Mentari Pagi - Komplain Dokumen"	\N	2026-09-05 03:17:06.722
adea3424-7dbb-471e-8b74-3da0348301f1	cfce7263-8a62-453f-99e1-b5ea25df6bcc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	mengambil pekerjaan "CV Mentari Pagi - Komplain Dokumen"	\N	2026-09-05 03:18:48.615
791a01d9-5d1c-4808-9476-98cf1eec1f85	cfce7263-8a62-453f-99e1-b5ea25df6bcc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	menyelesaikan pekerjaan "CV Mentari Pagi - Komplain Dokumen"	\N	2026-09-05 03:19:26.417
2c877e45-08f5-4287-90a2-cfdef7c9262c	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV Mentari Pagi - Komplain Dokumen" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-05 03:19:26.484
bdef0cfe-dc95-4335-a7d9-f4bce54115a6	cfce7263-8a62-453f-99e1-b5ea25df6bcc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	membuka kembali pekerjaan "CV Mentari Pagi - Komplain Dokumen"	\N	2026-09-05 03:19:36.48
8d08a9dc-fd8f-468a-b97b-fa5fe00b2f34	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV Mentari Pagi - Komplain Dokumen" dibuka kembali — masih ada divisi yang belum selesai	\N	2026-09-05 03:19:36.554
6a68f4f8-18a7-435e-aadb-38071b26cbd7	cfce7263-8a62-453f-99e1-b5ea25df6bcc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV Mentari Pagi - Komplain Dokumen" dari "LIST" ke "DOING"	\N	2026-09-05 03:19:51.267
6993942c-38aa-4992-b5db-254e26045c20	cfce7263-8a62-453f-99e1-b5ea25df6bcc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	memindahkan "CV Mentari Pagi - Komplain Dokumen" dari "DOING" ke "FINISH TODAY"	\N	2026-09-05 03:19:54.838
257d1afa-57fc-43c4-9a8d-b2cc6e8511f5	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV Mentari Pagi - Komplain Dokumen" selesai — semua divisi telah menyelesaikan bagiannya	\N	2026-09-05 03:19:54.887
51d9aa81-f868-4cfc-872d-9f7790299f47	cfce7263-8a62-453f-99e1-b5ea25df6bcc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	membuka kembali pekerjaan "CV Mentari Pagi - Komplain Dokumen"	\N	2026-09-05 03:21:11.522
7505a52c-17d7-4dc3-a64d-6c43f39f4e36	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	pekerjaan "CV Mentari Pagi - Komplain Dokumen" dibuka kembali — masih ada divisi yang belum selesai	\N	2026-09-05 03:21:11.576
\.


--
-- Data for Name: AppPermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AppPermission" (key, label, category, kind, "createdAt") FROM stdin;
report.view	Buka halaman Rekap & Performa (per user, per divisi, keuangan)	Halaman	feature	2026-09-04 11:28:02.156
table.CronRun	Akses langsung tabel "CronRun"	Tabel Database	table	2026-09-04 03:03:48.844
board.manage_members	Atur anggota board	Board & List	feature	2026-09-04 03:03:48.743
division.manage	Kelola divisi	Administrasi	feature	2026-09-04 03:03:48.73
finance.manage	Input harga job & catat pembayaran (DP / lunas)	Keuangan	feature	2026-09-04 11:28:02.166
table.BoardMember	Akses langsung tabel "BoardMember"	Tabel Database	table	2026-09-04 03:03:48.8
table.WorkItemMirror	Akses langsung tabel "WorkItemMirror"	Tabel Database	table	2026-09-04 03:03:48.829
card.archive	Arsipkan / kembalikan kartu	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.765
list.manage	Buat / ubah / hapus / urutkan list	Board & List	feature	2026-09-04 03:03:48.746
automation.manage	Kelola aturan otomatisasi	Administrasi	feature	2026-09-04 03:03:48.732
bankdata.intake	Input pekerjaan baru langsung ke Bank Data	Bank Data & Distribusi	feature	2026-09-04 03:03:48.778
checklist_template.manage	Kelola template checklist	Administrasi	feature	2026-09-04 03:03:48.735
list.entry_requirements	Ubah syarat pindah list & warna list	Board & List	feature	2026-09-04 03:03:48.748
card.delete	Hapus kartu / kartu mirror (assignment)	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.767
table.MasterCard	Akses langsung tabel "MasterCard"	Tabel Database	table	2026-09-04 03:03:48.792
label.manage	Buat / ubah label board	Board & List	feature	2026-09-04 03:03:48.75
table.Comment	Akses langsung tabel "Comment"	Tabel Database	table	2026-09-04 03:03:48.831
table.List	Akses langsung tabel "List"	Tabel Database	table	2026-09-04 03:03:48.803
table.Label	Akses langsung tabel "Label"	Tabel Database	table	2026-09-04 03:03:48.805
table.Activity	Akses langsung tabel "Activity"	Tabel Database	table	2026-09-04 03:03:48.833
table.Setting	Akses langsung tabel "Setting"	Tabel Database	table	2026-09-04 03:03:48.845
card.comment	Tulis / ubah / hapus komentar	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.769
table.WorkItem	Akses langsung tabel "WorkItem"	Tabel Database	table	2026-09-04 03:03:48.807
table.Payment	Akses langsung tabel "Payment"	Tabel Database	table	2026-09-04 11:30:47.556
table.AppPermission	Akses langsung tabel "AppPermission"	Tabel Database	table	2026-09-04 03:03:48.847
bankdata.claim	Klaim / ambil pekerjaan dari Bank Data	Bank Data & Distribusi	feature	2026-09-04 03:03:48.78
table.Division	Akses langsung tabel "Division"	Tabel Database	table	2026-09-04 03:03:48.793
table.RolePermission	Akses langsung tabel "RolePermission"	Tabel Database	table	2026-09-04 03:03:48.849
card.create	Buat kartu pekerjaan	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.753
permission.manage	Kelola matriks hak akses ini	Administrasi	feature	2026-09-04 03:03:48.738
table.ChecklistTemplate	Akses langsung tabel "ChecklistTemplate"	Tabel Database	table	2026-09-04 03:03:48.851
table.WorkItemAssignmentHistory	Akses langsung tabel "WorkItemAssignmentHistory"	Tabel Database	table	2026-09-04 03:03:48.852
card.edit	Ubah isi kartu (judul, deskripsi, tanggal, cover)	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.76
table.WorkItemLabel	Akses langsung tabel "WorkItemLabel"	Tabel Database	table	2026-09-04 03:03:48.81
bankdata.release	Lepaskan pekerjaan	Bank Data & Distribusi	feature	2026-09-04 03:03:48.782
board.view_all	Lihat SEMUA board (hanya-baca, lintas divisi)	Board & List	feature	2026-09-04 09:23:49.001
bankdata.takeover	Ambil alih pekerjaan orang lain	Bank Data & Distribusi	feature	2026-09-04 03:03:48.784
table.User	Akses langsung tabel "User"	Tabel Database	table	2026-09-04 03:03:48.795
card.move	Pindahkan / geser kartu antar list & board	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.762
table.WorkItemMember	Akses langsung tabel "WorkItemMember"	Tabel Database	table	2026-09-04 03:03:48.812
table.Notification	Akses langsung tabel "Notification"	Tabel Database	table	2026-09-04 03:03:48.836
card.assign_members	Tetapkan anggota / PIC ke kartu	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.771
card.complete	Tandai selesai / buka kembali pekerjaan	Kartu / Pekerjaan	feature	2026-09-04 03:03:48.773
table.AutomationRule	Akses langsung tabel "AutomationRule"	Tabel Database	table	2026-09-04 03:03:48.838
card.transfer_owner	Pindahkan kepemilikan (Owner) job ke orang lain	Kartu / Pekerjaan	feature	2026-09-05 01:41:32.012
table.Attachment	Akses langsung tabel "Attachment"	Tabel Database	table	2026-09-04 03:03:48.84
table.LoginAttempt	Akses langsung tabel "LoginAttempt"	Tabel Database	table	2026-09-04 03:03:48.842
hari.view	Buka halaman Board Harian (Hari 1-7)	Halaman	feature	2026-09-04 03:03:48.786
table.Board	Akses langsung tabel "Board"	Tabel Database	table	2026-09-04 03:03:48.798
table.WorkItemDivision	Akses langsung tabel "WorkItemDivision"	Tabel Database	table	2026-09-04 03:03:48.815
user.manage	Kelola pengguna (tambah / ubah / hapus / reset password)	Administrasi	feature	2026-09-04 03:03:48.714
board.edit_all	Ubah SEMUA board (lintas divisi) — bukan hanya-baca	Board & List	feature	2026-09-04 10:49:12.743
board.manage	Buat / ubah / hapus board	Board & List	feature	2026-09-04 03:03:48.74
bankdata.send_to_division	Kirim pekerjaan ke Divisi (Bank Data)	Bank Data & Distribusi	feature	2026-09-04 03:03:48.775
hari.advance	Majukan tahap HARI pada Board Harian	Halaman	feature	2026-09-04 03:03:48.787
skor.view	Buka halaman Peta Skor Global	Halaman	feature	2026-09-04 03:03:48.789
\.


--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attachment" (id, "workItemId", "storagePath", "originalFilename", "contentType", size, "uploadedById", "uploadedByName", "isDeleted", "createdAt") FROM stdin;
61d27556-afa7-4356-a9f1-2c88bd8aaa84	5a2e0b65-4590-455c-b95f-9fb634005ed1	5a2e0b65-4590-455c-b95f-9fb634005ed1/dc54a6cc-f933-4f9d-ad75-cdafa3216657_contoh layout.jpeg	contoh layout.jpeg	image/jpeg	162200	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	f	2026-09-04 05:47:16.747
d0399525-5912-4ebe-bc51-0a4ac1cc6514	f589af2c-4103-4b7c-9880-424a11304c9e	f589af2c-4103-4b7c-9880-424a11304c9e/c7990bea-b808-45d1-a064-ac8b90ee329d_Sertifikat-DID2023065179.pdf	Sertifikat-DID2023065179.pdf	application/pdf	1152185	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	f	2026-09-04 05:49:17.246
37747727-0c10-4018-97c0-cc58277acdc7	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	3da677b2-eb8a-4091-92ce-fc9ed3a50d23/424afbb5-8d38-4685-b703-ad4da3d4c851_Sertifikat-DID2023065179.pdf	Sertifikat-DID2023065179.pdf	application/pdf	1152185	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	f	2026-09-04 08:06:45.503
\.


--
-- Data for Name: AutomationRule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AutomationRule" (id, "boardId", trigger, "triggerListId", action, "actionValue", "createdById", "createdAt") FROM stdin;
74ce78eb-b903-4ff8-ae42-094a02e0ca7e	128957a0-cc7a-4087-9ec1-ca6ab0977f34	card_mirrored	\N	add_label	243561e1-374c-46d1-81f3-308f6577a208	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.31
e9475b8a-0bcb-4504-89d3-ced70015f05f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	mirror_removed	\N	remove_label	243561e1-374c-46d1-81f3-308f6577a208	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.31
374b97b5-eff8-4f2c-b254-b4cd91f23bc7	86dd6b98-bc2b-41e6-bff1-57298581b511	card_mirrored	\N	add_label	d3cce10c-fd2f-42f2-a935-e52a2609bf42	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.386
a879117b-98cd-425b-8d93-1ad422822148	86dd6b98-bc2b-41e6-bff1-57298581b511	mirror_removed	\N	remove_label	d3cce10c-fd2f-42f2-a935-e52a2609bf42	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.386
52c3bae8-007e-4c83-b5f3-98e04706160c	c25ed925-60cd-4e6c-9033-a847a6f22ee5	card_mirrored	\N	add_label	69075bb2-c651-4d7d-99a7-faa5ffe054de	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.48
375bd780-488c-41a4-8351-25b83bed25bf	c25ed925-60cd-4e6c-9033-a847a6f22ee5	mirror_removed	\N	remove_label	69075bb2-c651-4d7d-99a7-faa5ffe054de	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.48
bb84441c-d6c2-49aa-acd6-d4acd897ded2	c7bcde01-3e94-41fb-8925-1a0c73301b05	card_mirrored	\N	add_label	5ad4901c-d366-4dfa-afae-6bdbd982b6f2	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.567
0a9fb56a-7504-40ea-a31a-a8693b398933	c7bcde01-3e94-41fb-8925-1a0c73301b05	mirror_removed	\N	remove_label	5ad4901c-d366-4dfa-afae-6bdbd982b6f2	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.567
6ea3d2fa-2607-4398-abe6-25444e9a89bb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	card_mirrored	\N	add_label	62e987f9-1572-41c7-8d96-244ea4b538ac	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.651
66ed44eb-0d43-4eb6-91ea-16eddd2a1fb8	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	mirror_removed	\N	remove_label	62e987f9-1572-41c7-8d96-244ea4b538ac	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.651
45967bc2-75f7-4e46-bf62-3f1531e564ed	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	card_mirrored	\N	add_label	ab18bbd7-c6c1-4f06-b7a5-c7b878de441b	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.693
4184e944-92cd-4417-ba57-fa76a87101bb	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	mirror_removed	\N	remove_label	ab18bbd7-c6c1-4f06-b7a5-c7b878de441b	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.693
7596abf9-03f0-47ea-9aa1-8f46ae8e7710	227bc34c-05cf-428e-a302-e9abb512c955	card_mirrored	\N	add_label	40a5d61d-f8f5-4dfb-b606-61db1ccd7fbf	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.742
01f5f998-fbb8-4d6f-ade5-d6ea2fdef3a4	227bc34c-05cf-428e-a302-e9abb512c955	mirror_removed	\N	remove_label	40a5d61d-f8f5-4dfb-b606-61db1ccd7fbf	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.742
9980898d-2f44-4263-9623-fa2ad1de10dd	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	card_mirrored	\N	add_label	ddc4b7b3-34ef-42c8-ac0d-9e6ed107896a	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.798
f27e4ed1-8a74-4f7e-9351-415cb2f812f3	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	mirror_removed	\N	remove_label	ddc4b7b3-34ef-42c8-ac0d-9e6ed107896a	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.798
\.


--
-- Data for Name: Board; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Board" (id, name, "divisionId", background, "isArchived", "createdById", "createdAt", "backgroundImagePath", "backgroundImageType", "updatedAt") FROM stdin;
1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	ADMIN DRAF INPUT	5749c390-4c94-419d-a2b5-1ee98952427f	#D29034	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.574	board-bg/1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363/6385097d-f951-4099-a8c0-abc94eb526a9.jpeg	image/jpeg	2026-09-04 07:55:10.979
128957a0-cc7a-4087-9ec1-ca6ab0977f34	CS DEDES ALI	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#4BBF6B	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.219	board-bg/128957a0-cc7a-4087-9ec1-ca6ab0977f34/89081700-76f7-4dd0-a3e7-06bac9670d9f.jpeg	image/jpeg	2026-09-04 07:55:18.815
227bc34c-05cf-428e-a302-e9abb512c955	ADMIN PERIZINAN	e05204d7-05d1-42c9-a989-590cc1cf67e5	#CD5A91	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.696	board-bg/227bc34c-05cf-428e-a302-e9abb512c955/a8df7028-fe2c-402c-9b53-e3ceab297fef.jpeg	image/jpeg	2026-09-04 07:56:25.06
86dd6b98-bc2b-41e6-bff1-57298581b511	CS DEVI ALI	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#519839	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.316	board-bg/86dd6b98-bc2b-41e6-bff1-57298581b511/3ff77d5f-a131-459a-a37b-b4be180ec4eb.jpeg	image/jpeg	2026-09-04 07:56:36.291
aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	DESAIN & KONTEN	2bf8ea7b-5215-4e59-807c-a06b4734c7fe	#00AECC	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.745	board-bg/aa85c43e-9ccf-4db5-b82d-ff9d371d7da4/9f6f0bb6-232c-4b8e-ba85-e388f24e59e6.jpeg	image/jpeg	2026-09-04 07:56:52.318
c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	ADMIN PAJAK	5fc5b0c9-9335-4663-8e98-49512bf24b89	#4BBF6B	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.654	board-bg/c09b0177-ed62-4dd1-bf0c-419b6e0f53a7/c113e2e3-9dd0-4141-891a-efba4e53af02.jpeg	image/jpeg	2026-09-04 07:57:02.455
c25ed925-60cd-4e6c-9033-a847a6f22ee5	CS DEWI ALI	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#B04632	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.391	board-bg/c25ed925-60cd-4e6c-9033-a847a6f22ee5/e1112e61-6459-4e3d-8a8e-07bcb928429b.jpeg	image/jpeg	2026-09-04 07:57:10.794
c7bcde01-3e94-41fb-8925-1a0c73301b05	CS JULIA ALI	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#89609E	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:24:03.484	board-bg/c7bcde01-3e94-41fb-8925-1a0c73301b05/cb9cc5a2-1545-416a-ba69-02c27e7628f9.jpeg	image/jpeg	2026-09-04 07:57:18.738
\.


--
-- Data for Name: BoardMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BoardMember" ("boardId", "userId") FROM stdin;
128957a0-cc7a-4087-9ec1-ca6ab0977f34	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
86dd6b98-bc2b-41e6-bff1-57298581b511	d0723d2c-9568-4349-a3b0-75cd66310c99
c25ed925-60cd-4e6c-9033-a847a6f22ee5	a843cda0-4e41-40b9-95a0-a9eef8fdaef6
c7bcde01-3e94-41fb-8925-1a0c73301b05	ede08911-c701-4524-8687-73971fd33d78
1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	278f85a0-ca0e-48c4-97a2-e2728476ea52
1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11
c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea
227bc34c-05cf-428e-a302-e9abb512c955	0cb23c6d-98fe-42bd-a305-78e03f0673cf
aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	02474385-9aea-4556-9bc8-e1a0b152fb44
\.


--
-- Data for Name: ChecklistTemplate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ChecklistTemplate" (id, name, items, "position", "createdById", "createdAt", "updatedAt") FROM stdin;
3c7702e5-f997-4c0c-adaf-4e24193b9fb5	PENDIRIAN PT UMUM	["AKTA", "SK k", "NPWP", "NIB"]	10	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-04 02:01:14.553	2026-09-04 02:12:17.224
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Comment" (id, "workItemId", "createdById", "createdByName", text, "attachmentId", "createdAt", "updatedAt") FROM stdin;
bbe4c73d-54b2-406b-ab94-316e338b4d6f	9c3c889d-171a-4f9b-817e-d7ff4fa159e3	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	<p>tes admin elis</p>	\N	2026-09-03 08:51:28.59	2026-09-03 08:51:28.59
e5ed1ad0-2d6d-449b-a662-97500ecf3193	f589af2c-4103-4b7c-9880-424a11304c9e	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	<p>tes elis</p>	\N	2026-09-03 08:53:56.461	2026-09-03 08:53:56.461
ec3ba9ab-7fe0-4a1a-a69a-f8929720f450	5a2e0b65-4590-455c-b95f-9fb634005ed1	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	<p>halo @elis</p>	\N	2026-09-03 09:12:06.654	2026-09-03 09:12:06.654
c474dae3-abfc-485f-aab9-d44d931a36e5	5a2e0b65-4590-455c-b95f-9fb634005ed1	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	<p>di lanjut revisi nya <span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@Elis</span></p>	\N	2026-09-03 09:29:16.255	2026-09-03 09:29:16.255
9dd2e059-ae3f-4ff0-b78c-94d78fd4dd56	51d95517-9a19-4493-a365-8710ac4fc28f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes</p>	\N	2026-09-04 00:50:10.28	2026-09-04 00:50:10.28
e2ee6dce-e905-45e1-8cce-595d6466574a	51d95517-9a19-4493-a365-8710ac4fc28f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes</p>	\N	2026-09-04 00:50:25.17	2026-09-04 00:50:25.17
764d11b8-f526-46c8-bcc4-83b74a7fe012	51d95517-9a19-4493-a365-8710ac4fc28f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes</p>	\N	2026-09-04 01:16:45.363	2026-09-04 01:16:45.363
98753da5-31bb-4801-9950-9c6bdacbab9b	51d95517-9a19-4493-a365-8710ac4fc28f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>halo <span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@Elis</span></p>	\N	2026-09-04 01:18:00.223	2026-09-04 01:18:00.223
eced5a34-8f83-473f-a989-9ac5be50a839	bd3ad592-2a3c-4347-aff4-ff64efd584be	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	realtime test 1788485687166	\N	2026-09-04 01:34:47.187	2026-09-04 01:34:47.187
7c4461c0-3f08-40a8-a355-562df0dcd533	51d95517-9a19-4493-a365-8710ac4fc28f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes comment</p>	\N	2026-09-04 01:46:38.695	2026-09-04 01:46:38.695
36dfaabd-be56-4496-9342-0c1fc5cfc55f	bd3ad592-2a3c-4347-aff4-ff64efd584be	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes comment</p>	\N	2026-09-04 01:57:29.068	2026-09-04 01:57:29.068
97e5e197-94d3-4dd0-9077-760459dcc416	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	📩 Catatan dari Dedes Ali saat mengirim pekerjaan:\n\ndi bantu buatkan draft nya	\N	2026-09-04 01:59:32.313	2026-09-04 01:59:32.313
ef357919-9e0e-453e-bd5d-1f6f603180a5	51d95517-9a19-4493-a365-8710ac4fc28f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes</p>	\N	2026-09-04 02:24:18.868	2026-09-04 02:24:18.868
99373353-845a-4edb-9d31-2379b71a143b	bd3ad592-2a3c-4347-aff4-ff64efd584be	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes</p>	\N	2026-09-04 02:55:26.883	2026-09-04 02:55:26.883
333cfc0d-4be0-4295-afa7-629d28b95ef6	5a2e0b65-4590-455c-b95f-9fb634005ed1	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>mohon di revisi</p>	61d27556-afa7-4356-a9f1-2c88bd8aaa84	2026-09-04 05:47:17.21	2026-09-04 05:47:17.21
ecd145a6-e2d2-48d5-b2ca-189c75f01573	f589af2c-4103-4b7c-9880-424a11304c9e	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	<p>Berikut  sudah di revisi <span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@Devi Ali</span></p>	d0399525-5912-4ebe-bc51-0a4ac1cc6514	2026-09-04 05:49:17.529	2026-09-04 05:49:17.529
ecbf8858-0f85-4a1b-a64b-9d0156af03d7	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>di bantu proses draft nya <span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@Elis</span></p>	\N	2026-09-04 06:07:14.163	2026-09-04 06:07:14.163
737b5fba-5977-404c-acc1-14b8950cc671	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	<p><span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@Dedes Ali</span> oke</p>	\N	2026-09-04 06:07:27.788	2026-09-04 06:07:27.788
7cbba64d-69c5-4d37-8eba-2dd1909dc807	c5808557-38b5-4010-9cae-afbdcca1ffd2	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	📩 Catatan dari Dedes Ali saat mengirim pekerjaan:\n\ndi bantu proses draft sementara nya	\N	2026-09-04 06:41:47.898	2026-09-04 06:41:47.898
fd6d07b1-5def-44b7-b6b2-9a8e714e7758	c5808557-38b5-4010-9cae-afbdcca1ffd2	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	<p>siap di proses @de</p>	\N	2026-09-04 06:47:39.346	2026-09-04 07:14:25.566
310b905a-960b-4d41-ac48-32d6ee48f335	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	📩 Catatan dari Dedes Ali saat mengirim pekerjaan:\n\ndi bantu buatkan npwp pribadi pak hasby	\N	2026-09-04 07:20:40.788	2026-09-04 07:20:40.788
8221d6f3-18f3-4b68-a7c4-cc96e147f289	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	<p>siap kak <span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@Dedes Ali</span></p>	\N	2026-09-04 07:37:28.109	2026-09-04 07:37:28.109
361e2acb-c7d5-4383-be0b-2ff168d37fef	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	📩 Catatan dari Dedes Ali saat mengirim pekerjaan:\n\nDi bantu buatkan draft nya	\N	2026-09-04 08:05:58.46	2026-09-04 08:05:58.46
286d79da-1b1d-400c-89ff-463adae09774	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	<p>Berikut draft nya <span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@Dedes Ali</span></p>	37747727-0c10-4018-97c0-cc58277acdc7	2026-09-04 08:06:46.93	2026-09-04 08:06:46.93
ca247fd2-d938-4869-9442-c68f72cc3355	f76d4aae-53bb-4fcc-9e78-93e6e6eb7126	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	<p>tes comment</p>	\N	2026-09-04 08:38:37.816	2026-09-04 08:38:37.816
\.


--
-- Data for Name: CronRun; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CronRun" ("runId", at, job) FROM stdin;
\.


--
-- Data for Name: Division; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Division" (id, name, color, key, "createdAt") FROM stdin;
be50b6cf-7350-44c7-bfc8-f36ed55f63d1	Customer Service	#0C66E4	cs	2026-09-03 08:24:01.946
5749c390-4c94-419d-a2b5-1ee98952427f	Admin Draf Input	#E56910	draf	2026-09-03 08:24:01.951
5fc5b0c9-9335-4663-8e98-49512bf24b89	Admin Pajak	#22A06B	pajak	2026-09-03 08:24:01.955
e05204d7-05d1-42c9-a989-590cc1cf67e5	Admin Perizinan	#9F8FEF	perizinan	2026-09-03 08:24:01.958
2bf8ea7b-5215-4e59-807c-a06b4734c7fe	Desain & Konten	#E774BB	desain	2026-09-03 08:24:01.962
\.


--
-- Data for Name: Label; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Label" (id, "boardId", name, color, "createdAt") FROM stdin;
e27c06ba-5e7f-42e2-a9a4-aeea19b0459f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	LUNAS	#22A06B	2026-09-03 08:24:03.276
c607d0e4-c59e-4801-a707-4160a3240ac3	128957a0-cc7a-4087-9ec1-ca6ab0977f34	DP	#F5CD47	2026-09-03 08:24:03.281
6fc2bcba-67a3-4c3c-a7cc-b8982af8fd78	128957a0-cc7a-4087-9ec1-ca6ab0977f34	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.283
6806eef1-7856-49d8-bd7e-c7450fd36fe6	128957a0-cc7a-4087-9ec1-ca6ab0977f34	URGENT	#CA3521	2026-09-03 08:24:03.285
2a219dcf-0b87-4e77-a908-7dc088d57cf1	128957a0-cc7a-4087-9ec1-ca6ab0977f34	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.286
eac7a74a-eb64-4b4e-a7e3-bbf50bd1cdec	128957a0-cc7a-4087-9ec1-ca6ab0977f34	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.288
3cb1a4b7-9318-4b5a-9d94-d9940494c1a2	128957a0-cc7a-4087-9ec1-ca6ab0977f34	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.29
37a58c90-c478-46f0-ace8-0f2fca5d805c	128957a0-cc7a-4087-9ec1-ca6ab0977f34	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.292
8e8240f1-de85-486a-909c-ccd4e1dacbee	128957a0-cc7a-4087-9ec1-ca6ab0977f34	MKS	#6CC3E0	2026-09-03 08:24:03.296
5168487b-418d-4acd-9b08-3c061e66d628	128957a0-cc7a-4087-9ec1-ca6ab0977f34	JKT	#94C748	2026-09-03 08:24:03.298
e72fc888-0ed4-40eb-bc75-4c36162eb554	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.3
df8de397-2d90-4252-b31b-bedea897673d	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.302
74ef8564-0718-4bce-9e2c-69dec9e5e29e	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.305
243561e1-374c-46d1-81f3-308f6577a208	128957a0-cc7a-4087-9ec1-ca6ab0977f34	TER-MIRROR	#2684FF	2026-09-03 08:24:03.307
c497a450-1daf-42b5-8e1c-46cdb8ded1ed	86dd6b98-bc2b-41e6-bff1-57298581b511	LUNAS	#22A06B	2026-09-03 08:24:03.356
28e0a7f8-e21d-46ec-93a3-d5d08d221cdd	86dd6b98-bc2b-41e6-bff1-57298581b511	DP	#F5CD47	2026-09-03 08:24:03.358
fd0acf6d-2265-410c-b580-1a9b759cfdcd	86dd6b98-bc2b-41e6-bff1-57298581b511	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.36
e8fe6200-4ef8-4905-b4cd-2e78ac21ff62	86dd6b98-bc2b-41e6-bff1-57298581b511	URGENT	#CA3521	2026-09-03 08:24:03.362
40ec5151-8340-49a7-924e-6bf57210a7b4	86dd6b98-bc2b-41e6-bff1-57298581b511	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.364
9fa550a2-bd4f-447c-bb4d-6f0be678df5b	86dd6b98-bc2b-41e6-bff1-57298581b511	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.367
aa07db8a-51de-4a2d-8ddf-9862b175a4bb	86dd6b98-bc2b-41e6-bff1-57298581b511	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.369
044c79dd-4c62-4089-97d6-56f15c798bff	86dd6b98-bc2b-41e6-bff1-57298581b511	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.371
ea393280-b069-46de-bbb4-25c78329bab1	86dd6b98-bc2b-41e6-bff1-57298581b511	MKS	#6CC3E0	2026-09-03 08:24:03.374
71f6320b-ace9-4b79-9367-774658ee8b94	86dd6b98-bc2b-41e6-bff1-57298581b511	JKT	#94C748	2026-09-03 08:24:03.375
e6f98367-8e13-44f8-a385-114c273db449	86dd6b98-bc2b-41e6-bff1-57298581b511	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.377
69f2e46c-5d09-426e-81ae-4a403ef804fd	86dd6b98-bc2b-41e6-bff1-57298581b511	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.38
4672b1b6-6901-4ac4-b101-f3dc362100c4	86dd6b98-bc2b-41e6-bff1-57298581b511	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.382
d3cce10c-fd2f-42f2-a935-e52a2609bf42	86dd6b98-bc2b-41e6-bff1-57298581b511	TER-MIRROR	#2684FF	2026-09-03 08:24:03.384
8cff907b-4057-4441-8c2a-d3cf1a0958ee	c25ed925-60cd-4e6c-9033-a847a6f22ee5	LUNAS	#22A06B	2026-09-03 08:24:03.445
9e5ef588-6535-41b4-9057-f3dec3e7f5dc	c25ed925-60cd-4e6c-9033-a847a6f22ee5	DP	#F5CD47	2026-09-03 08:24:03.447
f9a9a3af-7b0b-444e-b9f8-f4b533b29b7b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.451
52d2baf3-3c07-4ed9-8bcb-26b4c30a6e04	c25ed925-60cd-4e6c-9033-a847a6f22ee5	URGENT	#CA3521	2026-09-03 08:24:03.454
aa79514f-80a2-46e2-bec3-97c4798effb8	c25ed925-60cd-4e6c-9033-a847a6f22ee5	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.457
25cb7815-0758-4d95-b5d6-afa51e1f153a	c25ed925-60cd-4e6c-9033-a847a6f22ee5	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.46
13384893-d3d0-4226-a991-674f7f3ad6b9	c25ed925-60cd-4e6c-9033-a847a6f22ee5	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.462
e214f4ac-e8a6-4fd3-b6e6-b8b524192d4b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.465
c7a6df5d-c0f9-4602-a834-7accf3fa9893	c25ed925-60cd-4e6c-9033-a847a6f22ee5	MKS	#6CC3E0	2026-09-03 08:24:03.466
5749960e-e4dc-4437-9cee-cb945c018df8	c25ed925-60cd-4e6c-9033-a847a6f22ee5	JKT	#94C748	2026-09-03 08:24:03.469
f7a8f081-807b-44fe-8550-1bd29e4186e1	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.472
85b14281-0ee5-4639-84e2-431b2d7e8763	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.474
027014b4-f821-4148-9dac-681054d0508c	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.475
69075bb2-c651-4d7d-99a7-faa5ffe054de	c25ed925-60cd-4e6c-9033-a847a6f22ee5	TER-MIRROR	#2684FF	2026-09-03 08:24:03.478
facff83b-bcad-43fc-b419-be92d9acab8b	c7bcde01-3e94-41fb-8925-1a0c73301b05	LUNAS	#22A06B	2026-09-03 08:24:03.532
0b8053fd-249e-447f-ad34-ef5ed20d162d	c7bcde01-3e94-41fb-8925-1a0c73301b05	DP	#F5CD47	2026-09-03 08:24:03.534
3b78c1cd-4a21-4840-84de-33cc22436713	c7bcde01-3e94-41fb-8925-1a0c73301b05	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.536
4f17cf4b-ed86-4c2a-bf75-4e94fc9b2569	c7bcde01-3e94-41fb-8925-1a0c73301b05	URGENT	#CA3521	2026-09-03 08:24:03.537
0ae88a1a-669c-461b-bd12-1df16649f81d	c7bcde01-3e94-41fb-8925-1a0c73301b05	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.54
4d6087f9-152a-42f5-ab68-1e9863db0955	c7bcde01-3e94-41fb-8925-1a0c73301b05	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.543
23dd09f8-6cd3-4963-9697-763021ffc120	c7bcde01-3e94-41fb-8925-1a0c73301b05	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.545
760675d1-57cb-4414-bc2b-7896a146c802	c7bcde01-3e94-41fb-8925-1a0c73301b05	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.547
85227551-bedc-494e-bf6c-016c8d9d4b21	c7bcde01-3e94-41fb-8925-1a0c73301b05	MKS	#6CC3E0	2026-09-03 08:24:03.55
1cac0c34-6fb4-42f3-b0f7-fd2d5f3201a2	c7bcde01-3e94-41fb-8925-1a0c73301b05	JKT	#94C748	2026-09-03 08:24:03.553
93cfa50d-7e40-499b-9c4a-fff951deb135	c7bcde01-3e94-41fb-8925-1a0c73301b05	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.556
2cc959b8-6ef7-4ba7-bb2d-e87eff8ede50	c7bcde01-3e94-41fb-8925-1a0c73301b05	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.559
9f0fecac-19a1-4a62-982a-2907a5cd02c1	c7bcde01-3e94-41fb-8925-1a0c73301b05	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.562
5ad4901c-d366-4dfa-afae-6bdbd982b6f2	c7bcde01-3e94-41fb-8925-1a0c73301b05	TER-MIRROR	#2684FF	2026-09-03 08:24:03.565
dba8085f-cb78-4fa2-9db3-68534a20e0f8	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	LUNAS	#22A06B	2026-09-03 08:24:03.619
a691ddbc-94c9-4ef7-8a2a-b0f3cc0dde47	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	DP	#F5CD47	2026-09-03 08:24:03.621
614e7554-a57f-469f-9c3a-6d3622d84393	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.624
f9a2b6fb-5444-40dc-8006-0fa2ae2a779e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	URGENT	#CA3521	2026-09-03 08:24:03.628
8033c539-dd29-4ee0-b8fd-9186c755e1be	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.632
437dd8ff-a56e-48a5-8632-25c28462f762	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.634
62e987f9-1572-41c7-8d96-244ea4b538ac	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	TER-MIRROR	#2684FF	2026-09-03 08:24:03.649
ac05ba8c-4fae-4e68-97d6-5bfbe3aaf33c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	LUNAS	#22A06B	2026-09-03 08:24:03.673
906497b6-c943-48a1-8a43-958ce2a39bbb	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	DP	#F5CD47	2026-09-03 08:24:03.675
c599cf77-fdb0-4ea7-ac2b-a791fd244c37	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.676
100d4e23-2bdc-4299-8142-6e10c58b9b54	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	URGENT	#CA3521	2026-09-03 08:24:03.678
a5e8bd80-3c65-4a52-9fac-77475b79ba25	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.679
6fad5505-ab1a-475a-9bdb-0b70901e8e38	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.681
12190bf0-09a3-4405-839f-db7082939fc4	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.682
f5e1ec21-b50b-4ed6-a466-025afe7f6779	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.683
26841ee1-3576-4932-885c-aa8b9135f77c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	MKS	#6CC3E0	2026-09-03 08:24:03.685
35055ab4-a68b-46de-9b94-fab96513faf5	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	JKT	#94C748	2026-09-03 08:24:03.686
28a5317a-47dc-4c7a-ac1a-d2d6caa3859c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.688
d6ed5055-3990-4555-94c9-463836e2aef8	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.689
0af93353-5b88-46ad-a410-8b65a4acae1f	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.69
ab18bbd7-c6c1-4f06-b7a5-c7b878de441b	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	TER-MIRROR	#2684FF	2026-09-03 08:24:03.692
72b86311-b3a5-4e37-be2e-10a5365b8036	227bc34c-05cf-428e-a302-e9abb512c955	LUNAS	#22A06B	2026-09-03 08:24:03.717
0e2820d7-ea32-478d-bb3a-d6a9e66e7b2a	227bc34c-05cf-428e-a302-e9abb512c955	DP	#F5CD47	2026-09-03 08:24:03.719
ae4aba68-1731-4773-86c0-098ffc6d07b6	227bc34c-05cf-428e-a302-e9abb512c955	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.721
fc883508-36fd-421b-882f-f302558da191	227bc34c-05cf-428e-a302-e9abb512c955	URGENT	#CA3521	2026-09-03 08:24:03.723
bdb23f1e-22e1-4615-8e9a-f58ec78560c0	227bc34c-05cf-428e-a302-e9abb512c955	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.725
2e11384a-87bd-43bd-9b21-80f68cd23651	227bc34c-05cf-428e-a302-e9abb512c955	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.727
f2c37299-6393-421e-9533-b44cfbcc6330	227bc34c-05cf-428e-a302-e9abb512c955	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.729
c14aec34-18ca-48aa-bb6c-e871377e2e06	227bc34c-05cf-428e-a302-e9abb512c955	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.73
1bfb9631-9c61-4531-9d99-78b8d27df50f	227bc34c-05cf-428e-a302-e9abb512c955	MKS	#6CC3E0	2026-09-03 08:24:03.732
73a4143d-17eb-49f2-b4b2-f461b3954ab1	227bc34c-05cf-428e-a302-e9abb512c955	JKT	#94C748	2026-09-03 08:24:03.734
71f7365e-fdc9-4efb-9664-4b0acf3abd4b	227bc34c-05cf-428e-a302-e9abb512c955	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.735
63162b12-ccbe-49df-86c8-e05de4ea62b1	227bc34c-05cf-428e-a302-e9abb512c955	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.737
3858f3cc-0d9c-442a-90bc-3dbe9bc4c461	227bc34c-05cf-428e-a302-e9abb512c955	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.738
40a5d61d-f8f5-4dfb-b606-61db1ccd7fbf	227bc34c-05cf-428e-a302-e9abb512c955	TER-MIRROR	#2684FF	2026-09-03 08:24:03.74
3f392bde-d04c-4583-aafb-5cc18c392f55	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	LUNAS	#22A06B	2026-09-03 08:24:03.776
06e5dcae-5a64-40c7-93a8-fe436b58f353	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	DP	#F5CD47	2026-09-03 08:24:03.777
bf751a89-a1e9-41ee-a608-1a010a9be525	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	BELUM PENYERAHAN	#E56910	2026-09-03 08:24:03.779
5d3ecd65-37db-44ad-905c-8e288f961b55	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	URGENT	#CA3521	2026-09-03 08:24:03.78
f582ed81-880f-49e2-8147-e98ed5ad5c4d	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	VIA GC ADMIN	#9F8FEF	2026-09-03 08:24:03.782
1f31211e-d241-4806-8812-2162e1e7bd65	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	NOT SOPPENG	#0C66E4	2026-09-03 08:24:03.783
0ac277e5-5617-47c2-a20c-f0e11de79190	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.785
22b92b30-3959-412b-8a37-a79af0249a75	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.786
5690f7c6-7506-4c91-9ad8-69e2b4009155	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	MKS	#6CC3E0	2026-09-03 08:24:03.788
3a49e9e0-fa3b-4b8f-b4b1-73b466d00964	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	JKT	#94C748	2026-09-03 08:24:03.789
c71d3569-e933-4251-a358-45ae137de4e5	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.791
3a6f6a32-ffd2-4f2b-b52a-ff2ba9b8ccc6	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.793
4633d386-7175-496d-84c0-77de7ee2efbe	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.794
ddc4b7b3-34ef-42c8-ac0d-9e6ed107896a	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	TER-MIRROR	#2684FF	2026-09-03 08:24:03.796
e92ab1d6-4a12-4f06-b413-4e5cf04e6978	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	NOT BANDUNG	#1D7AFC	2026-09-03 08:24:03.635
6f560bc2-00c2-4ba8-b493-cbd61dd8e8e7	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	NOT TANGSEL	#579DFF	2026-09-03 08:24:03.638
10a8f159-060f-49b1-abc2-be3117052390	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	MKS	#6CC3E0	2026-09-03 08:24:03.639
bb0b245e-280a-46f4-93d5-1aa2d02af489	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	JKT	#94C748	2026-09-03 08:24:03.642
69836a87-545a-4fa0-a58c-ec072745f769	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	SUDAH ADA LOGO	#4BCE97	2026-09-03 08:24:03.644
f2afe7fd-f72e-43bc-a7ca-490d64ab9798	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	SUDAH ADA AKUN DASHBOARD	#8590A2	2026-09-03 08:24:03.646
37f7fcd2-936c-4629-ad06-707289baba5c	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	SALINAN KEMBALI	#F87168	2026-09-03 08:24:03.648
bb80b60f-6fad-4b5d-9759-82dd64f1a3c9	128957a0-cc7a-4087-9ec1-ca6ab0977f34	PRIORITAS-TEST	#CA3521	2026-09-04 02:19:26.848
92248a9b-ed23-41bc-840b-8304ab6fa023	128957a0-cc7a-4087-9ec1-ca6ab0977f34	PRIORITAS-TEST	#CA3521	2026-09-04 02:21:05.422
223b5e16-9fe7-48bf-8bcb-907602fc93d5	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	PRIORITAS-TEST	#CA3521	2026-09-04 02:21:05.523
66759a1a-01a6-4677-b414-60c967414864	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	PRIORITAS-TEST	#CA3521	2026-09-04 02:21:06.175
0ac832f6-6d75-4421-a6a3-b934257ab2cc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	ZZTEST	#CA3521	2026-09-04 03:11:12.771
\.


--
-- Data for Name: List; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."List" (id, "boardId", name, color, "position", "entryRequirements", "createdAt", archived, "archivedAt") FROM stdin;
c408aaca-bf75-44f7-a060-b569d55cd518	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	DOING	#F1F2F4	2000	null	2026-09-03 08:24:03.584	f	\N
0eca16d2-9dec-4aff-bf9b-759ee2fc1cf4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	COWORKING & VO	#F1F2F4	1000	[]	2026-09-03 08:24:03.225	f	\N
1a350b19-a3d5-4504-9676-08bbe8cd266a	c7bcde01-3e94-41fb-8925-1a0c73301b05	COWORKING & VO	#F1F2F4	1000	null	2026-09-03 08:24:03.49	f	\N
67556d23-d1f1-4145-9111-1e229282a897	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 1	#F1F2F4	2000	null	2026-09-03 08:24:03.229	f	\N
fe052aed-cf5b-49b5-b81e-33125f8ebd6d	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 2	#F1F2F4	3000	null	2026-09-03 08:24:03.231	f	\N
c8b331fc-a0e7-4381-9d14-df2080f6f96c	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 3 BUTUH DRAFT	#F1F2F4	4000	null	2026-09-03 08:24:03.233	f	\N
96e96a19-6295-4281-a881-6e1a15507ade	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 3 REVISI DRAFT	#F1F2F4	5000	null	2026-09-03 08:24:03.247	f	\N
821ea9bb-b6e0-4103-927e-83b98b131853	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 3 (DRAFT FINAL TTD)	#F1F2F4	6000	null	2026-09-03 08:24:03.249	f	\N
c2171121-0969-4d09-b9c0-c2a954c804ec	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 5	#F1F2F4	8000	null	2026-09-03 08:24:03.254	f	\N
babfc5bc-0d85-4736-b7f4-9a592dcce7fb	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 5 (YAYASAN DAN PERKUMPULAN)	#F1F2F4	9000	null	2026-09-03 08:24:03.256	f	\N
950f1aa4-371c-4630-8aea-fd303626f672	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 5 (BELUM PENYERAHAN)	#F1F2F4	13000	null	2026-09-03 08:24:03.265	f	\N
d6ab8f70-dde1-415a-b36d-f31c2fec8cd2	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 5 UPDATE MEREK 2026	#F1F2F4	14000	null	2026-09-03 08:24:03.266	f	\N
49f7d598-bc7f-46fe-8e8c-55d9604e8c17	128957a0-cc7a-4087-9ec1-ca6ab0977f34	KOMPLAIN	#F1F2F4	16000	null	2026-09-03 08:24:03.271	f	\N
9535f972-590a-403a-bdb5-9e8ba41af949	86dd6b98-bc2b-41e6-bff1-57298581b511	COWORKING & VO	#F1F2F4	1000	null	2026-09-03 08:24:03.322	f	\N
2a31b99b-febd-42b8-b2b9-32e522be739d	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 1	#F1F2F4	2000	null	2026-09-03 08:24:03.324	f	\N
62f678f4-d226-43e8-bd28-c56143913d7a	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 2	#F1F2F4	3000	null	2026-09-03 08:24:03.326	f	\N
01102fa9-59b6-4f51-951c-32d161f34708	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 3 BUTUH DRAFT	#F1F2F4	4000	null	2026-09-03 08:24:03.328	f	\N
89f2788b-cfdb-4b96-ac1b-8fb7352f5aa2	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 3 REVISI DRAFT	#F1F2F4	5000	null	2026-09-03 08:24:03.33	f	\N
d226ed12-abb8-4476-997b-8c3a70ba65e2	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 3 (DRAFT FINAL TTD)	#F1F2F4	6000	null	2026-09-03 08:24:03.332	f	\N
e40d655b-58a0-47aa-a2a7-d103dbddcbeb	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 5	#F1F2F4	8000	null	2026-09-03 08:24:03.335	f	\N
4e8cd413-26c2-43b4-bd09-0e40df17f255	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 5 (YAYASAN DAN PERKUMPULAN)	#F1F2F4	9000	null	2026-09-03 08:24:03.337	f	\N
29d3e3ec-050e-4157-b397-94078fb52800	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 5 (BELUM PENYERAHAN)	#F1F2F4	13000	null	2026-09-03 08:24:03.346	f	\N
b664bd78-e750-41fb-91f5-7ff7df3a7d52	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 5 UPDATE MEREK 2026	#F1F2F4	14000	null	2026-09-03 08:24:03.348	f	\N
48b4d446-0635-4266-87ba-d0d1761f65fa	86dd6b98-bc2b-41e6-bff1-57298581b511	KOMPLAIN	#F1F2F4	16000	null	2026-09-03 08:24:03.352	f	\N
135c9024-da87-486f-9eb6-fb795bdaad6e	c25ed925-60cd-4e6c-9033-a847a6f22ee5	COWORKING & VO	#F1F2F4	1000	null	2026-09-03 08:24:03.395	f	\N
205d5e5b-d651-4e83-a55b-bde12b40e516	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 1	#F1F2F4	2000	null	2026-09-03 08:24:03.397	f	\N
eff23a06-5dfb-41d0-9594-5cda70652b70	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 2	#F1F2F4	3000	null	2026-09-03 08:24:03.4	f	\N
a58d546e-d244-4671-a38e-f289cf438378	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 3 BUTUH DRAFT	#F1F2F4	4000	null	2026-09-03 08:24:03.402	f	\N
3744f87d-81e2-45de-aa2f-2a51f5d33378	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 3 REVISI DRAFT	#F1F2F4	5000	null	2026-09-03 08:24:03.404	f	\N
8aa06501-db3b-4d29-86ee-7aae4157eb37	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 3 (DRAFT FINAL TTD)	#F1F2F4	6000	null	2026-09-03 08:24:03.407	f	\N
9189ab1d-1bcb-48f7-8e53-fa9198498a1f	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 5	#F1F2F4	8000	null	2026-09-03 08:24:03.412	f	\N
22673ecd-c13b-4bf1-8572-fccfc0018a25	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 5 (YAYASAN DAN PERKUMPULAN)	#F1F2F4	9000	null	2026-09-03 08:24:03.414	f	\N
02f71b3c-0951-4f36-8eb0-6f416d6b933d	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 5 (BELUM PENYERAHAN)	#F1F2F4	13000	null	2026-09-03 08:24:03.43	f	\N
c06783b9-26d7-4d96-a3fe-425e0053c50d	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 5 UPDATE MEREK 2026	#F1F2F4	14000	null	2026-09-03 08:24:03.435	f	\N
36d7ccbf-8785-4ee2-a0d7-7719bbd79981	c25ed925-60cd-4e6c-9033-a847a6f22ee5	KOMPLAIN	#F1F2F4	16000	null	2026-09-03 08:24:03.44	f	\N
5d62cc2b-0bd5-4e08-9c29-7dfdbc353919	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 5 SIAP KIRIM NOTARIS	#F1F2F4	10000	["Minuta Akta"]	2026-09-03 08:24:03.258	f	\N
ee2d5fc6-ae1a-4989-8158-0270803cab68	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 5 (NPWP)	#F1F2F4	11000	["SK Kemenkumham"]	2026-09-03 08:24:03.26	f	\N
b8552b5d-04dc-47c7-8a6d-9a776be4123c	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 5 (NIB)	#F1F2F4	12000	["NPWP"]	2026-09-03 08:24:03.263	f	\N
d5bf4a6e-f55f-4298-96c5-ebb8d555d1f9	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 6 FINISH	#F1F2F4	15000	["NIB"]	2026-09-03 08:24:03.268	f	\N
a3934cbe-b6c7-431c-949d-27d6ac3ddced	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 7 (DATA FU KEMBALI)	#F1F2F4	17000	["Penyerahan"]	2026-09-03 08:24:03.273	f	\N
7bd56b2a-81ae-4a39-9b86-3b7b845b8d6b	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 4	#F1F2F4	7000	["KTP", "NPWP", "Pembayaran DP/Lunas"]	2026-09-03 08:24:03.333	f	\N
be5dc8cd-6941-4135-865f-a154187e0323	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 5 SIAP KIRIM NOTARIS	#F1F2F4	10000	["Minuta Akta"]	2026-09-03 08:24:03.339	f	\N
114dde1a-c820-41f9-a57c-d9a993932081	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 5 (NPWP)	#F1F2F4	11000	["SK Kemenkumham"]	2026-09-03 08:24:03.341	f	\N
83ef48f3-714d-4b4d-956b-123e9feebcc2	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 5 (NIB)	#F1F2F4	12000	["NPWP"]	2026-09-03 08:24:03.344	f	\N
efd28d02-e421-4fb1-9b57-9394249d3e41	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 6 FINISH	#F1F2F4	15000	["NIB"]	2026-09-03 08:24:03.35	f	\N
1533cbe7-b2f3-4987-a6f6-5d9f1002d956	86dd6b98-bc2b-41e6-bff1-57298581b511	SKOR 7 (DATA FU KEMBALI)	#F1F2F4	17000	["Penyerahan"]	2026-09-03 08:24:03.354	f	\N
5224e32f-9df0-4217-87bc-34171794415b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 4	#F1F2F4	7000	["KTP", "NPWP", "Pembayaran DP/Lunas"]	2026-09-03 08:24:03.41	f	\N
4e85cd61-9e08-4d81-8643-f66ff7075b4a	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 5 SIAP KIRIM NOTARIS	#F1F2F4	10000	["Minuta Akta"]	2026-09-03 08:24:03.417	f	\N
40aecab1-66e5-4357-b3dd-21718e040e95	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 5 (NPWP)	#F1F2F4	11000	["SK Kemenkumham"]	2026-09-03 08:24:03.42	f	\N
50107395-bf4e-4972-b2bb-ddf4ae9bd3a0	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 5 (NIB)	#F1F2F4	12000	["NPWP"]	2026-09-03 08:24:03.423	f	\N
216a400d-83c4-46c3-a2d9-bf97f7724143	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 6 FINISH	#F1F2F4	15000	["NIB"]	2026-09-03 08:24:03.437	f	\N
6954c9ad-bcb1-45a9-83c1-07f226399148	c25ed925-60cd-4e6c-9033-a847a6f22ee5	SKOR 7 (DATA FU KEMBALI)	#F1F2F4	17000	["Penyerahan"]	2026-09-03 08:24:03.442	f	\N
c189960d-42a0-448f-850e-fd28898f3e8d	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 1	#F1F2F4	2000	null	2026-09-03 08:24:03.492	f	\N
dfecc611-0257-48cb-8ec3-31b1e7b1c71a	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 2	#F1F2F4	3000	null	2026-09-03 08:24:03.496	f	\N
1d0a7389-cd13-42dd-95a7-87ba484d3666	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 3 BUTUH DRAFT	#F1F2F4	4000	null	2026-09-03 08:24:03.5	f	\N
2e571cc3-7bf2-4dfe-a090-89ee5c92b38d	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 3 REVISI DRAFT	#F1F2F4	5000	null	2026-09-03 08:24:03.502	f	\N
6899ecf9-5df7-4895-bce0-1ef50f9efeac	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 3 (DRAFT FINAL TTD)	#F1F2F4	6000	null	2026-09-03 08:24:03.505	f	\N
5a748c61-e848-4c69-a7b1-96de767616fc	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 5	#F1F2F4	8000	null	2026-09-03 08:24:03.51	f	\N
e403f4c7-6f77-45ef-a9a9-f6a61d9d44c9	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 5 (YAYASAN DAN PERKUMPULAN)	#F1F2F4	9000	null	2026-09-03 08:24:03.514	f	\N
00186ff3-c16a-4557-8f79-2fc6e08f2633	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 5 (BELUM PENYERAHAN)	#F1F2F4	13000	null	2026-09-03 08:24:03.522	f	\N
e6028502-464b-4e1f-ad05-c17339ed1714	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 5 UPDATE MEREK 2026	#F1F2F4	14000	null	2026-09-03 08:24:03.525	f	\N
2b572ce8-5fa6-450b-94be-9df79fc72295	c7bcde01-3e94-41fb-8925-1a0c73301b05	KOMPLAIN	#F1F2F4	16000	null	2026-09-03 08:24:03.528	f	\N
8712c507-4679-4786-b518-446d66241b68	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	LIST	#F1F2F4	1000	null	2026-09-03 08:24:03.581	f	\N
d17cbe94-ba9e-4198-b786-f244fdcb92d2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	FINISH TODAY	#F1F2F4	3000	null	2026-09-03 08:24:03.587	f	\N
15c297f1-57e2-477b-9acb-f4658a6e00fb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	FU NOTARIS (ELIS)	#F1F2F4	4000	null	2026-09-03 08:24:03.592	f	\N
fbf0a2df-ed23-4399-9eb4-e954a90dcc9d	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	SIAP KIRIM NOTARIS (ELIS)	#F1F2F4	5000	null	2026-09-03 08:24:03.595	f	\N
2723aa75-c987-483a-9f59-4a2808cf54ee	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	PRATINJAU (ELIS)	#F1F2F4	6000	null	2026-09-03 08:24:03.598	f	\N
edb40777-99cb-42f0-9ede-224554176b20	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	VIA WA ADMIN/GC ADMIN (ANTI)	#F1F2F4	7000	null	2026-09-03 08:24:03.605	f	\N
ebad142a-f6da-4417-9f80-7ed5641a5e40	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	PESAN NAMA (ANTI)	#F1F2F4	8000	null	2026-09-03 08:24:03.608	f	\N
25d9de85-d45f-46d6-9276-66e9b05d68cb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	INPUTAN (ANTI)	#F1F2F4	9000	null	2026-09-03 08:24:03.613	f	\N
b176c09d-cb3d-4694-a7ba-d3fe7c89bdbf	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	LIST SPT TAHUNAN	#F1F2F4	1000	null	2026-09-03 08:24:03.659	f	\N
3b2db55d-ab55-49be-927c-984516d23b89	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	LIST PENGURUSAN PAJAK	#F1F2F4	2000	null	2026-09-03 08:24:03.661	f	\N
82251c0b-b53d-4450-9b2d-a1f207098e86	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	LIST NPWP	#F1F2F4	3000	null	2026-09-03 08:24:03.662	f	\N
1fbb4231-e00c-469e-8b9b-32a30489a5b3	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	DOING	#F1F2F4	4000	null	2026-09-03 08:24:03.664	f	\N
413d9dbe-818f-45b4-bb61-f03fb6a5af42	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	FINISH	#F1F2F4	5000	null	2026-09-03 08:24:03.665	f	\N
f40289d7-b9c5-4fe0-a69b-ca5e6687b553	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	KONTRAK PAJAK	#F1F2F4	6000	null	2026-09-03 08:24:03.667	f	\N
eeb69778-276d-4583-97f1-b1859187db8c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	VIA CHAT (AMEL)	#F1F2F4	7000	null	2026-09-03 08:24:03.668	f	\N
ca6616dd-2c75-40a1-b04e-30f86ef1bed6	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	EMAIL NOTARIS	#F1F2F4	8000	null	2026-09-03 08:24:03.67	f	\N
e7198340-09ff-41c6-a063-eda76e03dd31	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	ADMIN	#F1F2F4	9000	null	2026-09-03 08:24:03.672	f	\N
1c96004d-d1f8-4412-927c-1c0a47475f45	227bc34c-05cf-428e-a302-e9abb512c955	PERIZINAN LAINNYA	#F1F2F4	1000	null	2026-09-03 08:24:03.7	f	\N
02649d3f-0867-43df-801a-64ee9640b24b	227bc34c-05cf-428e-a302-e9abb512c955	LIST NIB	#F1F2F4	2000	null	2026-09-03 08:24:03.702	f	\N
3dc51fba-57f4-4d15-9c7b-4d4a975c660f	227bc34c-05cf-428e-a302-e9abb512c955	DOING (to be confirm)	#F1F2F4	3000	null	2026-09-03 08:24:03.704	f	\N
e1adb484-774c-4499-b68c-e3135d8fced8	227bc34c-05cf-428e-a302-e9abb512c955	PRODUK LAINNYA	#F1F2F4	4000	null	2026-09-03 08:24:03.706	f	\N
9574c100-1a8f-46e4-aa44-d0d4a148bfc6	227bc34c-05cf-428e-a302-e9abb512c955	MEREK	#F1F2F4	5000	null	2026-09-03 08:24:03.707	f	\N
9492c957-c425-4e8d-931c-2ee041ac0a11	227bc34c-05cf-428e-a302-e9abb512c955	MENUNGGU HASIL VERIFIKASI	#F1F2F4	6000	null	2026-09-03 08:24:03.709	f	\N
1fb85e18-7971-4325-b3f7-d8be46fa9893	227bc34c-05cf-428e-a302-e9abb512c955	DONE TODAY	#F1F2F4	7000	null	2026-09-03 08:24:03.711	f	\N
adba1258-9b62-4d6d-bc2a-07f416a2e9b8	227bc34c-05cf-428e-a302-e9abb512c955	ADMIN	#F1F2F4	8000	null	2026-09-03 08:24:03.713	f	\N
03b7df23-9931-4985-93ff-9601e372ca44	227bc34c-05cf-428e-a302-e9abb512c955	NOTARIS SOPPENG	#F1F2F4	9000	null	2026-09-03 08:24:03.715	f	\N
935d5a1d-ec43-4a54-b3aa-0987f9651b64	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	Daily Rutin	#F1F2F4	1000	null	2026-09-03 08:24:03.749	f	\N
06158275-63f8-40f7-b3fe-0cb007bffe27	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	LIST LOGO / COMPRO	#F1F2F4	2000	null	2026-09-03 08:24:03.751	f	\N
35c499ea-a040-4afb-9c78-36288c1b5c9f	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	DOING	#F1F2F4	3000	null	2026-09-03 08:24:03.753	f	\N
2081f7e6-5b8f-4947-b8a4-62157d31b7c6	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	FINISH	#F1F2F4	4000	null	2026-09-03 08:24:03.755	f	\N
9f4b5230-f5f8-496a-87f8-143c8f25db21	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	ADMIN	#F1F2F4	10000	null	2026-09-03 08:24:03.617	f	\N
5ea41670-dfd3-4142-9506-0670423f9887	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	REVISI	#F1F2F4	5000	null	2026-09-03 08:24:03.757	f	\N
2d6050b7-eb9c-41b3-b908-c2b3ca4c33f2	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	LINK	#F1F2F4	6000	null	2026-09-03 08:24:03.759	f	\N
413d9463-19e3-4c85-b0b6-717bb7cc539c	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	REFERENSI/CATATAN	#F1F2F4	7000	null	2026-09-03 08:24:03.761	f	\N
a428c4c5-a67a-40e0-83ea-577656d4e16f	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	HARGA PROMO	#F1F2F4	8000	null	2026-09-03 08:24:03.764	f	\N
9cc83891-fe7a-4966-9bd7-e6a99ef42f81	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 5 SIAP KIRIM NOTARIS	#F1F2F4	10000	["Minuta Akta"]	2026-09-03 08:24:03.516	f	\N
a0395554-16ae-4c28-87b1-988c4ac4ba75	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 5 (NPWP)	#F1F2F4	11000	["SK Kemenkumham"]	2026-09-03 08:24:03.518	f	\N
8a83e961-45a0-4c6c-95b8-75d6746235db	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 5 (NIB)	#F1F2F4	12000	["NPWP"]	2026-09-03 08:24:03.52	f	\N
350a8266-be00-4522-bee3-4ac88980533b	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 6 FINISH	#F1F2F4	15000	["NIB"]	2026-09-03 08:24:03.527	f	\N
cffe0f77-ba02-43af-ad9f-23568c62b4e3	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 7 (DATA FU KEMBALI)	#F1F2F4	17000	["Penyerahan"]	2026-09-03 08:24:03.53	f	\N
c524d95a-cdb5-4d1c-89ad-4a4a4150f1d7	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	HASBY JOBDESK	#F1F2F4	9000	null	2026-09-03 08:24:03.766	f	\N
df661d5a-2455-4e24-ad48-b518047a6c6a	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	AKSES LEGAL INDONESIA (VIDEO/GAMBAR)	#F1F2F4	10000	null	2026-09-03 08:24:03.767	f	\N
c7b0e4c0-efbc-4f04-9858-67d21cd39f14	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	KONTEN LAYANAN AKSES LEGAL INDONESIA (VIDEO/GAMBAR)	#F1F2F4	11000	null	2026-09-03 08:24:03.769	f	\N
cee8e2b4-4fcc-4e7f-8056-63633da34f60	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	KANTOR NOT. SOPPENG	#F1F2F4	12000	null	2026-09-03 08:24:03.77	f	\N
dbee526e-529b-4e78-a42b-faa8a1e37fa0	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	INFLUENCER	#F1F2F4	13000	null	2026-09-03 08:24:03.772	f	\N
ca9e94d3-9822-4caf-b85a-7d1586e4ca74	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	RE-DESAIN	#F1F2F4	14000	null	2026-09-03 08:24:03.774	f	\N
ae236c38-c2a1-40c6-8c7e-1b5ea4403bc0	128957a0-cc7a-4087-9ec1-ca6ab0977f34	SKOR 4	#F1F2F4	7000	["KTP", "NPWP", "Pembayaran DP/Lunas"]	2026-09-03 08:24:03.251	f	\N
a9688a55-d4a4-41fe-b36d-d14ac9719ed7	c7bcde01-3e94-41fb-8925-1a0c73301b05	SKOR 4	#F1F2F4	7000	["KTP", "NPWP", "Pembayaran DP/Lunas"]	2026-09-03 08:24:03.508	f	\N
\.


--
-- Data for Name: LoginAttempt; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LoginAttempt" (identifier, count, "lastAt") FROM stdin;
::1:	3	2026-09-03 09:22:07.309
\.


--
-- Data for Name: MasterCard; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MasterCard" (id, title, client, "ownerUserId", "ownerDivisionId", "createdAt", "updatedAt", "sharedLabels", price, "priceNote", "priceSetAt", "priceSetById") FROM stdin;
561f8d85-f443-44e6-8ed1-f37a33383e48	PT Bintang Timur - Follow Up Klien	PT Bintang Timur	ede08911-c701-4524-8687-73971fd33d78	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.629	2026-09-03 08:24:20.629	[]	\N	\N	\N	\N
a016bc45-ec72-407f-88f4-d9278266b2e4	Konten Layanan Pendirian PT	Internal	\N	2bf8ea7b-5215-4e59-807c-a06b4734c7fe	2026-09-03 08:24:20.727	2026-09-03 08:24:20.727	[]	\N	\N	\N	\N
f7b12993-0859-4245-b791-34daeb73146d	PT Nusantara Jaya - Proses Notaris	PT Nusantara Jaya	d0723d2c-9568-4349-a3b0-75cd66310c99	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.598	2026-09-04 06:10:13.871	[{"name": "LUNAS", "color": "#22A06B"}, {"name": "JKT", "color": "#94C748"}]	\N	\N	\N	\N
bfd51160-b21a-4f83-8e2d-2b05aac4bcc3	PT Graha Sentosa - Pendirian + NIB	PT Graha Sentosa	a843cda0-4e41-40b9-95a0-a9eef8fdaef6	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.615	2026-09-04 06:10:13.898	[{"name": "LUNAS", "color": "#22A06B"}, {"name": "TER-MIRROR", "color": "#2684FF"}]	\N	\N	\N	\N
a325a33c-0c08-473b-8034-64cbb6dbafac	Yayasan Cahaya Ilmu - Pendirian Yayasan	Yayasan Cahaya Ilmu	a843cda0-4e41-40b9-95a0-a9eef8fdaef6	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.622	2026-09-04 06:10:13.91	[{"name": "DP", "color": "#F5CD47"}, {"name": "NOT BANDUNG", "color": "#1D7AFC"}]	\N	\N	\N	\N
9995ad1f-c620-4611-a80d-daa74356f95d	CV Karya Mandala - Pengumpulan Berkas	CV Karya Mandala	ede08911-c701-4524-8687-73971fd33d78	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.636	2026-09-04 06:10:13.925	[{"name": "DP", "color": "#F5CD47"}]	\N	\N	\N	\N
65215662-fa06-4403-bedd-579bd8115f25	PT Illank Rezeki Abadi - Draft Akta	PT Illank Rezeki Abadi	\N	5749c390-4c94-419d-a2b5-1ee98952427f	2026-09-03 08:24:20.657	2026-09-04 06:10:13.938	[{"name": "NOT TANGSEL", "color": "#579DFF"}]	\N	\N	\N	\N
cacfff91-41be-48a7-a666-1fa128934c48	CV Arkana Cipta Persada - Pesan Nama	CV Arkana Cipta Persada	\N	5749c390-4c94-419d-a2b5-1ee98952427f	2026-09-03 08:24:20.67	2026-09-04 06:10:13.953	[{"name": "URGENT", "color": "#CA3521"}, {"name": "VIA GC ADMIN", "color": "#9F8FEF"}]	\N	\N	\N	\N
765e74b3-bf24-4b06-8d6e-1432873dbeda	CV Arkana Cipta Persada - Revisi Akta	CV Arkana Cipta Persada	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.58	2026-09-04 06:10:14.032	[{"name": "URGENT", "color": "#CA3521"}]	\N	\N	\N	\N
37b53bae-fa4e-4dbe-9fb8-59732c2b2f5b	tes	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-04 09:37:55.544	2026-09-04 09:37:55.544	[]	\N	\N	\N	\N
1cca4a50-bc3d-4149-a6dd-7cc967f924e7	PT Graha Sentosa - NPWP Badan	PT Graha Sentosa	\N	5fc5b0c9-9335-4663-8e98-49512bf24b89	2026-09-03 08:24:20.687	2026-09-04 06:10:13.965	[{"name": "MKS", "color": "#6CC3E0"}]	\N	\N	\N	\N
966f38e5-b638-4488-b094-1a65af4aa5cb	CV Mentari Pagi - SPT Tahunan	CV Mentari Pagi	\N	5fc5b0c9-9335-4663-8e98-49512bf24b89	2026-09-03 08:24:20.695	2026-09-04 06:10:13.975	[{"name": "BELUM PENYERAHAN", "color": "#E56910"}]	\N	\N	\N	\N
96304d5b-da3a-462e-b718-a5ed24ede901	PT Bintang Timur - Pengurusan Merek	PT Bintang Timur	\N	e05204d7-05d1-42c9-a989-590cc1cf67e5	2026-09-03 08:24:20.703	2026-09-04 06:10:13.985	[{"name": "URGENT", "color": "#CA3521"}]	\N	\N	\N	\N
628c2037-f91f-478b-af42-977710ba65bc	tes	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-04 10:25:50.824	2026-09-04 10:25:50.824	[]	\N	\N	\N	\N
af4fd3f2-b5b5-439b-bc68-3fbb8f8c9962	PT Illank Rezeki Abadi - Pendirian PT	PT Illank Rezeki Abadi	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.556	2026-09-04 06:10:13.853	[{"name": "DP", "color": "#F5CD47"}, {"name": "NOT TANGSEL", "color": "#579DFF"}]	\N	\N	\N	\N
95629d7f-b5c0-4d20-b3e6-3bacb2328f9a	UD Sinar Bahagia - NIB OSS	UD Sinar Bahagia	\N	e05204d7-05d1-42c9-a989-590cc1cf67e5	2026-09-03 08:24:20.712	2026-09-04 06:10:13.996	[{"name": "NOT SOPPENG", "color": "#0C66E4"}]	\N	\N	\N	\N
7d02c048-b098-4c34-9c78-0bcc5e58bf38	PT Graha Sentosa - Logo & Compro	PT Graha Sentosa	\N	2bf8ea7b-5215-4e59-807c-a06b4734c7fe	2026-09-03 08:24:20.719	2026-09-04 06:10:14.012	[{"name": "SUDAH ADA LOGO", "color": "#4BCE97"}]	\N	\N	\N	\N
12b916f1-5b1a-4b96-875b-ad7c7fc820d6	PT Nusantara Jaya - Siap Kirim Notaris	PT Nusantara Jaya	\N	5749c390-4c94-419d-a2b5-1ee98952427f	2026-09-03 08:24:20.679	2026-09-04 06:10:14.023	[{"name": "LUNAS", "color": "#22A06B"}, {"name": "JKT", "color": "#94C748"}]	\N	\N	\N	\N
e8b99ad4-9fa6-4547-a748-87c3b56d8c9f	PT MAJU JAYA	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-04 08:04:50.776	2026-09-04 08:04:50.776	[]	\N	\N	\N	\N
123c1ca5-57db-4ca2-8f92-0ea87ea0b1eb	PT SATU DUA TIGA	NOPAL	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-04 09:11:11.632	2026-09-04 09:12:11.522	[]	\N	\N	\N	\N
3e8acd44-f8e9-4d42-bc4f-c02f2307988f	PT SATWA	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-05 00:37:24.149	2026-09-05 00:37:56.365	[]	\N	\N	\N	\N
45c4128b-8624-4111-b91b-908f71894739	CV MAJU MUNDUR	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-04 06:41:47.809	2026-09-04 11:39:11.938	[]	\N	\N	\N	\N
8b19e5b8-c51a-46f1-82df-62a08eb7a935	TES KIRIM DATA	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-05 00:44:27.821	2026-09-05 00:44:27.821	[]	\N	\N	\N	\N
ecafa61c-d7f4-467d-a6b7-f0ddc0fd1d1e	UD Sinar Bahagia - Pengumpulan Berkas	UD Sinar Bahagia	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.589	2026-09-04 11:45:23.31	[]	3900000	\N	2026-09-04 11:45:23.308	2253a72b-43e5-48d4-9d42-ba3db021b20e
a1e9eef1-6ba1-4e15-8aa2-2294b538eeac	PT ABC	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-05 00:38:24.184	2026-09-05 00:39:06.196	[]	\N	\N	\N	\N
8df1bddc-0324-4211-b9cd-b2cf13d63cdf	PT DANANTARA INC NIB	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-05 00:42:26.738	2026-09-05 00:42:26.738	[]	\N	\N	\N	\N
0ff88fdf-00cd-4c93-9a04-cf1f20d67e0a	TES KIRIM DATA	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-05 00:44:06.668	2026-09-05 00:44:06.668	[]	\N	\N	\N	\N
597505aa-1d80-4fb1-a55a-3dfbd9a4f5a0	CV Mentari Pagi - Komplain Dokumen	CV Mentari Pagi	d0723d2c-9568-4349-a3b0-75cd66310c99	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-03 08:24:20.607	2026-09-05 03:17:06.743	[{"name": "BELUM PENYERAHAN", "color": "#E56910"}, {"name": "URGENT", "color": "#CA3521"}]	\N	\N	\N	\N
5d9f26ef-1a70-4727-8e97-3de595aca1a5	PT TES TES	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-05 01:09:09.795	2026-09-05 01:11:48.58	[]	\N	\N	\N	\N
8e6763a7-4931-4ef5-b82f-629e4819d53c	PT MAJU MUNDUR	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2026-09-04 06:06:06.045	2026-09-05 01:44:22.15	[{"name": "TER-MIRROR", "color": "#2684FF"}]	\N	\N	\N	\N
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", type, title, body, "workItemId", "boardId", "isRead", "createdAt") FROM stdin;
97648cc3-8021-4f73-bb1b-7362a41f6dcc	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "CV MAJU MUNDUR" berhasil dikirim ke Bank Data Admin Pajak.	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	\N	f	2026-09-04 07:20:40.782
0e05cab6-517d-4fdc-bdb5-21796da0b9a3	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	claimed	Pekerjaan diambil	Amel telah mengambil pekerjaan "CV MAJU MUNDUR".	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	f	2026-09-04 07:20:56.656
41b83c70-a2bc-456b-9615-9030d342b351	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	mention	Anda disebut	Amel menyebut Anda di "CV MAJU MUNDUR": siap kak @Dedes Ali	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	f	2026-09-04 07:37:28.128
45ca6146-7413-49ad-bf0a-938b6b0ad75b	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Amel di "CV MAJU MUNDUR": siap kak @Dedes Ali	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	f	2026-09-04 07:37:28.147
92cd4050-c689-46e0-9607-1c57e52f7cf4	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "PT MAJU JAYA" berhasil dikirim ke Bank Data Admin Draf Input.	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	\N	f	2026-09-04 08:05:58.433
c655423a-3f94-419c-8a06-7a992b4d20e8	278f85a0-ca0e-48c4-97a2-e2728476ea52	assigned	Anda ditugaskan	Dedes Ali menugaskan Anda pada "PT MAJU JAYA".	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	\N	f	2026-09-04 08:05:58.475
7ff0a49a-4aa6-41cd-90a2-3a47085762ab	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	mention	Anda disebut	Elis menyebut Anda di "PT MAJU JAYA": Berikut draft nya @Dedes Ali	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 08:06:47.137
bd96ab54-3b15-48cd-b5a2-4975def2921c	278f85a0-ca0e-48c4-97a2-e2728476ea52	assigned	Anda ditugaskan	Super Admin menugaskan Anda pada "UD Sinar Bahagia - NIB OSS".	9c3c889d-171a-4f9b-817e-d7ff4fa159e3	\N	f	2026-09-03 08:50:52.295
476ef2b6-0a16-4891-8cec-add2bb4f754b	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "PT MAJU JAYA" berhasil dikirim ke Bank Data Admin Pajak.	ad56ba40-ff17-4316-bb16-89758d84fb71	\N	f	2026-09-04 08:08:05.945
2ca2ccb9-79d6-4eef-9e07-95699d9d82f4	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11	assigned	Anda ditugaskan	Super Admin menugaskan Anda pada "PT Nusantara Jaya - Proses Notaris".	f589af2c-4103-4b7c-9880-424a11304c9e	\N	f	2026-09-03 08:53:32.486
beb4beeb-97d6-4a26-9ba3-66719ca98406	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	claimed	Pekerjaan diambil	Amel telah mengambil pekerjaan "PT MAJU JAYA".	ad56ba40-ff17-4316-bb16-89758d84fb71	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	f	2026-09-04 08:08:36.244
f2871a48-d533-497c-85f4-c8799234a1e6	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "UD Sinar Bahagia - Pengumpulan Berkas": tes comment	f76d4aae-53bb-4fcc-9e78-93e6e6eb7126	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 08:38:37.902
5559f3b5-a3bc-4c84-9ef0-166379cf72be	278f85a0-ca0e-48c4-97a2-e2728476ea52	sent	Pekerjaan terkirim	Pekerjaan "PT SATU DUA TIGA" berhasil masuk Bank Data Customer Service.	1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	\N	f	2026-09-04 09:11:11.687
e8ef1122-bb49-49e6-92c1-e7bb922947e6	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "CV Arkana Cipta Persada - Revisi Akta" berhasil dikirim ke Bank Data Admin Draf Input.	31e21678-2353-4070-a1e4-e13bfb60eae9	\N	f	2026-09-04 01:56:11.158
e6c890dc-2dda-4e22-9d61-1cc7c4b559de	278f85a0-ca0e-48c4-97a2-e2728476ea52	assigned	Anda ditugaskan	Dedes Ali menugaskan Anda pada "CV Arkana Cipta Persada - Revisi Akta".	31e21678-2353-4070-a1e4-e13bfb60eae9	\N	f	2026-09-04 01:56:11.181
d5464933-f56d-4480-a0ad-7bebb457306b	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Dedes Ali di "CV Arkana Cipta Persada - Revisi Akta": tes comment	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:57:29.105
d4336125-0b50-4ada-9978-0a87d6de39c4	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "CV Arkana Cipta Persada - Revisi Akta": tes comment	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:57:29.105
d0f5bfa4-c43e-4a71-9465-502f1b6932bc	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "CV Arkana Cipta Persada - Revisi Akta" berhasil dikirim ke Bank Data Admin Draf Input.	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	\N	f	2026-09-04 01:59:32.308
211310d2-7524-4bda-90f4-17ecdbfb295e	278f85a0-ca0e-48c4-97a2-e2728476ea52	assigned	Anda ditugaskan	Dedes Ali menugaskan Anda pada "CV Arkana Cipta Persada - Revisi Akta".	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	\N	f	2026-09-04 01:59:32.319
8065fa4b-26cd-431e-82ea-8b80aabac942	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Super Admin di "CV Arkana Cipta Persada - Revisi Akta": sse test 1788487892084	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 02:11:32.198
e2513eff-4e13-4699-a17d-37ebd456fa19	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	comment	Komentar baru	Super Admin di "CV Arkana Cipta Persada - Revisi Akta": sse test 1788487892084	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 02:11:32.198
2cc72a4a-783b-4ac2-a1c3-d157c9f2298d	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Super Admin di "CV Arkana Cipta Persada - Revisi Akta": sse2 1788488145213	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 02:15:45.343
fa1cbeb4-916c-4500-b313-f1f811efe51f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	comment	Komentar baru	Super Admin di "CV Arkana Cipta Persada - Revisi Akta": sse2 1788488145213	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 02:15:45.343
4409d061-89ed-4528-8817-b0e50bbfb54f	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Super Admin di "CV Arkana Cipta Persada - Revisi Akta": reg 1788488493563	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 02:21:33.651
3126fd39-4452-4207-8583-5cc633e7bb1f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	comment	Komentar baru	Super Admin di "CV Arkana Cipta Persada - Revisi Akta": reg 1788488493563	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 02:21:33.651
cb5856b0-5d29-4153-a5d8-c7b3a1d84601	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 02:24:18.906
61bbf52d-8a03-4181-bd97-a25b590c6d19	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 02:24:18.906
6eab42b8-b47f-4eb6-a48c-2feaea3f80cd	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "CV MAJU MUNDUR" berhasil dikirim ke Bank Data Admin Draf Input.	c5808557-38b5-4010-9cae-afbdcca1ffd2	\N	f	2026-09-04 06:41:47.889
d66fb346-3128-4247-bb6a-38a122a074e3	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	claimed	Pekerjaan diambil	Elis telah mengambil pekerjaan "CV MAJU MUNDUR".	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 06:41:59.004
593931ae-9bf5-4c80-9782-44d4e822dee0	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	comment	Komentar baru	Elis di "CV MAJU MUNDUR": siap di proses	c5808557-38b5-4010-9cae-afbdcca1ffd2	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 06:47:39.378
1401f2a9-888f-4955-86f4-7a417c0bb4a3	278f85a0-ca0e-48c4-97a2-e2728476ea52	assigned	Anda ditugaskan	Super Admin menugaskan Anda pada "PT Nusantara Jaya - Proses Notaris"	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-03 09:28:13.827
56cd4d10-9b7c-49de-91f6-6c706bb21384	278f85a0-ca0e-48c4-97a2-e2728476ea52	mention	Anda disebut	Super Admin menyebut Anda di "PT Nusantara Jaya - Proses Notaris": di lanjut revisi nya @Elis	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-03 09:29:16.265
e3de53fc-76f1-4259-96d1-4df969a630b2	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11	comment	Komentar baru	Super Admin di "PT Nusantara Jaya - Proses Notaris": di lanjut revisi nya @Elis	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-03 09:29:16.288
b49c1130-a645-4a3c-9b9a-06c59bb78088	d0723d2c-9568-4349-a3b0-75cd66310c99	comment	Komentar baru	Super Admin di "PT Nusantara Jaya - Proses Notaris": di lanjut revisi nya @Elis	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-03 09:29:16.288
eae7becc-9478-421e-a7ab-83938575dd11	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 00:50:10.341
ac9feb17-4d1f-4ae2-948c-f78194a00bf1	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 00:50:10.341
dac4e8bf-ffd7-4bad-942d-d8cb37c371a6	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 00:50:25.2
32313b2d-1b00-4c8d-bf68-ae5949ec56f8	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 00:50:25.2
0bbfde16-2542-41bc-b490-45e26c7b2457	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:16:45.4
58fa2a55-8cc8-4354-965f-5c9aa2a79ec5	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:16:45.4
04101ca4-0452-4f51-bac9-c566b8cd3caa	278f85a0-ca0e-48c4-97a2-e2728476ea52	mention	Anda disebut	Dedes Ali menyebut Anda di "PT Illank Rezeki Abadi - Pendirian PT": halo @Elis	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:18:00.259
811cf1c2-bbe3-4149-b9d3-c5a7223becc0	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": halo @Elis	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:18:00.293
ed2ad285-03a8-4b66-a387-fc36ced67a4b	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	comment	Komentar baru	Super Admin di "CV Arkana Cipta Persada - Revisi Akta": realtime test 1788485687166	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:34:47.218
7cef5ee5-c945-49a4-9b4d-8347a63b8aaa	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes comment	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:46:38.73
2f65bf16-1342-4d1a-a42d-99ef66daf9b6	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "PT Illank Rezeki Abadi - Pendirian PT": tes comment	51d95517-9a19-4493-a365-8710ac4fc28f	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 01:46:38.73
c496d6f5-5faa-408f-95d2-ab8e71e6ad00	278f85a0-ca0e-48c4-97a2-e2728476ea52	comment	Komentar baru	Dedes Ali di "CV Arkana Cipta Persada - Revisi Akta": tes	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 02:55:26.913
18b9dc0b-0be5-4d92-8eaf-f282173441bf	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "CV Arkana Cipta Persada - Revisi Akta": tes	bd3ad592-2a3c-4347-aff4-ff64efd584be	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 02:55:26.913
11f21390-11db-4904-9b79-19db9411a67b	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Elis di "PT Nusantara Jaya - Siap Kirim Notaris": perm baseline	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 03:07:15.967
d233cc5c-f0b3-432c-9dea-6ac86c3f5366	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Elis di "PT Nusantara Jaya - Siap Kirim Notaris": perm re-enabled	69fb4c3b-7da8-4abd-a550-7aaddc9a6809	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	t	2026-09-04 03:07:48.325
0e1cc4d4-14d1-4bd5-b649-5569dbf10e55	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11	comment	Komentar baru	Dedes Ali di "PT Nusantara Jaya - Proses Notaris": mohon di revisi	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-04 05:47:17.378
c8e40ce4-807c-40ef-b374-f689797bdba3	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Dedes Ali di "PT Nusantara Jaya - Proses Notaris": mohon di revisi	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-04 05:47:17.378
db66f714-cfa5-4c72-b9e5-45006e70bac0	d0723d2c-9568-4349-a3b0-75cd66310c99	comment	Komentar baru	Dedes Ali di "PT Nusantara Jaya - Proses Notaris": mohon di revisi	5a2e0b65-4590-455c-b95f-9fb634005ed1	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-04 05:47:17.378
b732e2d0-2ffc-4e4a-a446-0f1c1c0bfbb1	d0723d2c-9568-4349-a3b0-75cd66310c99	mention	Anda disebut	Elis menyebut Anda di "PT Nusantara Jaya - Proses Notaris": Berikut  sudah di revisi @Devi Ali	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 05:49:17.607
951588f3-2b97-4a34-9724-6218612bb4a5	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11	comment	Komentar baru	Elis di "PT Nusantara Jaya - Proses Notaris": Berikut  sudah di revisi @Devi Ali	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 05:49:17.677
6edc7e4f-0c56-4463-8add-0e2e88561211	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Elis di "PT Nusantara Jaya - Proses Notaris": Berikut  sudah di revisi @Devi Ali	f589af2c-4103-4b7c-9880-424a11304c9e	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 05:49:17.677
3bfa7afe-a1e6-4bc9-a0b6-c271bc6f0fea	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "PT MAJU MUNDUR" berhasil dikirim ke Bank Data Admin Draf Input.	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	\N	f	2026-09-04 06:06:06.092
6d54806f-285d-411f-a0ba-9b996716c2ec	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	claimed	Pekerjaan diambil	Elis telah mengambil pekerjaan "PT MAJU MUNDUR".	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 06:06:16.578
70d79d14-e6fa-4bdc-8757-13f47cfca534	278f85a0-ca0e-48c4-97a2-e2728476ea52	mention	Anda disebut	Dedes Ali menyebut Anda di "PT MAJU MUNDUR": di bantu proses draft nya @Elis	4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c25ed925-60cd-4e6c-9033-a847a6f22ee5	f	2026-09-04 06:07:14.18
21cda914-b44c-419f-ae6c-ae7607c0ec28	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	mention	Anda disebut	Elis menyebut Anda di "PT MAJU MUNDUR": @Dedes Ali oke	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-04 06:07:27.811
d9bc144c-05d1-42b9-ad58-e9f454513cb8	278f85a0-ca0e-48c4-97a2-e2728476ea52	claimed	Pekerjaan diambil	Dedes Ali telah mengambil pekerjaan "PT SATU DUA TIGA".	1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-04 09:12:11.533
9d82d1d7-8d2d-41b3-a5e5-aaaf70419148	2253a72b-43e5-48d4-9d42-ba3db021b20e	comment	Komentar baru	Devi Ali di "CV Mentari Pagi - Komplain Dokumen": tes	d37258aa-06e6-4752-8e59-39692820cef6	86dd6b98-bc2b-41e6-bff1-57298581b511	f	2026-09-04 11:31:40.666
bd7ff9cc-dd6a-4d00-83a9-2b091eb52821	2253a72b-43e5-48d4-9d42-ba3db021b20e	sent	Pekerjaan terkirim	Pekerjaan "PT MAJU JAYA" berhasil dikirim ke Bank Data Admin Draf Input.	199835d1-7b23-4b48-b614-584246a93847	\N	f	2026-09-05 00:33:27.76
63491af8-d43f-46ca-800f-195090f14b52	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	claimed	Pekerjaan diambil	Elis telah mengambil pekerjaan "PT MAJU JAYA".	199835d1-7b23-4b48-b614-584246a93847	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-05 00:34:23.562
bf86886a-eec2-495d-9d59-4cc1b5a0a8b4	2253a72b-43e5-48d4-9d42-ba3db021b20e	claimed	Pekerjaan diambil	Elis telah mengambil pekerjaan "PT MAJU JAYA".	199835d1-7b23-4b48-b614-584246a93847	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-05 00:34:23.562
4af8a84e-1666-45e3-97ca-46e9bd61e164	a843cda0-4e41-40b9-95a0-a9eef8fdaef6	assigned	Kepemilikan kartu dioper ke Anda	Super Admin mengoper kepemilikan "PT SATWA" kepada Anda (Pemilik + PIC).	fdcccffc-2f2a-46d0-be5c-f40af4d32c14	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-05 00:37:41.991
e052191a-ef9a-4e78-8a5f-0d91796453c9	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	assigned	Kepemilikan kartu dioper ke Anda	Super Admin mengoper kepemilikan "PT SATWA" kepada Anda (Pemilik + PIC).	fdcccffc-2f2a-46d0-be5c-f40af4d32c14	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-05 00:37:56.437
47da2d5e-cae0-4905-8abd-005712712fd5	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	assigned	Kepemilikan kartu dioper ke Anda	Super Admin mengoper kepemilikan "PT ABC" kepada Anda (Pemilik + PIC).	e98913e0-1bcf-4904-b0e2-33f07a20a2b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-05 00:39:06.248
4ded7574-dea7-460e-91bb-4477e33d4577	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	sent	Pekerjaan terkirim	Pekerjaan "PT DANANTARA INC NIB" berhasil dikirim ke Bank Data Admin Draf Input.	ed22a6df-71c0-4748-aa74-167c0ae7297d	\N	f	2026-09-05 00:42:50.509
bd507435-f290-467c-9321-dec0b290e96f	278f85a0-ca0e-48c4-97a2-e2728476ea52	sent	Pekerjaan terkirim	Pekerjaan "TES KIRIM DATA" berhasil masuk Bank Data Customer Service.	5839a909-35b1-4528-a30b-9af575616c61	\N	f	2026-09-05 00:44:06.725
c11d1cc5-f230-4ea6-9ec1-1f7a9a319405	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	assigned	Anda ditugaskan	Elis menugaskan Anda pada "TES KIRIM DATA".	5839a909-35b1-4528-a30b-9af575616c61	\N	f	2026-09-05 00:44:06.74
1c03f94c-7ee2-42cb-9409-10e1a0314b4a	278f85a0-ca0e-48c4-97a2-e2728476ea52	sent	Pekerjaan terkirim	Pekerjaan "TES KIRIM DATA" berhasil masuk Bank Data Customer Service.	929450fa-2614-47b0-9ba6-b322fd78bc6d	\N	f	2026-09-05 00:44:27.898
d4877fbb-1ccd-4d33-b1d3-987455a88981	d0723d2c-9568-4349-a3b0-75cd66310c99	assigned	Anda ditugaskan	Elis menugaskan Anda pada "TES KIRIM DATA".	929450fa-2614-47b0-9ba6-b322fd78bc6d	\N	f	2026-09-05 00:44:27.914
3095ca2e-1feb-4190-9fa5-11dfb38432ba	278f85a0-ca0e-48c4-97a2-e2728476ea52	sent	Pekerjaan terkirim	Pekerjaan "PT TES TES" berhasil masuk Bank Data Customer Service.	b25c564d-1446-4476-9eca-3ceee16bcb3e	\N	f	2026-09-05 01:09:09.833
c6100ee4-d40d-4cf7-9e18-be0c81826fc9	278f85a0-ca0e-48c4-97a2-e2728476ea52	claimed	Pekerjaan diambil	Devi Ali telah mengambil pekerjaan "PT TES TES".	b25c564d-1446-4476-9eca-3ceee16bcb3e	128957a0-cc7a-4087-9ec1-ca6ab0977f34	f	2026-09-05 01:11:48.59
fcf6407a-d00d-47c5-8ef7-a2f00d8d88ee	d0723d2c-9568-4349-a3b0-75cd66310c99	sent	Pekerjaan terkirim	Pekerjaan "PT TES TES" berhasil dikirim ke Bank Data Admin Draf Input.	24b28ecc-1eaf-40e0-9e39-3ca47212e496	\N	f	2026-09-05 01:12:18.362
eca22b8c-3888-44aa-bc6c-47b71f8b3dda	d0723d2c-9568-4349-a3b0-75cd66310c99	claimed	Pekerjaan diambil	Elis telah mengambil pekerjaan "PT TES TES".	24b28ecc-1eaf-40e0-9e39-3ca47212e496	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-05 01:12:28.876
7da24607-4ec8-4024-9249-2ad5b82c44c3	d0723d2c-9568-4349-a3b0-75cd66310c99	sent	Pekerjaan terkirim	Pekerjaan "CV Mentari Pagi - Komplain Dokumen" berhasil dikirim ke Bank Data Admin Draf Input.	cfce7263-8a62-453f-99e1-b5ea25df6bcc	\N	f	2026-09-05 03:17:06.716
34b44974-19d3-4a8d-84f8-645f4965c688	d0723d2c-9568-4349-a3b0-75cd66310c99	claimed	Pekerjaan diambil	Elis telah mengambil pekerjaan "CV Mentari Pagi - Komplain Dokumen".	cfce7263-8a62-453f-99e1-b5ea25df6bcc	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	f	2026-09-05 03:18:48.619
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "masterCardId", amount, kind, method, note, "paidAt", "picUserId", "picDivisionId", "recordedById", "recordedByName", "createdAt") FROM stdin;
f3007a41-c74c-410b-a401-42982042836b	ecafa61c-d7f4-467d-a6b7-f0ddc0fd1d1e	1900000	dp	transfer	\N	2026-09-04 11:48:17.877	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	2026-09-04 11:48:17.879
0810b646-c4a0-4515-9525-2c7111ed1726	597505aa-1d80-4fb1-a55a-3dfbd9a4f5a0	200000	dp	\N	\N	2026-09-05 03:49:29.909	d0723d2c-9568-4349-a3b0-75cd66310c99	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	2026-09-05 03:49:29.91
c593eda8-698b-4c69-8c7e-9099bcacec73	597505aa-1d80-4fb1-a55a-3dfbd9a4f5a0	250000	dp	\N	\N	2026-09-05 03:49:37.331	d0723d2c-9568-4349-a3b0-75cd66310c99	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	2026-09-05 03:49:37.332
\.


--
-- Data for Name: RolePermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RolePermission" (id, role, "permKey", allowed) FROM stdin;
ca8f327e-0210-4ac6-9246-76e9c041a908	super_admin	user.manage	t
9a588165-5e1d-4709-81d0-d3ad703c7d7a	super_admin	division.manage	t
4360ef85-8fad-4db5-bd98-1b07d059c2df	super_admin	automation.manage	t
7697c3d2-179a-463b-bf97-cfcec9e0a3d4	super_admin	checklist_template.manage	t
8723f213-ec14-41f7-8bca-ca0df81795f4	super_admin	permission.manage	t
efb1890d-b13b-4b97-b2e5-24c1fc744ae5	super_admin	board.manage	t
b3cd931f-b352-4436-930b-92544902a8a7	super_admin	board.manage_members	t
b547e761-6fca-4ff1-9a71-1b74f615d91f	super_admin	list.manage	t
7b9160d8-507e-4509-9ec0-13a0e2ab450c	super_admin	list.entry_requirements	t
392fdd89-1672-47e8-86ea-e23101d82069	super_admin	label.manage	t
d184aa66-babe-4061-87e6-3bc3d77e5cb1	super_admin	card.create	t
fce0debf-51cc-4941-804a-a184076a1220	super_admin	card.edit	t
1155444f-20cc-4c13-8d06-b972d57e613f	super_admin	card.move	t
eb6ccde0-335f-4c3e-8254-1eae53cc5f43	super_admin	card.archive	t
d100abfc-e937-4817-883f-f12b62952123	super_admin	card.delete	t
e352c00d-f1f5-4490-a5be-392a258173fe	super_admin	card.comment	t
39db2654-9fe0-4c16-a2ca-f6b472f32b5b	super_admin	card.assign_members	t
aad8d3b3-6c69-47ec-a13b-4c05ed4b49e5	super_admin	card.complete	t
adedf193-a737-45db-acc3-316d86739e4a	super_admin	bankdata.send_to_division	t
e9740271-a483-489f-8e60-fc6b029b3794	super_admin	bankdata.intake	t
388bc90c-ef47-48e3-b4fa-5133bccbab6a	super_admin	bankdata.claim	t
17176090-c741-4618-9bff-6472a96689b1	super_admin	bankdata.release	t
e7608a01-4afc-427e-a070-3d8a6b509fbe	super_admin	bankdata.takeover	t
54d2609a-2794-4723-9e00-aad680fb7f2e	super_admin	hari.view	t
9b55da57-0122-4ea3-86c1-269d27ec9043	super_admin	hari.advance	t
fbc1a02d-ca56-4c9c-a759-2ce9a0bf14e5	super_admin	skor.view	t
5aaece45-d484-4f17-95b4-c9ea2a337791	super_admin	table.MasterCard	t
74b46403-2ff6-4e86-9143-5593e2fc7a3a	super_admin	table.Division	t
b94747d8-258a-4c22-89e4-b51627ac1673	super_admin	table.User	t
bedd1b26-0acc-4982-baa3-81bb249ec40e	super_admin	table.Board	t
c9a8ab7b-1670-415e-aab3-37b25021cbd0	super_admin	table.BoardMember	t
472adfb9-6166-415e-927b-b2e1efe51c03	super_admin	table.List	t
c8693b19-5dfe-455a-b39c-0d4ba65fe5b1	super_admin	table.Label	t
2818b673-1515-4f03-b480-340884898220	super_admin	table.WorkItem	t
f994c191-c692-4abb-b7e2-9b8b2f9c4225	super_admin	table.WorkItemLabel	t
892ad655-d499-4d93-9735-1dc68a1139c4	super_admin	table.WorkItemMember	t
43cd32f8-a587-4655-817b-82e370d0aa29	super_admin	table.WorkItemDivision	t
fdac6da1-2f71-43c5-8e8c-40e45c7b1f2b	super_admin	table.WorkItemMirror	t
65e1c83e-5ebd-48fc-b242-e19cd12a812b	super_admin	table.Comment	t
f0194c90-b988-4bea-b8d5-89b6451b1c58	super_admin	table.Activity	t
5a9e239a-57f7-43dc-a8a6-59c1576493ac	super_admin	table.Notification	t
e7fd5501-f90e-424c-9f3a-cac343ba5bfa	super_admin	table.AutomationRule	t
eb3246ef-e920-4f62-a1e2-f169cb4cb50a	super_admin	table.Attachment	t
c0b9f3d7-d4da-48bb-b867-6c488ce9c566	super_admin	table.LoginAttempt	t
9082e755-1b4f-4adb-87f3-80e0c073d75d	super_admin	table.CronRun	t
3b1a18c3-e771-4c14-96b1-b6560129ee2d	super_admin	table.Setting	t
db01e703-a36e-4b96-a960-2eebbef303f1	super_admin	table.AppPermission	t
55cdde0a-d182-4d9a-8781-50011a594ab4	super_admin	table.RolePermission	t
a4542120-981f-4d22-874d-3c991281e1b7	super_admin	table.ChecklistTemplate	t
16b55d7d-a84f-417f-8ffe-285764b47962	super_admin	table.WorkItemAssignmentHistory	t
734983d2-3414-431d-bd2a-663760e24120	admin	checklist_template.manage	t
d627e52b-f420-42ea-ba05-709c31d42547	admin	board.manage_members	t
067547b5-27a4-4252-b7d7-3d853d7f81b3	admin	list.manage	t
f2200401-cc2a-4f6a-ad97-b882d76d134b	admin	label.manage	t
de55fcaa-4b7c-4088-99a3-9d65d4a55ae6	admin	card.create	t
ff4fff73-eac7-4c2f-baa7-36b6dcfc4809	admin	card.edit	t
fe861995-dab0-4c3b-b292-fb257f8d1f8c	admin	card.move	t
f42b0819-4199-49a6-b605-404eb9cc564c	admin	card.archive	t
139f8455-f964-4b00-9b04-95eff9cf2c2a	admin	card.delete	t
959ebb7e-a1a1-466e-afaa-424cff1fa13d	admin	card.comment	t
ef2543e8-da5c-4395-892a-e0deb967a237	admin	card.assign_members	t
6e373ed1-7f0a-481a-b61e-ff3eef0ba793	admin	card.complete	t
70a7f10a-af42-4c23-abc1-40b2c5faeb4d	admin	bankdata.send_to_division	t
80e2df2d-e070-4270-a6d5-86abd0b0f58c	admin	bankdata.intake	t
aba58401-ebe8-4c28-bccf-488e5bef2708	admin	bankdata.claim	t
afc305eb-8098-4882-8b91-86cbbd5bb7a0	admin	bankdata.release	t
7bf665d7-95fc-4a40-b353-bdf2921ce7a4	admin	hari.view	t
4753f8a7-433e-4e25-8e43-512042c0f67e	admin	hari.advance	t
c91190c7-03f7-489e-8b4e-41dd68e02d2d	admin	skor.view	t
93afcff2-3b6c-4ade-b36e-38f96dadafc1	admin	table.MasterCard	f
74241f19-a753-4892-a2ca-5d974bc03292	admin	table.Division	f
ecd2ed26-7611-41bc-80e4-831a3845f781	admin	table.User	f
c5df9b05-a0d2-48ba-a651-e0640626bfac	admin	table.Board	f
43b96193-d490-47bc-90e3-c76263854d40	admin	table.BoardMember	f
f2f21426-d969-41d6-bdb5-ccfbf90aeaf7	admin	table.List	f
82c93255-8df9-4ab0-8a60-d02fcc96d58c	admin	bankdata.takeover	f
d788416c-5a11-41e1-bb63-7934befd6ce0	supervisor	user.manage	f
04f9f6e4-2a3e-4664-ab44-b1256bdfa769	supervisor	division.manage	f
048af882-13e0-4c06-aca5-23adfaedef9d	supervisor	automation.manage	f
5b3249f4-ea23-429a-bc08-3c01ed6efac5	supervisor	checklist_template.manage	t
334cec5a-6493-46d7-a717-ee18a799f0e7	supervisor	permission.manage	f
47f0c0e3-bd20-4a6f-a53c-76dea3b289f6	supervisor	board.manage	f
174adfbb-dd4b-4bbd-88b9-6f59f3bc4a20	supervisor	board.manage_members	t
63cea4bb-33eb-42d8-98bd-fc56f4770d53	supervisor	list.manage	t
9c5fe00b-c1a9-40ca-9380-6306d01d261f	supervisor	list.entry_requirements	f
8d1ef8cb-995d-493e-9565-fa1cfeb556ea	supervisor	label.manage	t
fe2001c9-bb97-4f6c-b2fc-d4de8fd63ae6	supervisor	card.create	t
0397ff4c-349d-431a-846f-f54949055c3d	supervisor	card.edit	t
4f266f28-067e-40a7-82a6-0852f6b9e53c	supervisor	card.move	t
15a64fdd-085a-450a-b712-cd593f7699a8	supervisor	card.archive	t
413803d4-7712-4eb9-acf9-251283ae493b	supervisor	card.delete	t
a9151194-ab51-4bcf-9611-9855ccaddfb2	supervisor	card.comment	t
54406516-e18c-4bca-ba69-dcd28fed4b13	supervisor	card.assign_members	t
9f490011-1cde-45e6-ad6d-b6df6e2606aa	supervisor	card.complete	t
ea23ef02-df53-406c-96ba-9e16bd72f59b	supervisor	bankdata.send_to_division	t
56fc55cb-e0eb-4018-9584-d41b37c41027	supervisor	bankdata.intake	t
a86db1e5-18e3-449e-a4eb-3d747d92b077	supervisor	bankdata.claim	t
96c7162c-e1dc-4146-9293-41573613edf7	supervisor	bankdata.release	t
2d57fa3e-c013-4916-92ea-2830ed163df6	supervisor	bankdata.takeover	t
be24b313-8e84-46e8-b27d-19bf30679565	supervisor	hari.view	t
c81315ae-98ac-470e-a67b-83a50d266018	supervisor	hari.advance	t
ff6df692-69ab-412f-9da3-c0b0167551f0	supervisor	skor.view	t
78d9637e-7121-4f24-bf67-7536219f52b0	supervisor	table.MasterCard	f
b658b4d4-6fb6-4941-a6ea-17845c643ca2	supervisor	table.Division	f
0c541ba4-e61e-4bb4-8903-83850560f7c5	supervisor	table.User	f
b54588b2-8cc3-4466-9c34-af5ad74cefb3	supervisor	table.Board	f
6744c704-097c-4b3e-947b-a078f0d82f1b	supervisor	table.BoardMember	f
568a0009-085d-4a22-b459-7aff0d867dbd	supervisor	table.List	f
5785e260-68eb-4a46-9ad5-e82d2fc91ed2	supervisor	table.Label	f
20f08ea3-05a7-4e66-9b91-e5e00229a543	supervisor	table.WorkItem	f
bec7d655-deb5-4789-aee1-72c4db2850c8	supervisor	table.WorkItemLabel	f
4ccb74f8-10ec-430b-b215-26719a60ebd2	supervisor	table.WorkItemMember	f
68f2e5bf-0a47-4ee8-92d9-2864098c9380	supervisor	table.WorkItemDivision	f
c5c8add7-75e0-461c-8279-0b5bfbeac634	supervisor	table.WorkItemMirror	f
70a918d4-68bb-41a6-a777-289b86b5c1b7	supervisor	table.Comment	f
9504895a-7366-4ab1-854a-a908487edc4e	supervisor	table.Activity	f
74ae3569-1025-4e1b-98c8-3c3411171d36	supervisor	table.Notification	f
0e5790f4-0fbe-44fd-86b3-324e7c17380e	supervisor	table.AutomationRule	f
ec3ed859-66f7-4ace-86fe-e9d9623c76c6	supervisor	table.Attachment	f
fb525bf2-882b-4f27-8919-1e4b3336140c	supervisor	table.LoginAttempt	f
2836a9e9-356a-4912-be2b-fccfe7ae72fb	supervisor	table.CronRun	f
e1810792-f838-4f2a-b658-f38a3347523b	supervisor	table.Setting	f
3839a73d-dbfe-42e3-8a52-4bbe4a752491	supervisor	table.AppPermission	f
c29a1229-b6f1-4978-8581-af7a2d0c189d	supervisor	table.RolePermission	f
5b7feb39-27a0-47ec-83bd-752c3ded6a5f	supervisor	table.ChecklistTemplate	f
0e68c58d-2b52-475f-89e1-e7ff9fbb37d6	supervisor	table.WorkItemAssignmentHistory	f
b4fc9d08-07d5-4b48-ae86-630c6a475370	staff	division.manage	f
6eb59109-bd7a-47ee-b327-ac8e6357b9aa	staff	automation.manage	f
9f20d9c0-c0a0-4067-a69d-a05b5c3bddce	staff	checklist_template.manage	t
a1bf51f4-fddd-4140-938c-dcba22dea9c3	staff	permission.manage	f
dd20e33b-3d76-41cc-9750-80b0fe4bac68	staff	board.manage	f
614e8249-6c3b-4880-a6a5-e414d740bad4	staff	board.manage_members	t
7ee90f37-8e2f-4de7-89e4-d2708f87e29b	staff	list.manage	f
fec64e52-4541-456e-bb4a-aff98cd7be42	staff	list.entry_requirements	f
57e202d5-7024-4aa0-b43f-f4a1f149ff9d	staff	label.manage	t
99cd8360-bfec-4684-a0fb-1331765e5c16	staff	card.create	t
a8927def-c19a-4f41-9401-0c1e3b9b2bc1	staff	card.edit	t
55a5c74c-52c5-4cc9-a581-804dd26c39e7	staff	card.archive	t
77598d40-c54b-4d21-b196-43ac728b78c5	staff	card.delete	t
3e40d102-5561-4318-890c-301cbb30a22c	staff	card.assign_members	t
81475a44-cbd9-4289-bab6-a7ed7c654be5	staff	card.complete	t
1e74062f-7e42-47d0-b904-a3b6d89a156f	staff	bankdata.send_to_division	t
0fa4b6d3-d4c3-44ab-b8de-b18000c5f3ef	staff	bankdata.intake	t
d8711054-2e3b-4b08-8056-49dc34a3935a	staff	bankdata.claim	t
cf6a9571-b44b-45ef-98b1-1b60c4a180e8	admin	table.WorkItemDivision	f
334f0837-6b6c-4542-8ddd-ea1eb537d9fb	staff	user.manage	f
9f6a43cc-d709-4d7e-9f40-d9c2e1214258	staff	card.move	t
da1ef895-91be-416b-8cb5-9dcf5497299c	staff	bankdata.release	t
dea4c50f-7e26-430d-809c-3925c0dab1dc	staff	hari.view	t
95812dc6-f5dd-4dd4-8f78-5ef5d8e9bd85	staff	hari.advance	t
e3a7066d-2668-48dc-8472-328804eb5ebf	staff	skor.view	t
15f745da-dac9-4d4d-9fc9-71528d89d86c	staff	table.MasterCard	f
ebba6ff5-34a6-401f-9c69-7c97c652b23f	staff	table.Division	f
71e0a546-915b-4f36-bbbf-ae33d3e7b787	staff	table.User	f
3d8f025c-c10d-4acf-a4f9-df0f3efd6abd	staff	table.Board	f
6b26e645-ed90-47e4-93a2-f2daae339be4	staff	table.BoardMember	f
95f299a1-4cd4-47f8-a189-be7ae1fc91e2	staff	table.List	f
855d6e7b-d608-4a03-b749-d6774a9467db	staff	table.Label	f
abe00467-9a90-421b-a2ec-9ae32cf55c59	staff	table.WorkItem	f
599c3fca-5381-4693-8578-43d1db634256	staff	table.WorkItemLabel	f
0bf95f56-bf8a-4ce3-88e5-daf060ed48d3	staff	table.WorkItemMember	f
7a95405d-c8cd-4a05-a1b1-f0c937381725	staff	table.WorkItemDivision	f
0898c46f-fd3f-47d4-adf5-f8d2f62165cf	staff	table.WorkItemMirror	f
61fc483b-79f4-4c18-9599-76e5232ce7e2	staff	table.Comment	f
dfaf0fbb-0cc0-4825-8bb2-2c8ee1be487b	staff	table.Activity	f
799dd119-91e7-4e4e-8416-873a20c7e1ad	staff	table.Notification	f
46652c6f-cf67-49e7-940c-b51b22cef7a8	staff	table.AutomationRule	f
359065e4-4ab6-43bc-bac9-461865722a04	staff	table.Attachment	f
351f4f62-fd7e-4e5b-ad1e-8a5980d6f59c	staff	table.LoginAttempt	f
bb376a90-29f1-46fc-8468-c734c4a7e14d	staff	table.CronRun	f
e370881a-a36c-4f21-8c5a-344003ad1d13	staff	table.Setting	f
e3e286a0-08b6-4da8-bed4-283731ecca6f	staff	table.AppPermission	f
15b52a3f-404a-4543-8532-e55a1e55c025	staff	table.RolePermission	f
0b33abe6-be3b-491e-ae66-b1ccabe22113	staff	table.ChecklistTemplate	f
e479dca3-39aa-47c0-b693-3601fbe3acc8	staff	table.WorkItemAssignmentHistory	f
2edf56ee-d795-403f-a005-65696bd21772	viewer	user.manage	f
ad2df9fd-c20e-48eb-a648-94fd587858b1	viewer	division.manage	f
5059bb53-c6a6-4b99-a2ad-b0bc8f029193	viewer	automation.manage	f
2f2f6f06-9226-41be-ad8c-48df590954e5	viewer	checklist_template.manage	f
0787a985-0dcf-4fa7-9082-3212d23b99cf	viewer	permission.manage	f
aeeb523e-e530-4f32-9267-ac3212a538a5	viewer	board.manage	f
5c72b444-6818-4aaa-863f-63fe60291dc2	viewer	board.manage_members	f
5b6124f7-e313-478f-b155-47e56f4fe15a	viewer	list.manage	f
6dfab479-0441-4604-8612-e46dfedd1a1d	viewer	list.entry_requirements	f
a28456ed-ebe5-4217-a16f-7aa8493430af	viewer	label.manage	f
bd269b9c-a2e6-40b4-b9b1-d12507eace86	viewer	card.create	f
7f62018c-6e31-4c4d-ba2d-fe4cfac6d167	viewer	card.edit	f
1522e1bf-4f97-4039-886d-bd03c3260dcb	viewer	card.move	f
ab86fdfd-de08-4d1c-bb74-0d202f345e3b	viewer	card.archive	f
2f2a0bac-4d0b-41a1-90d9-6f0e57eabb4f	viewer	card.delete	f
7ee094e4-5e04-4332-9c62-37eaba6789ea	viewer	card.comment	f
28ae5270-1693-4e5a-808d-95d1b3f05db0	viewer	card.assign_members	f
0515722c-8063-4be8-90e2-8f8eade2189a	viewer	card.complete	f
0f3558fc-4225-441d-abcd-7c0507db2860	viewer	bankdata.send_to_division	f
ba849b90-21f0-4ab3-832f-b498354feb85	viewer	bankdata.intake	f
5f4023a1-d670-4e5c-a60c-87022e6f4939	viewer	bankdata.claim	f
010707ef-2e7c-49c3-8a57-026335cf31d3	viewer	bankdata.release	f
fbf73ad4-0f98-4253-9ec8-57bcfe439731	viewer	hari.view	t
e7308d98-7673-4f74-89e6-753ad370dffb	viewer	hari.advance	f
1388af96-6c2f-48af-a22e-f6c62ba1be47	viewer	skor.view	t
c645c043-5c38-426d-b6fc-421dbfe46e48	viewer	table.MasterCard	f
75a57248-8e90-42a0-b919-d8eb27b0eec0	viewer	table.Division	f
5ae17ed7-4681-4fe7-8ca2-d36507269898	viewer	table.User	f
d0a59792-413f-48ca-a0d2-4f9cc52c376f	viewer	table.Board	f
f726ef26-ae2b-4e51-93d1-3781b87b9f37	viewer	table.BoardMember	f
1d73c5a8-64ca-40f4-9ac8-306892ce3c7e	viewer	table.List	f
dc94f0d9-bbd0-4c9b-9e46-a43987d2e0ac	viewer	table.Label	f
27cf5124-2150-476b-95ca-45e0827873f6	viewer	table.WorkItem	f
d2fb6b7a-dd65-4716-b0a1-d96348efbb90	viewer	table.WorkItemLabel	f
2f74fcbe-5cb0-4d61-9f4d-f14c34abfd0d	viewer	table.WorkItemMember	f
1018b6ae-f69c-412c-bd8f-f2a876fc5edb	viewer	table.WorkItemDivision	f
9a1f2bd5-eef4-4cee-9fc3-72fe86cceae0	viewer	table.WorkItemMirror	f
bc70296f-3524-4970-a983-9425f92cabe9	viewer	table.Comment	f
7abec74e-05db-4258-9a97-3f75b05b99a4	viewer	table.Activity	f
c4df5679-9093-4a1c-8ad9-4cdc8a2f1018	viewer	table.Notification	f
41fc6fdf-0b7f-470e-9c8b-ab37bf5f9a16	viewer	table.AutomationRule	f
3bb95228-494e-4383-9323-1f2b181fcfb4	viewer	table.Attachment	f
f43930a7-72a5-434d-a38c-9aa6b4325a70	viewer	table.LoginAttempt	f
8e70da07-4345-4b30-b7cb-06144f557064	viewer	table.CronRun	f
70d5b071-db0e-4ed3-86c4-0d10b661a7de	viewer	table.Setting	f
063ee361-7245-48cc-befd-fd3d0cb0ddae	viewer	table.AppPermission	f
b7fd47b6-4b37-4cd9-be4d-92a3f38aa4e4	viewer	table.RolePermission	f
97b5d939-2e1c-451f-a9c9-ad7f563b0a1c	viewer	table.ChecklistTemplate	f
db867ef6-7272-46b5-a254-a69db33c15ee	viewer	table.WorkItemAssignmentHistory	f
2d752da9-6bb7-4003-abb0-23fdb1fc8da0	staff	card.comment	t
7e2b8a29-afa5-4eee-ba96-b1e3fa0935b3	super_admin	board.view_all	t
4143e635-a010-4c69-b182-e5001174a5d6	admin	board.view_all	t
3ff369d1-f090-400c-ae4a-09e25a2501ec	supervisor	board.view_all	t
314a6be9-eb72-4f63-97e5-c47d10c88e27	viewer	board.view_all	f
ad78398c-4fff-45e8-9b22-c04801a0b142	cs	user.manage	f
a3ab8899-5543-45d6-9b92-1bab89e60ffb	cs	division.manage	f
f1d3950b-d29e-4754-90c6-b99a86b88a83	staff	bankdata.takeover	f
48160e60-2ff2-4c0a-a8f3-2a30f05948eb	cs	automation.manage	f
73cda092-8d54-4240-a4aa-727e1e31ba29	cs	checklist_template.manage	t
9fedd6a7-13d2-4faf-8e91-cbcbe106d84e	cs	permission.manage	f
1d75bc7e-c3f0-44f2-9877-a26f331f40cf	cs	board.view_all	f
dd6d9457-2914-49de-bbaa-00a55652a7fa	cs	board.manage	f
905a6f46-027e-4382-ab4d-e9a42f7dc535	cs	board.manage_members	f
cebd064e-cc1e-488f-a451-d592618d2f4f	cs	list.manage	f
fc038b11-551d-46ad-ba77-2ae2c4f83013	cs	list.entry_requirements	f
c4d2e82c-17a4-4e06-b3bc-71c4ad60a77a	cs	label.manage	t
c0823b46-59e4-45d6-ac4a-94c54fd78a8e	cs	card.create	t
9fe9fa07-7fb3-42c5-a754-6db22c39dbc1	cs	card.edit	t
27cb962f-5ae8-49aa-9e3d-d221a0433542	cs	card.move	t
96d65b56-0ca7-470f-9ca6-0b24424da219	cs	card.archive	t
88dce6a6-a869-468a-a3bf-4bc9f1af4668	cs	card.delete	t
e702e156-3bec-4a3f-be4d-73b3624ef1aa	cs	card.comment	t
596bbf75-2032-44cf-89c1-413690da6dd3	cs	card.assign_members	t
f7376a10-2134-43bf-ab9c-e762235c7297	cs	card.complete	t
df9513f7-33d3-4901-a434-d26ebb2100e4	cs	bankdata.send_to_division	t
6c400c9e-5c09-4baa-afe2-1991076b84a3	cs	bankdata.intake	t
e8c2b807-7cad-4808-898d-0a6e2d120603	cs	bankdata.claim	t
613fea4d-95f0-4180-88b4-cd19f1a62c0d	cs	bankdata.release	t
d0dae631-d077-4ba6-af00-14a5c38530de	cs	hari.view	t
3b2a6306-821b-4604-be1c-e2e804d6db7a	cs	hari.advance	t
7624b280-f34d-4d7a-a7af-d3fbc0d5bf07	cs	skor.view	t
ad2af7d5-7bb4-472b-8d5e-128fde093b06	cs	table.MasterCard	f
db55a67e-5363-4a82-bbf1-817e920d7e32	cs	table.Division	f
a2f29d7e-0cbe-4cdf-a44d-9512f58b9aa5	cs	table.User	f
d4c386c2-5a89-4e54-a479-accabb96e3d9	cs	table.Board	f
f4079d1b-88cb-4f60-b26b-00799e47287f	cs	table.BoardMember	f
2e430eac-3670-44f0-ab8f-b7f74e117a82	cs	table.List	f
70e63621-2281-4467-8608-0111cf85bf9b	cs	table.Label	f
81ead170-da19-440b-900c-e45460abdc26	cs	table.WorkItem	f
f2ed335c-74e4-44ce-98a9-50f2ee76af0a	cs	table.WorkItemLabel	f
38bcd846-1139-4781-a657-73aeb69946bc	cs	table.WorkItemMember	f
6444d895-de7e-43c4-aad0-e46a5621454b	cs	table.WorkItemDivision	f
4e8074f3-045c-4872-ab15-2281b5e25af3	cs	table.WorkItemMirror	f
85b7282b-15f4-4b23-8246-8dd432eea5cd	cs	table.Comment	f
e319cd0f-7865-4713-a8a0-02119a20da3f	cs	table.Activity	f
8ab423d6-4363-46ab-927c-9aa4dd9a45cf	cs	table.Notification	f
1ebf1429-c030-41c4-a935-3bdd9aed6b98	cs	table.AutomationRule	f
70a7252d-7725-4859-9f1b-ca7e332b407f	cs	table.Attachment	f
3d455d7b-2954-481e-b115-15f1ba8b7cac	cs	table.LoginAttempt	f
00157f28-befb-4513-a367-a9c943460026	cs	table.CronRun	f
b195d6ba-2359-42a0-9349-893d250c7bbe	cs	table.Setting	f
3e6094ef-791b-4007-b7cf-3656f9a7f4ab	cs	table.AppPermission	f
831873ba-8083-46ff-8407-3fa9735f02a4	cs	table.RolePermission	f
e36f8957-9de5-4b3f-a468-10835ae53b5a	cs	table.ChecklistTemplate	f
e8723701-609c-482d-96c6-1db0b46c73e0	cs	table.WorkItemAssignmentHistory	f
cc6a0db4-7946-4284-9362-5e88c74ac79c	admin	user.manage	f
a6ab9408-5d27-4dbb-ac09-1e372785851d	admin	division.manage	f
9be02cc6-3cbc-4438-955a-c83c57f942de	admin	automation.manage	f
a92e9f5e-c6aa-42c9-84a9-f250681c9fbb	admin	permission.manage	f
3e47e5e7-6cbe-4cd4-b839-2f24ce3ca082	admin	board.manage	f
0020f0a0-7483-4203-8988-29b7ff076c42	admin	list.entry_requirements	f
f9264e2d-d1a9-48bb-850f-deb10ed7bbaa	admin	table.Label	f
57c29dbe-d39b-477a-b170-11dd0a38503e	admin	table.WorkItem	f
ad0e0fb3-80b4-4c3e-9b66-90815b86789e	admin	table.WorkItemLabel	f
f382a7cc-5876-4df5-acc8-9ca492e6013f	admin	table.WorkItemMember	f
760a095f-d642-4558-87b7-a6de51de41fe	admin	table.WorkItemMirror	f
7b34c935-5a4f-4c18-8e7c-e1797484f40c	admin	table.Comment	f
47ce218b-359c-4c9d-8f43-aebf4c3cce58	admin	table.Activity	f
bba0061f-b979-40ae-8896-97abf63dd1f3	admin	table.Notification	f
1a59ddef-e4ef-42e6-912e-2740ba0cb553	admin	table.AutomationRule	f
0bbc3a0b-9931-47d0-9818-44e6fead4d16	admin	table.Attachment	f
0ab94e4b-1880-457e-bf34-5c0a4a07baeb	admin	table.LoginAttempt	f
96f4d653-e3ef-4985-9e3d-183116b66203	admin	table.CronRun	f
30c542b8-9b8e-4e52-9597-afff52e20253	admin	table.Setting	f
0b91ecd5-bb00-4474-af28-42b8d0376fb6	admin	table.AppPermission	f
ced18395-4edc-4e68-9c11-a0df39fbf4ef	admin	table.RolePermission	f
d5ff930b-a115-4a88-ba2b-9da35874d6f6	admin	table.ChecklistTemplate	f
362a7f40-61bf-4c9a-a94e-252050a07bab	admin	table.WorkItemAssignmentHistory	f
41fa1a66-29a9-49b7-9487-00d487059d87	staff	board.view_all	f
e96b13bf-01b9-4bde-a2f5-7b1d6bad4c2e	super_admin	board.edit_all	t
db5570f8-8d06-4a39-80bc-a22f72aa2b5a	admin	board.edit_all	f
ad33624a-31e8-4252-ac4f-9d7bd3bd3994	cs	board.edit_all	f
6f7b0a16-1f4d-499f-a567-5b43f3f09b1f	supervisor	board.edit_all	t
d88339e4-1b77-4873-87a4-07b561aa8af9	staff	board.edit_all	f
a34f003e-68d0-4477-bb35-97e7b19175fa	viewer	board.edit_all	f
bef5b8a8-64e5-4871-8498-d337556316ea	super_admin	report.view	t
7916b697-50d7-4a58-90dc-6ae7f82bdfa6	super_admin	finance.manage	t
7d099ed6-6c92-4bff-986e-86fd85f4c20c	cs	finance.manage	t
7be85169-fd10-4a70-bb01-0690cc293df6	supervisor	report.view	t
3c1863dc-660e-4a1d-b4d0-0673b481819d	supervisor	finance.manage	t
09ea4776-1907-4774-acbd-e14f7743c15c	admin	report.view	f
a879b924-205f-4d5a-b31d-cf0017dba14b	cs	report.view	f
07f94f67-abd0-42e5-9af9-fb687e35bf7e	staff	report.view	f
d0ea63b6-a398-4b45-99a8-c2f6a8460900	cs	bankdata.takeover	f
e87a7daa-c1d4-45c3-bc63-bfffb48728bc	viewer	report.view	f
43bce64f-1f40-450e-a374-e70de65f18f6	super_admin	table.Payment	t
c2eaf2aa-ba19-488c-8dfa-7e5ad580bb8a	admin	table.Payment	f
89e0f416-fa35-476d-8924-f3b927f8155c	cs	table.Payment	f
abede1e3-88c8-49eb-9e0b-f707bf3825e4	supervisor	table.Payment	f
373449c0-a6d3-40ca-a56b-9ef77c3a67ac	staff	table.Payment	f
09bf0f53-5d66-4cb6-83ce-76d30f3bb7a7	viewer	table.Payment	f
56949ca2-b1ff-4180-9fcd-baf1718d479d	staff	finance.manage	t
b3e0289d-3aa6-4cd9-9b1b-a43a4a9afd7b	viewer	finance.manage	f
b485c4fe-3cef-4eb2-b195-2722f51aac4f	admin	finance.manage	f
9271720d-9857-4b11-a9f5-f6dfaa1159c1	super_admin	card.transfer_owner	t
ab37e74b-a30d-48ff-a6fc-98c5148f6342	admin	card.transfer_owner	t
8833fd63-7027-4c65-8327-128158713047	cs	card.transfer_owner	t
54709400-1619-49b1-a516-3a6326d48774	supervisor	card.transfer_owner	t
30bdf16e-2fb4-42f8-8412-5a5b8010b0b0	staff	card.transfer_owner	t
0224084a-9c85-49c9-90d5-361093fada09	viewer	card.transfer_owner	f
2e5440e1-6b86-4e0a-8fed-895994013f92	viewer	bankdata.takeover	f
\.


--
-- Data for Name: Setting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Setting" (key, at) FROM stdin;
rr_cs_c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	2026-09-05 00:44:06.66
rr_cs_d0723d2c-9568-4349-a3b0-75cd66310c99	2026-09-05 00:44:27.81
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, email, "passwordHash", role, "divisionId", "avatarColor", "isActive", "createdAt", locale, theme) FROM stdin;
a843cda0-4e41-40b9-95a0-a9eef8fdaef6	Dewi Ali	dewi@ali.id	$2b$10$hwgSDUYcvssp2BmdfL.5B.DDHlfHJTFs.xJefiAB0mrVCKbfJVyJG	staff	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#579DFF	t	2026-09-03 08:24:02.253	id	system
ede08911-c701-4524-8687-73971fd33d78	Julia Ali	julia@ali.id	$2b$10$FElR.svIGs13SXz2ZURSe.nVCKVLEuuihQ5YBGdWxQdwupj08gCLC	staff	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#6CC3E0	t	2026-09-03 08:24:02.411	id	system
5acd72c3-8b34-4665-9e0d-fcdb5d29bb11	Anti	anti@ali.id	$2b$10$SCFg6lhn1cGhQ8KXW.BHGueNmWowAK.7BynhWseG2h8Qzlzk1vd/a	staff	5749c390-4c94-419d-a2b5-1ee98952427f	#F5CD47	t	2026-09-03 08:24:02.851	id	system
0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	Amel	amel@ali.id	$2b$10$q8Pb6Dtubmjgdw84uq1QeuBJSDtRKG1vuDCYym8lQcPFvNOnnDxyi	staff	5fc5b0c9-9335-4663-8e98-49512bf24b89	#22A06B	t	2026-09-03 08:24:03.018	id	system
0cb23c6d-98fe-42bd-a305-78e03f0673cf	Andi	andi@ali.id	$2b$10$36jg7fG/vnHTvEMI3AWDzePiHMlgBN26nr564sA2rjwpcGj/YKh1W	supervisor	e05204d7-05d1-42c9-a989-590cc1cf67e5	#9F8FEF	t	2026-09-03 08:24:03.115	id	system
02474385-9aea-4556-9bc8-e1a0b152fb44	Rina	rina@ali.id	$2b$10$eyCikbOMVTwbgEbvdBKVVeKS67NCpyTuVHnoAjoRSMqoNjvq8ok4q	staff	2bf8ea7b-5215-4e59-807c-a06b4734c7fe	#E774BB	t	2026-09-03 08:24:03.213	id	system
0640b5c8-896d-454d-af55-f2fa8f28ec52	Perm Test	pt1788491284609@x.id	$2b$10$MGk9nFiYOkkUblK5ACr6VOzn6iIJNrhKpJB8L8rV3qEPEpsENTHHe	staff	\N	#0C66E4	f	2026-09-04 03:08:04.787	id	system
c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	dedes@ali.id	$2b$10$ZmsRAmcMEqHRkvkswF1xv.lmOejhLgfzAsRvEQS8e1bCuLefhJcsq	staff	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#0C66E4	t	2026-09-03 08:24:02.058	en	light
2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	admin@example.com	$2b$10$3kpjXn05MdPcwonno391iefJ2syPqaIq6E5sh2K1nP.YDMj3J1Zry	super_admin	\N	#CA3521	t	2026-09-03 08:24:01.928	id	light
278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	elis@ali.id	$2b$10$yydGdqHUBtMGNYkxLcWOi./vA.LlEs3WBcfhWi.GV9I52JBLej6sG	staff	5749c390-4c94-419d-a2b5-1ee98952427f	#E56910	t	2026-09-03 08:24:02.666	id	light
d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	devi@ali.id	$2b$10$1npEqPiNfHitj2H4WRTbr.Na06LdJ7hVpiQSiHvybb3L2ExL2tsj.	staff	be50b6cf-7350-44c7-bfc8-f36ed55f63d1	#1D7AFC	t	2026-09-03 08:24:02.159	id	light
\.


--
-- Data for Name: WorkItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkItem" (id, title, "clientName", description, "boardId", "listId", "position", "dueDate", priority, status, archived, "needsApproval", "createdById", "createdByName", "submittedById", "approvedById", "hariStage", "hariEnteredAt", "createdAt", "updatedAt", "completedAt", "masterCardId", "sourceUserId", "sourceBoardId", "sourceListId", "targetDivisionId", "targetBoardId", "targetListId", "currentPicId", "distributionStatus", "workStatus", "claimedAt", "releasedAt", checklists, "startDate", "coverAttachmentId", "coverColor", "watcherUserIds") FROM stdin;
1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	PT SATU DUA TIGA	NOPAL	PT INC NIB	128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	4000	\N	none	active	f	f	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	\N	\N	\N	\N	2026-09-04 09:11:11.646	2026-09-04 09:12:11.498	\N	123c1ca5-57db-4ca2-8f92-0ea87ea0b1eb	278f85a0-ca0e-48c4-97a2-e2728476ea52	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	CLAIMED	CLAIMED	2026-09-04 09:12:11.496	\N	[{"id": "0c813ea4-202e-457c-84b5-e50e8359253f", "items": [{"id": "c6e16390-1003-4c50-8657-cb458d525fa0", "done": false, "text": "Akta"}, {"id": "3e66d412-e24f-49ff-991c-aa0ff023002b", "done": false, "text": "SK Kemenkumham"}, {"id": "16e000da-3e00-426d-973b-f509312b3fca", "done": false, "text": "NPWP"}, {"id": "769901aa-2afd-4342-83ac-683887ca4ea1", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
929450fa-2614-47b0-9ba6-b322fd78bc6d	TES KIRIM DATA	\N		128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	10000	\N	none	active	f	f	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	\N	\N	\N	\N	2026-09-05 00:44:27.839	2026-09-05 00:44:27.839	\N	8b19e5b8-c51a-46f1-82df-62a08eb7a935	278f85a0-ca0e-48c4-97a2-e2728476ea52	\N	\N	\N	\N	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	DIRECT_ASSIGNED	CLAIMED	2026-09-05 00:44:27.836	\N	\N	\N	\N	\N	{}
1d425560-b11a-4af8-84ed-620af29bdbbc	PT MAJU JAYA			128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	2000	\N	none	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 08:04:50.685	2026-09-05 00:33:27.479	\N	e8b99ad4-9fa6-4547-a748-87c3b56d8c9f	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "5eb0e88d-8c88-4452-b320-b800f1ec2e12", "items": [{"id": "4fdeb506-8962-4891-b348-360459834a11", "done": false, "text": "Akta"}, {"id": "50e2745e-695f-49c9-90b6-6ce05270cd4c", "done": false, "text": "SK Kemenkumham"}, {"id": "e7b3f67a-cc01-48d8-a32f-3ca896bc076b", "done": false, "text": "NPWP"}, {"id": "8cf21d36-eb88-4fd6-9462-c43321be7d45", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	CV MAJU MUNDUR	\N		c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	82251c0b-b53d-4450-9b2d-a1f207098e86	2000	\N	none	done	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 07:20:40.76	2026-09-04 07:21:44.831	2026-09-04 07:21:44.831	45c4128b-8624-4111-b91b-908f71894739	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	c7bcde01-3e94-41fb-8925-1a0c73301b05	c189960d-42a0-448f-850e-fd28898f3e8d	5fc5b0c9-9335-4663-8e98-49512bf24b89	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	b176c09d-cb3d-4694-a7ba-d3fe7c89bdbf	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	CLAIMED	COMPLETED	2026-09-04 07:20:56.61	\N	[{"id": "2f9ef6e3-9cf7-4372-afc9-4880e6b5a453", "items": [{"id": "397b0327-0aa8-47f7-b588-3c0fa916101d", "done": false, "text": "Akta"}, {"id": "efc3eca8-f9ac-4774-b4c2-47118440ecae", "done": false, "text": "SK Kemenkumham"}, {"id": "7ba8778c-f71c-437b-afce-0fd0d408ca62", "done": false, "text": "NPWP"}, {"id": "959ab070-3f42-4ee7-92f8-d6f1a65407fd", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
a2accb54-08ed-40b4-a27f-b2a11613088a	PT ABC			c25ed925-60cd-4e6c-9033-a847a6f22ee5	205d5e5b-d651-4e83-a55b-bde12b40e516	1000	\N	none	active	t	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 05:59:31.222	2026-09-04 05:59:57.257	\N	\N	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	[]	\N	\N	\N	{}
b25c564d-1446-4476-9eca-3ceee16bcb3e	PT TES TES	\N		86dd6b98-bc2b-41e6-bff1-57298581b511	9535f972-590a-403a-bdb5-9e8ba41af949	11000	\N	none	done	f	f	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	\N	\N	\N	\N	2026-09-05 01:09:09.801	2026-09-05 02:43:26.58	2026-09-05 02:43:26.58	5d9f26ef-1a70-4727-8e97-3de595aca1a5	278f85a0-ca0e-48c4-97a2-e2728476ea52	\N	\N	\N	\N	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	CLAIMED	COMPLETED	2026-09-05 01:11:48.553	\N	[{"id": "48ef6509-36b4-4443-8476-d9cbfa29af2e", "items": [{"id": "ca3793aa-bdb3-4d13-ab5d-3089a3baa482", "done": false, "text": "Akta"}, {"id": "b686917d-52d7-4128-abe9-18696bf2118c", "done": false, "text": "SK Kemenkumham"}, {"id": "c66e8a47-dd99-4b5a-a4d2-4153bf7c7fce", "done": false, "text": "NPWP"}, {"id": "b77808ee-9e0b-4c90-ac99-a82bd5a039a8", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
f76d4aae-53bb-4fcc-9e78-93e6e6eb7126	UD Sinar Bahagia - Pengumpulan Berkas	UD Sinar Bahagia	\N	128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	1000	2026-09-10	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.823	2026-09-03 08:24:03.823	\N	ecafa61c-d7f4-467d-a6b7-f0ddc0fd1d1e	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	null	\N	\N	\N	{}
7dc03ff6-521c-4240-9827-17ff30f0b949	CV Arkana Cipta Persada - Pesan Nama	CV Arkana Cipta Persada	\N	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	fbf0a2df-ed23-4399-9eb4-e954a90dcc9d	1000	2026-09-04	urgent	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.881	2026-09-04 10:53:04.958	\N	cacfff91-41be-48a7-a666-1fa128934c48	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	null	\N	\N	\N	{}
a8764c9c-67b5-412b-b64d-8d186c6a00cb	PT Bintang Timur - Follow Up Klien	PT Bintang Timur	\N	c7bcde01-3e94-41fb-8925-1a0c73301b05	a9688a55-d4a4-41fe-b36d-d14ac9719ed7	1000	2026-09-07	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.863	2026-09-03 08:24:03.863	\N	561f8d85-f443-44e6-8ed1-f37a33383e48	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	null	\N	\N	\N	{}
00a54042-5865-41d9-9e53-a77e14227e4b	Yayasan Cahaya Ilmu - Pendirian Yayasan	Yayasan Cahaya Ilmu	\N	c25ed925-60cd-4e6c-9033-a847a6f22ee5	eff23a06-5dfb-41d0-9594-5cda70652b70	500	2026-09-09	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.855	2026-09-03 08:25:49.184	\N	a325a33c-0c08-473b-8034-64cbb6dbafac	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	"[{\\"id\\":\\"14e9f88d-d52f-4593-a13f-81ac8e9d5804\\",\\"title\\":\\"Syarat Berkas\\",\\"items\\":[{\\"id\\":\\"a1fae1e0-1e77-4fd2-8288-808c802b7ca4\\",\\"text\\":\\"KTP Direksi\\",\\"done\\":true},{\\"id\\":\\"ebd7126f-0ff5-4a24-90db-790076bd3301\\",\\"text\\":\\"NPWP\\",\\"done\\":true},{\\"id\\":\\"9b053f67-54e2-4a9f-8b88-f07296a7c922\\",\\"text\\":\\"Akta Pendirian\\",\\"done\\":false},{\\"id\\":\\"327fd3a0-cf6f-4a59-aff6-8d08cc678a09\\",\\"text\\":\\"SK Kemenkumham\\",\\"done\\":false}]}]"	\N	\N	\N	{}
b56d545e-3804-44cc-8f81-04c44c038cc9	PT Graha Sentosa - NPWP Badan	PT Graha Sentosa	\N	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	82251c0b-b53d-4450-9b2d-a1f207098e86	1000	2026-09-20	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.894	2026-09-03 08:24:03.894	\N	1cca4a50-bc3d-4149-a6dd-7cc967f924e7	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	[]	\N	\N	\N	{}
7c827bbf-e16f-4de5-8a47-c8400dd90e7b	PT Illank Rezeki Abadi - Draft Akta	PT Illank Rezeki Abadi	\N	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	1000	2026-09-05	none	active	t	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.875	2026-09-04 00:33:37.665	\N	65215662-fa06-4403-bedd-579bd8115f25	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	"[{\\"id\\":\\"841ca2d6-228c-4ea6-ae91-ed9848149c55\\",\\"title\\":\\"Syarat Berkas\\",\\"items\\":[{\\"id\\":\\"0faccb8c-6e5a-455d-a286-e9157a231b8c\\",\\"text\\":\\"KTP Direksi\\",\\"done\\":true},{\\"id\\":\\"2b1b9223-c084-442f-b359-56ea00bef321\\",\\"text\\":\\"NPWP\\",\\"done\\":true},{\\"id\\":\\"f24448f8-91c2-43d2-b174-0dfdd2a350bf\\",\\"text\\":\\"Akta Pendirian\\",\\"done\\":false},{\\"id\\":\\"ee83bfb4-2cc4-4e54-9222-11890cbff6a0\\",\\"text\\":\\"SK Kemenkumham\\",\\"done\\":false}]}]"	\N	\N	\N	{}
31e21678-2353-4070-a1e4-e13bfb60eae9	CV Arkana Cipta Persada - Revisi Akta	CV Arkana Cipta Persada		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	4000	2026-09-04	urgent	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 01:56:11.041	2026-09-04 03:24:45.543	\N	765e74b3-bf24-4b06-8d6e-1432873dbeda	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	fe052aed-cf5b-49b5-b81e-33125f8ebd6d	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGNED	CLAIMED	2026-09-04 01:56:11.031	\N	\N	\N	\N	\N	{}
43d96871-8ee0-4737-8c9d-d9c6b99c8139	CV Karya Mandala - Pengumpulan Berkas	CV Karya Mandala	\N	c7bcde01-3e94-41fb-8925-1a0c73301b05	c189960d-42a0-448f-850e-fd28898f3e8d	1000	2026-09-11	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.869	2026-09-03 08:24:03.869	\N	9995ad1f-c620-4611-a80d-daa74356f95d	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	"[{\\"id\\":\\"5bc02754-0ad1-4120-80e6-2dfbba5ec94b\\",\\"title\\":\\"Syarat Berkas\\",\\"items\\":[{\\"id\\":\\"d3870348-6c80-4d14-bb83-3e72636f66d5\\",\\"text\\":\\"KTP Direksi\\",\\"done\\":true},{\\"id\\":\\"0a144a80-a05c-4b52-adc6-f0d36439099a\\",\\"text\\":\\"NPWP\\",\\"done\\":true},{\\"id\\":\\"ecc39230-68de-4076-84ba-c7c13d29f862\\",\\"text\\":\\"Akta Pendirian\\",\\"done\\":false},{\\"id\\":\\"6f0bc9a8-1773-4bb8-825d-6fea8beb6438\\",\\"text\\":\\"SK Kemenkumham\\",\\"done\\":false}]}]"	\N	\N	\N	{}
3316ab52-f4f8-4e50-ac17-a30435829c35	CV Mentari Pagi - SPT Tahunan	CV Mentari Pagi	\N	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	b176c09d-cb3d-4694-a7ba-d3fe7c89bdbf	1000	2026-09-13	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.901	2026-09-03 08:24:03.901	\N	966f38e5-b638-4488-b094-1a65af4aa5cb	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	null	\N	\N	\N	{}
78093e5c-0fa7-4a82-8c84-4ac52baee037	PT Bintang Timur - Pengurusan Merek	PT Bintang Timur	\N	227bc34c-05cf-428e-a302-e9abb512c955	3dc51fba-57f4-4d15-9c7b-4d4a975c660f	1000	2026-09-10	urgent	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.907	2026-09-03 08:24:03.907	\N	96304d5b-da3a-462e-b718-a5ed24ede901	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	"[{\\"id\\":\\"89bfda2a-cc1b-4496-95aa-7640a43b4851\\",\\"title\\":\\"Syarat Berkas\\",\\"items\\":[{\\"id\\":\\"ebc8274c-cfe7-4baf-acb1-d0ca07719fe8\\",\\"text\\":\\"KTP Direksi\\",\\"done\\":true},{\\"id\\":\\"8fe35602-a4ad-44b4-8574-877608b88db9\\",\\"text\\":\\"NPWP\\",\\"done\\":true},{\\"id\\":\\"913b3784-6aef-4722-82b3-1b65e198463c\\",\\"text\\":\\"Akta Pendirian\\",\\"done\\":false},{\\"id\\":\\"9aeab4d8-12df-4921-bc26-b60f515cbcdc\\",\\"text\\":\\"SK Kemenkumham\\",\\"done\\":false}]}]"	\N	\N	\N	{}
d04c487a-de6f-4ff8-872e-65c4888209b3	PT Graha Sentosa - Logo & Compro	PT Graha Sentosa	\N	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	06158275-63f8-40f7-b3fe-0cb007bffe27	1000	2026-09-09	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.918	2026-09-03 08:24:03.918	\N	7d02c048-b098-4c34-9c78-0bcc5e58bf38	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	"[{\\"id\\":\\"b13b8275-5b1e-4b23-a577-103184d9feda\\",\\"title\\":\\"Syarat Berkas\\",\\"items\\":[{\\"id\\":\\"9978980a-f343-4181-8154-2ce2a481362d\\",\\"text\\":\\"KTP Direksi\\",\\"done\\":true},{\\"id\\":\\"f66db1f5-aef4-4765-8394-b8306f336a4b\\",\\"text\\":\\"NPWP\\",\\"done\\":true},{\\"id\\":\\"0c7c723e-21e0-47c2-bb3c-2ae6f7ce2a7f\\",\\"text\\":\\"Akta Pendirian\\",\\"done\\":false},{\\"id\\":\\"72f4dc68-61d1-4b68-b5e3-33eb058d7ca6\\",\\"text\\":\\"SK Kemenkumham\\",\\"done\\":false}]}]"	\N	\N	\N	{}
9f0c9817-ce11-49b9-aca0-f7c60ff7c77d	Konten Layanan Pendirian PT	Internal	\N	aa85c43e-9ccf-4db5-b82d-ff9d371d7da4	935d5a1d-ec43-4a54-b3aa-0987f9651b64	1000	2026-09-05	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.924	2026-09-03 08:24:03.924	\N	a016bc45-ec72-407f-88f4-d9278266b2e4	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	null	\N	\N	\N	{}
c5808557-38b5-4010-9cae-afbdcca1ffd2	CV MAJU MUNDUR	\N		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	d17cbe94-ba9e-4198-b786-f244fdcb92d2	1000	\N	none	done	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 06:41:47.861	2026-09-04 13:11:51.648	2026-09-04 13:11:51.647	45c4128b-8624-4111-b91b-908f71894739	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	c7bcde01-3e94-41fb-8925-1a0c73301b05	c189960d-42a0-448f-850e-fd28898f3e8d	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIMED	COMPLETED	2026-09-04 06:41:58.943	\N	[{"id": "898c3e42-11b9-4b23-b20f-930769bbb2d0", "items": [{"id": "5bf26bc6-4d89-44dc-8b33-d563a640f337", "done": false, "text": "Akta"}, {"id": "ff69c4a8-a854-4cc3-9472-0c72a5030c49", "done": false, "text": "SK Kemenkumham"}, {"id": "d4773243-1c24-409c-b9b2-695d90a52355", "done": false, "text": "NPWP"}, {"id": "1d4bc46b-1554-4a5a-8b9e-382a1603ba49", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
3da677b2-eb8a-4091-92ce-fc9ed3a50d23	PT MAJU JAYA	\N		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	7000	\N	none	done	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 08:05:58.336	2026-09-04 08:06:57.874	2026-09-04 08:06:57.873	e8b99ad4-9fa6-4547-a748-87c3b56d8c9f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGNED	COMPLETED	2026-09-04 08:05:58.333	\N	\N	\N	\N	\N	{}
199835d1-7b23-4b48-b614-584246a93847	PT MAJU JAYA	\N		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	8000	\N	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-05 00:33:27.711	2026-09-05 00:34:23.497	\N	e8b99ad4-9fa6-4547-a748-87c3b56d8c9f	2253a72b-43e5-48d4-9d42-ba3db021b20e	128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIMED	CLAIMED	2026-09-05 00:34:23.494	\N	[{"id": "c0b8230b-681c-40b1-9555-307761474148", "items": [{"id": "fc07e4fe-bf4a-4a2b-b246-6b0b2e3551cb", "done": false, "text": "Akta"}, {"id": "be686163-b4cb-4a9a-9e99-ed8203771dac", "done": false, "text": "SK Kemenkumham"}, {"id": "20a6a54a-dc1e-4418-bdc8-ea43e8d793d9", "done": false, "text": "NPWP"}, {"id": "6066f4bc-c4ff-4e6d-9dd9-ef2ea51e2ef0", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
8057a7b1-0471-4a41-b699-cb043e935555	tes			128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	4000	\N	none	active	t	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 09:37:55.523	2026-09-04 10:26:17.153	\N	37b53bae-fa4e-4dbe-9fb8-59732c2b2f5b	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "df86b178-c04c-41ab-b0cb-541cba1fbaeb", "items": [{"id": "911468b7-b105-475c-ab9d-376b2c3054a3", "done": false, "text": "Akta"}, {"id": "1440882b-810a-4fe7-8d31-689eadb5040b", "done": false, "text": "SK Kemenkumham"}, {"id": "dce11f15-7a35-49ed-84e6-f20ddf036a41", "done": false, "text": "NPWP"}, {"id": "d60ae6d2-d8f6-4512-9fff-7267538b9063", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
9c3c889d-171a-4f9b-817e-d7ff4fa159e3	UD Sinar Bahagia - NIB OSS	UD Sinar Bahagia		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	2000	2026-09-06	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:50:52.258	2026-09-04 02:40:38.526	\N	95629d7f-b5c0-4d20-b3e6-3bacb2328f9a	2253a72b-43e5-48d4-9d42-ba3db021b20e	227bc34c-05cf-428e-a302-e9abb512c955	1c96004d-d1f8-4412-927c-1c0a47475f45	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGNED	CLAIMED	2026-09-03 08:50:52.256	\N	\N	\N	\N	\N	{}
f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	PT MAJU MUNDUR	\N		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	6000	\N	none	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 06:06:06.076	2026-09-05 01:45:26.494	\N	8e6763a7-4931-4ef5-b82f-629e4819d53c	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	c25ed925-60cd-4e6c-9033-a847a6f22ee5	205d5e5b-d651-4e83-a55b-bde12b40e516	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIMED	CLAIMED	2026-09-05 01:45:26.494	\N	[{"id": "c93b20bc-dfbd-4ee0-89bc-3612a4043b61", "items": [{"id": "4a5664cd-4896-44a3-b562-4175c8327e9b", "done": false, "text": "Akta"}, {"id": "94d66861-87ce-4b25-be5d-e1710ac9f0a7", "done": false, "text": "SK Kemenkumham"}, {"id": "cf953bdf-d9e6-4e5b-ae1b-edc08b914fa1", "done": false, "text": "NPWP"}, {"id": "5b45b84b-cf04-41f1-9bb8-0da9b5e1c6f9", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
a0d1106e-19ae-430b-99df-a0631f79f57b	UD Sinar Bahagia - NIB OSS	UD Sinar Bahagia	\N	227bc34c-05cf-428e-a302-e9abb512c955	1c96004d-d1f8-4412-927c-1c0a47475f45	0	2026-09-06	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.912	2026-09-03 08:50:52.237	\N	95629d7f-b5c0-4d20-b3e6-3bacb2328f9a	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "a5166639-7b13-415b-a72c-f28dc27c81a0", "items": [{"id": "806ce7f8-0f56-457c-9791-084c83df8cf9", "done": true, "text": "KTP Direksi"}, {"id": "4263696a-62ae-48b2-b430-5facd06cf844", "done": true, "text": "NPWP"}, {"id": "be2ad556-1c4c-4477-a3a4-1eadb2d01c84", "done": false, "text": "Akta Pendirian"}, {"id": "759e31a2-72d6-4ae6-ac76-290b62cfe67d", "done": false, "text": "SK Kemenkumham"}], "title": "Syarat Berkas"}, {"id": "4973b3f6-8d4c-499b-a0df-06cecebcbdd5", "items": [], "title": "Checklist"}, {"id": "c2deb191-79bf-4713-b830-1cd20cdbf954", "items": [{"id": "042b998a-7177-412a-b362-84e377f25fdf", "done": false, "text": "Akta"}, {"id": "dd8d15a5-eb87-4917-b345-140f58a5a53c", "done": false, "text": "SK Kemenkumham"}, {"id": "9f61ca34-b960-4ec9-b7d1-f13686c0ef3e", "done": false, "text": "NPWP"}, {"id": "5a7e9c43-9e08-48ef-b2cc-d519078a276c", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
f589af2c-4103-4b7c-9880-424a11304c9e	PT Nusantara Jaya - Proses Notaris	PT Nusantara Jaya	tess	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	65535	2026-09-08	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:53:32.459	2026-09-04 06:59:15.468	\N	f7b12993-0859-4245-b791-34daeb73146d	2253a72b-43e5-48d4-9d42-ba3db021b20e	86dd6b98-bc2b-41e6-bff1-57298581b511	01102fa9-59b6-4f51-951c-32d161f34708	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11	DIRECT_ASSIGNED	IN_PROGRESS	2026-09-03 08:53:32.457	\N	\N	\N	\N	\N	{}
5a2e0b65-4590-455c-b95f-9fb634005ed1	PT Nusantara Jaya - Proses Notaris	PT Klien Tes	Deskripsi	86dd6b98-bc2b-41e6-bff1-57298581b511	9535f972-590a-403a-bdb5-9e8ba41af949	1000	2026-09-08	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.829	2026-09-04 06:42:37.339	\N	f7b12993-0859-4245-b791-34daeb73146d	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "0498efb3-a9f6-4915-95f4-a99f3d85d021", "items": [{"id": "3fb746c1-648a-4cb6-b2e8-2d1f9da97bdf", "done": false, "text": "Akta Pendirian"}, {"id": "c5261f23-bd34-4acc-b7c2-06a6d8f38196", "done": true, "text": "KTP Direksi"}, {"id": "c62d44a6-3cf8-41c4-8d87-ec7736b30c70", "done": true, "text": "NPWP"}, {"id": "d348b0f4-3184-4556-bd80-1b4325fb95d6", "done": false, "text": "SK Kemenkumham"}], "title": "Syarat Berkas"}, {"id": "bfccef81-5355-4271-b0fa-aac38649a3bd", "items": [{"id": "34d793fa-0fab-4981-92b8-ea1e34e95ece", "done": false, "text": "Akta"}, {"id": "192cbbf0-3de4-4e35-a1e3-808a72f1a84e", "done": false, "text": "SK Kemenkumham"}, {"id": "fa00099f-7af4-4640-9a76-081326c090ab", "done": false, "text": "NPWP"}, {"id": "c36527ea-40ed-4c3d-ae9d-a02f7fcb0642", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
51d95517-9a19-4493-a365-8710ac4fc28f	PT Illank Rezeki Abadi - Pendirian PT	PT Illank Rezeki Abadi	\N	128957a0-cc7a-4087-9ec1-ca6ab0977f34	fe052aed-cf5b-49b5-b81e-33125f8ebd6d	2000	\N	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.804	2026-09-04 01:52:01.294	\N	af4fd3f2-b5b5-439b-bc68-3fbb8f8c9962	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "b5f2d6c1-2983-4bd5-b71f-168e890dfa05", "items": [{"id": "886b3e19-9ae2-4721-9a27-45d8d0cf4481", "done": true, "text": "KTP Direksi"}, {"id": "0b811004-d021-41ab-965b-0f378f860570", "done": true, "text": "NPWP"}, {"id": "d793712b-9c1d-47ac-b89c-a4385a60755d", "done": false, "text": "Akta Pendirian"}, {"id": "d9439d38-bdb5-43a6-b0e5-dd2410fdfe78", "done": false, "text": "SK Kemenkumham"}], "title": "Syarat Berkas"}, {"id": "2c0dcfca-4601-4360-9c2e-5ea44f3f9546", "items": [{"id": "5c2d3546-7686-4086-bab7-115bf46e28ea", "done": true, "text": "Akta"}, {"id": "78445a6a-dad8-4dec-afc0-bc779a460d36", "done": false, "text": "SK Kemenkumham"}, {"id": "ea1a6e78-c46c-46c5-9659-6f25a2eee19e", "done": false, "text": "NPWP"}, {"id": "05a3a233-7862-463f-ae65-c5151379746a", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}, {"id": "ea48f9d3-ba17-4915-8838-a4846f387b78", "items": [], "title": "Checklist"}]	\N	\N	\N	{}
653537b8-3b61-4416-8179-f510392cbf41	PT Graha Sentosa - Pendirian + NIB	PT Graha Sentosa	\N	c25ed925-60cd-4e6c-9033-a847a6f22ee5	5224e32f-9df0-4217-87bc-34171794415b	1000	2026-09-05	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	1	2026-09-04 09:23:56.065	2026-09-03 08:24:03.844	2026-09-04 09:23:56.065	\N	bfd51160-b21a-4f83-8e2d-2b05aac4bcc3	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	\N	\N	\N	[]	\N	\N	\N	{}
69fb4c3b-7da8-4abd-a550-7aaddc9a6809	PT Nusantara Jaya - Siap Kirim Notaris	PT Nusantara Jaya	\N	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	15c297f1-57e2-477b-9acb-f4658a6e00fb	1000	2026-09-04	none	submitted	f	t	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	278f85a0-ca0e-48c4-97a2-e2728476ea52	\N	\N	\N	2026-09-03 08:24:03.887	2026-09-04 03:11:48.207	\N	12b916f1-5b1a-4b96-875b-ad7c7fc820d6	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "4a80d77d-78f2-4507-a186-ec91c8461f42", "items": [{"id": "4d70c6fb-fc95-472d-89dd-268205b02bcc", "done": true, "text": "KTP Direksi"}, {"id": "c4c943e8-7577-4217-8f88-5ce0413f917d", "done": true, "text": "NPWP"}, {"id": "49bbb46c-800b-4b90-84b1-eaa368c81f84", "done": false, "text": "Akta Pendirian"}, {"id": "7352bd24-cf8a-4cd5-8d66-bc2de1cbb2b3", "done": false, "text": "SK Kemenkumham"}], "title": "Syarat Berkas"}, {"id": "2dadeaee-1488-442f-a6ee-bd597ad1cff0", "items": [{"id": "6838ecc7-adca-486f-a314-dc524ec06277", "done": false, "text": "Akta"}, {"id": "64bf68c7-9530-451d-8b76-248a6717f42d", "done": false, "text": "SK Kemenkumham"}, {"id": "489fb26d-9013-4b42-9602-a12dd624ef46", "done": false, "text": "NPWP"}, {"id": "fee46805-0894-4013-be0f-27d80ddb2dac", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
4a3aff3d-1cb9-42ad-8697-86ad331f28bb	CV Arkana Cipta Persada - Revisi Akta	CV Arkana Cipta Persada		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	5000	2026-09-04	urgent	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 01:59:32.279	2026-09-04 03:24:45.549	\N	765e74b3-bf24-4b06-8d6e-1432873dbeda	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	fe052aed-cf5b-49b5-b81e-33125f8ebd6d	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGNED	CLAIMED	2026-09-04 01:59:32.276	\N	\N	\N	\N	\N	{}
4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	PT MAJU MUNDUR		tes&nbsp;Description	128957a0-cc7a-4087-9ec1-ca6ab0977f34	0eca16d2-9dec-4aff-bf9b-759ee2fc1cf4	0	\N	none	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 06:00:17.781	2026-09-05 00:58:45.147	\N	8e6763a7-4931-4ef5-b82f-629e4819d53c	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "2f4ffda6-fdb4-4466-b7dd-69aad4c8c2f3", "items": [{"id": "db8155a5-0bcb-4a98-ac47-67c5cf2116b4", "done": true, "text": "Akta"}, {"id": "e535a3b1-476e-454c-a9b9-53d4d5fa003a", "done": false, "text": "SK Kemenkumham"}, {"id": "a55fc02e-a379-472e-bd55-4b9f42c0bddd", "done": false, "text": "NPWP"}, {"id": "9aa83276-c252-4ef4-bd80-59ece35de200", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4}
ad56ba40-ff17-4316-bb16-89758d84fb71	PT MAJU JAYA	\N		c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	b176c09d-cb3d-4694-a7ba-d3fe7c89bdbf	2000	\N	none	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 08:08:05.893	2026-09-04 08:08:36.175	\N	e8b99ad4-9fa6-4547-a748-87c3b56d8c9f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	5fc5b0c9-9335-4663-8e98-49512bf24b89	c09b0177-ed62-4dd1-bf0c-419b6e0f53a7	b176c09d-cb3d-4694-a7ba-d3fe7c89bdbf	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	CLAIMED	CLAIMED	2026-09-04 08:08:36.171	\N	[{"id": "db4536ac-3b97-4207-ae7c-4a2db2831ca2", "items": [{"id": "08c1648d-e1be-405b-aa8d-f07816d2f48f", "done": false, "text": "Akta"}, {"id": "2c28e5f7-696b-4ac1-b146-a39cb9b15d5d", "done": false, "text": "SK Kemenkumham"}, {"id": "6c6ef2f3-03fb-4fc3-b333-e9ed839b10b4", "done": false, "text": "NPWP"}, {"id": "45e3e20b-b8a5-4d51-b670-29c329e7f50b", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
fdcccffc-2f2a-46d0-be5c-f40af4d32c14	PT SATWA			128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	4000	\N	none	active	t	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-05 00:37:24.098	2026-09-05 00:38:30.668	\N	3e8acd44-f8e9-4d42-bc4f-c02f2307988f	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "c1f7b0d5-18b9-4a1e-a57f-597c49f6a9db", "items": [{"id": "bb9f7c3f-ef12-4589-b2f3-5549959069a4", "done": false, "text": "Akta"}, {"id": "ab169d4d-6b8f-4236-926a-2bfed92ba2d3", "done": false, "text": "SK Kemenkumham"}, {"id": "6999be4f-cb36-4a3b-9419-fcd776bd9885", "done": false, "text": "NPWP"}, {"id": "9aaaf33a-18de-4eb7-b3a3-3d427ab91f29", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
41fbface-ec6a-417c-af5a-5150ed584853	PT DANANTARA INC NIB			128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	5000	\N	none	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-05 00:42:26.693	2026-09-05 00:42:50.33	\N	8df1bddc-0324-4211-b9cd-b2cf13d63cdf	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "67ddf4a3-dfdd-4139-a246-00fed5b0dcd5", "items": [{"id": "58c17314-bb2f-4eb7-9154-62b42ec8058b", "done": false, "text": "Akta"}, {"id": "7ab681d0-806e-41a7-960c-b49b12ebe400", "done": false, "text": "SK Kemenkumham"}, {"id": "848fe220-e74d-4708-a13c-c653bdae350b", "done": false, "text": "NPWP"}, {"id": "05cb3014-867e-4392-94c8-17eed018fd1c", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
ed22a6df-71c0-4748-aa74-167c0ae7297d	PT DANANTARA INC NIB	\N		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	9000	\N	none	active	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-05 00:42:50.464	2026-09-05 00:42:50.464	\N	8df1bddc-0324-4211-b9cd-b2cf13d63cdf	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	\N	AVAILABLE	WAITING_CLAIM	\N	\N	\N	\N	\N	\N	{}
bd3ad592-2a3c-4347-aff4-ff64efd584be	CV Arkana Cipta Persada - Revisi Akta	CV Arkana Cipta Persada	\N	128957a0-cc7a-4087-9ec1-ca6ab0977f34	c8b331fc-a0e7-4381-9d14-df2080f6f96c	1000	2026-09-04	urgent	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.817	2026-09-04 10:56:44.704	\N	765e74b3-bf24-4b06-8d6e-1432873dbeda	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "d9834e13-a866-4bf6-94dd-53e2d9685917", "items": [{"id": "da36c543-6a0a-4631-b6e6-123e89476cdf", "done": true, "text": "KTP Direksi"}, {"id": "57c25ce7-f432-41e1-81f4-d5f60b128303", "done": true, "text": "NPWP"}, {"id": "2e2c8be4-f99a-4c4f-af9a-e5af036a7730", "done": false, "text": "Akta Pendirian"}, {"id": "d17ad00a-7da3-4072-8bfd-ea9275df585c", "done": false, "text": "SK Kemenkumham"}], "title": "Syarat Berkas"}, {"id": "f04c3177-d076-4214-94bd-766d671ecc32", "items": [{"id": "bb274029-c342-4059-b777-5f5ed1fd4356", "done": false, "text": "Akta"}, {"id": "0ca3fef3-470e-4f9d-8867-97dcbca91477", "done": false, "text": "SK Kemenkumham"}, {"id": "79862bca-e4e7-4d23-bbce-8a8149b528b0", "done": false, "text": "NPWP"}, {"id": "2efda3e2-c241-40a9-b5ff-15300097eeba", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
24b28ecc-1eaf-40e0-9e39-3ca47212e496	PT TES TES	\N		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	0	\N	none	done	f	f	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	\N	\N	\N	\N	2026-09-05 01:12:18.341	2026-09-05 02:37:22.492	2026-09-05 01:16:05.001	5d9f26ef-1a70-4727-8e97-3de595aca1a5	d0723d2c-9568-4349-a3b0-75cd66310c99	86dd6b98-bc2b-41e6-bff1-57298581b511	9535f972-590a-403a-bdb5-9e8ba41af949	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIMED	COMPLETED	2026-09-05 01:12:28.834	\N	[{"id": "fe23771a-5f83-4e6d-af56-200ca849e41d", "items": [{"id": "5c6709f0-a10e-43c6-b819-80e8832ddda9", "done": true, "text": "Akta"}, {"id": "86cac79c-e33f-4380-8e91-424f449650c7", "done": false, "text": "SK Kemenkumham"}, {"id": "deff45d8-29aa-4285-9232-fcde6b97176e", "done": false, "text": "NPWP"}, {"id": "991484f1-d3a9-4697-a0f4-c1ced376b9f9", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
5839a909-35b1-4528-a30b-9af575616c61	TES KIRIM DATA	\N		128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	9000	\N	none	active	f	f	278f85a0-ca0e-48c4-97a2-e2728476ea52	Elis	\N	\N	\N	\N	2026-09-05 00:44:06.686	2026-09-05 00:44:06.686	\N	0ff88fdf-00cd-4c93-9a04-cf1f20d67e0a	278f85a0-ca0e-48c4-97a2-e2728476ea52	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	DIRECT_ASSIGNED	CLAIMED	2026-09-05 00:44:06.684	\N	\N	\N	\N	\N	{}
b8189e4d-65dc-4eec-8b39-d2bf461b242b	CV MAJU MUNDUR			128957a0-cc7a-4087-9ec1-ca6ab0977f34	fe052aed-cf5b-49b5-b81e-33125f8ebd6d	65535	\N	none	done	f	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 06:41:17.756	2026-09-04 13:11:51.764	2026-09-04 13:11:51.764	45c4128b-8624-4111-b91b-908f71894739	\N	\N	\N	\N	\N	\N	\N	AVAILABLE	COMPLETED	\N	\N	[{"id": "7e548c25-0a36-4630-9b0c-16af4dedb0be", "items": [{"id": "18fa3bcd-cb55-4335-8acd-3aa9b99a9b40", "done": false, "text": "Akta"}, {"id": "f9888b1d-ff86-4c1e-b0bb-c6b0ee57a79f", "done": false, "text": "SK Kemenkumham"}, {"id": "2a5f4d66-abee-486b-ab17-f0712fdc0e7a", "done": false, "text": "NPWP"}, {"id": "4bc0a4fe-6815-4fa8-85d8-966ec4938215", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
d37258aa-06e6-4752-8e59-39692820cef6	CV Mentari Pagi - Komplain Dokumen	CV Mentari Pagi	\N	86dd6b98-bc2b-41e6-bff1-57298581b511	9535f972-590a-403a-bdb5-9e8ba41af949	1000	2026-09-04	urgent	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-03 08:24:03.837	2026-09-05 03:21:11.563	\N	597505aa-1d80-4fb1-a55a-3dfbd9a4f5a0	\N	\N	\N	\N	\N	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "a23c2b32-df41-4bc7-969e-3c2aaf73e5e4", "items": [{"id": "8ad7135a-8b6d-48d4-b8f6-72f153806164", "done": false, "text": "Akta"}, {"id": "57fa8942-eb22-4760-b85a-ffeeb85fae16", "done": false, "text": "SK Kemenkumham"}, {"id": "c10086f8-8baf-4891-bb08-d3294549d2e7", "done": false, "text": "NPWP"}, {"id": "8ac19277-06ea-4833-a8ac-0b591c67f5e7", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
852e6b2b-3826-4020-84a0-320833b9abbc	tes			128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	5000	\N	none	active	t	f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	Dedes Ali	\N	\N	\N	\N	2026-09-04 10:25:50.785	2026-09-04 10:26:02.1	\N	628c2037-f91f-478b-af42-977710ba65bc	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "58e44f5c-cb9c-4b8e-9007-303e26ddb1da", "items": [{"id": "305efc9a-3440-47ab-a5f6-f20ade4cc1b0", "done": false, "text": "Akta"}, {"id": "62dda92e-d4ba-4ba2-9a2d-3d08ab45141a", "done": false, "text": "SK Kemenkumham"}, {"id": "88aa57b2-1aa2-4ff7-bbbc-069b06173d48", "done": false, "text": "NPWP"}, {"id": "5003977c-3bdf-439a-9733-ba94accd13e6", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
e98913e0-1bcf-4904-b0e2-33f07a20a2b4	PT ABC			128957a0-cc7a-4087-9ec1-ca6ab0977f34	67556d23-d1f1-4145-9111-1e229282a897	5000	\N	none	active	f	f	2253a72b-43e5-48d4-9d42-ba3db021b20e	Super Admin	\N	\N	\N	\N	2026-09-05 00:38:24.142	2026-09-05 00:38:24.142	\N	a1e9eef1-6ba1-4e15-8aa2-2294b538eeac	\N	\N	\N	\N	\N	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	AVAILABLE	IN_PROGRESS	\N	\N	[{"id": "e1630e41-4aa2-4338-840e-f79ffbb0fdb8", "items": [{"id": "7acaad68-c325-45a0-9975-04deac339b0d", "done": false, "text": "Akta"}, {"id": "b080819e-90a7-4035-b26d-f4ac2d4366b7", "done": false, "text": "SK Kemenkumham"}, {"id": "8988eecb-0267-46ec-a579-e5167e22805a", "done": false, "text": "NPWP"}, {"id": "b841aaac-4565-4514-8c0a-3c81aa8b67d3", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
cfce7263-8a62-453f-99e1-b5ea25df6bcc	CV Mentari Pagi - Komplain Dokumen	CV Mentari Pagi		1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	d17cbe94-ba9e-4198-b786-f244fdcb92d2	2000	2026-09-04	urgent	active	f	f	d0723d2c-9568-4349-a3b0-75cd66310c99	Devi Ali	\N	\N	\N	\N	2026-09-05 03:17:06.679	2026-09-05 03:21:11.514	\N	597505aa-1d80-4fb1-a55a-3dfbd9a4f5a0	d0723d2c-9568-4349-a3b0-75cd66310c99	86dd6b98-bc2b-41e6-bff1-57298581b511	9535f972-590a-403a-bdb5-9e8ba41af949	5749c390-4c94-419d-a2b5-1ee98952427f	1c0aa5c3-a1d3-4d7d-ad18-2a4c42572363	8712c507-4679-4786-b518-446d66241b68	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIMED	IN_PROGRESS	2026-09-05 03:18:48.592	\N	[{"id": "5be1d3cd-1df7-4111-a122-d8a28793b54a", "items": [{"id": "39a8a3df-490a-4e75-9673-c543d5cd8cee", "done": false, "text": "Akta"}, {"id": "0d306091-9467-47a8-887b-f669f3f30246", "done": false, "text": "SK Kemenkumham"}, {"id": "0e573d6b-91c5-4212-8dc4-7ad0528192ad", "done": false, "text": "NPWP"}, {"id": "981073b8-8c15-499c-877d-e94ba4c7a6c5", "done": false, "text": "NIB"}], "title": "Progres Legalitas"}]	\N	\N	\N	{}
\.


--
-- Data for Name: WorkItemAssignmentHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkItemAssignmentHistory" (id, "workItemId", "fromUserId", "toUserId", action, reason, "createdById", "createdAt") FROM stdin;
9fff08bf-965e-4148-823c-8ec6b9a038be	9c3c889d-171a-4f9b-817e-d7ff4fa159e3	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGN	\N	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:50:52.267
23f6a280-c737-4080-ad61-b9cc1ad35d64	f589af2c-4103-4b7c-9880-424a11304c9e	\N	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11	DIRECT_ASSIGN	\N	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-03 08:53:32.468
1eaa9280-d80f-4290-a7ac-a64ca93a802c	31e21678-2353-4070-a1e4-e13bfb60eae9	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGN	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	2026-09-04 01:56:11.082
812b7eeb-663e-4877-862f-d3be9ad20eed	4a3aff3d-1cb9-42ad-8697-86ad331f28bb	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGN	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	2026-09-04 01:59:32.292
c53a5b83-1224-400d-8834-710377c88072	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIM	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	2026-09-04 06:06:16.545
da81b5be-d365-46d7-945f-13b3b81d9e3d	c5808557-38b5-4010-9cae-afbdcca1ffd2	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIM	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	2026-09-04 06:41:58.962
3b74f724-0e6a-4373-9fb2-cc45532f8e2e	15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	\N	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	CLAIM	\N	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	2026-09-04 07:20:56.623
9d593cbd-803b-463e-af4b-b8538cf968fc	3da677b2-eb8a-4091-92ce-fc9ed3a50d23	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	DIRECT_ASSIGN	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	2026-09-04 08:05:58.362
46490e21-e849-4b2c-b0e6-47b78644f9f3	ad56ba40-ff17-4316-bb16-89758d84fb71	\N	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	CLAIM	\N	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea	2026-09-04 08:08:36.199
3cd4b66d-98fc-4a6c-a0a5-e2743a51f4c0	1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	CLAIM	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	2026-09-04 09:12:11.508
ac74c833-7609-438d-bd2e-98a7866b535c	199835d1-7b23-4b48-b614-584246a93847	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIM	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	2026-09-05 00:34:23.518
d11950d0-12f2-4627-9589-b47398cfe58e	5839a909-35b1-4528-a30b-9af575616c61	\N	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4	DIRECT_ASSIGN	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	2026-09-05 00:44:06.704
953b067e-2297-4fab-a981-3b14d314c8cf	929450fa-2614-47b0-9ba6-b322fd78bc6d	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	DIRECT_ASSIGN	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	2026-09-05 00:44:27.857
1a2973e7-3b6d-448d-a302-9d4f9d7c30d7	b25c564d-1446-4476-9eca-3ceee16bcb3e	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	CLAIM	\N	d0723d2c-9568-4349-a3b0-75cd66310c99	2026-09-05 01:11:48.568
cc103897-fa86-4e20-ba6c-7dde3e17f0c9	24b28ecc-1eaf-40e0-9e39-3ca47212e496	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIM	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	2026-09-05 01:12:28.847
bb4af0bc-7dc3-4f34-9aeb-b19d7bdaf3be	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	278f85a0-ca0e-48c4-97a2-e2728476ea52	0cb23c6d-98fe-42bd-a305-78e03f0673cf	TAKE_OVER	\N	0cb23c6d-98fe-42bd-a305-78e03f0673cf	2026-09-05 01:45:17.391
c5955d6a-d459-46da-bdf9-c6a2a762b81f	f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	0cb23c6d-98fe-42bd-a305-78e03f0673cf	278f85a0-ca0e-48c4-97a2-e2728476ea52	TAKE_OVER	\N	2253a72b-43e5-48d4-9d42-ba3db021b20e	2026-09-05 01:45:26.521
bd518201-9819-449e-852b-9748eb3935ab	cfce7263-8a62-453f-99e1-b5ea25df6bcc	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	CLAIM	\N	278f85a0-ca0e-48c4-97a2-e2728476ea52	2026-09-05 03:18:48.604
\.


--
-- Data for Name: WorkItemDivision; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkItemDivision" ("workItemId", "divisionId") FROM stdin;
51d95517-9a19-4493-a365-8710ac4fc28f	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
bd3ad592-2a3c-4347-aff4-ff64efd584be	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
f76d4aae-53bb-4fcc-9e78-93e6e6eb7126	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
5a2e0b65-4590-455c-b95f-9fb634005ed1	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
d37258aa-06e6-4752-8e59-39692820cef6	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
653537b8-3b61-4416-8179-f510392cbf41	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
00a54042-5865-41d9-9e53-a77e14227e4b	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
a8764c9c-67b5-412b-b64d-8d186c6a00cb	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
43d96871-8ee0-4737-8c9d-d9c6b99c8139	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
7c827bbf-e16f-4de5-8a47-c8400dd90e7b	5749c390-4c94-419d-a2b5-1ee98952427f
7dc03ff6-521c-4240-9827-17ff30f0b949	5749c390-4c94-419d-a2b5-1ee98952427f
69fb4c3b-7da8-4abd-a550-7aaddc9a6809	5749c390-4c94-419d-a2b5-1ee98952427f
b56d545e-3804-44cc-8f81-04c44c038cc9	5fc5b0c9-9335-4663-8e98-49512bf24b89
3316ab52-f4f8-4e50-ac17-a30435829c35	5fc5b0c9-9335-4663-8e98-49512bf24b89
78093e5c-0fa7-4a82-8c84-4ac52baee037	e05204d7-05d1-42c9-a989-590cc1cf67e5
a0d1106e-19ae-430b-99df-a0631f79f57b	e05204d7-05d1-42c9-a989-590cc1cf67e5
d04c487a-de6f-4ff8-872e-65c4888209b3	2bf8ea7b-5215-4e59-807c-a06b4734c7fe
9f0c9817-ce11-49b9-aca0-f7c60ff7c77d	2bf8ea7b-5215-4e59-807c-a06b4734c7fe
9c3c889d-171a-4f9b-817e-d7ff4fa159e3	5749c390-4c94-419d-a2b5-1ee98952427f
f589af2c-4103-4b7c-9880-424a11304c9e	5749c390-4c94-419d-a2b5-1ee98952427f
31e21678-2353-4070-a1e4-e13bfb60eae9	5749c390-4c94-419d-a2b5-1ee98952427f
4a3aff3d-1cb9-42ad-8697-86ad331f28bb	5749c390-4c94-419d-a2b5-1ee98952427f
a2accb54-08ed-40b4-a27f-b2a11613088a	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	5749c390-4c94-419d-a2b5-1ee98952427f
b8189e4d-65dc-4eec-8b39-d2bf461b242b	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
c5808557-38b5-4010-9cae-afbdcca1ffd2	5749c390-4c94-419d-a2b5-1ee98952427f
15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	5fc5b0c9-9335-4663-8e98-49512bf24b89
1d425560-b11a-4af8-84ed-620af29bdbbc	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
3da677b2-eb8a-4091-92ce-fc9ed3a50d23	5749c390-4c94-419d-a2b5-1ee98952427f
ad56ba40-ff17-4316-bb16-89758d84fb71	5fc5b0c9-9335-4663-8e98-49512bf24b89
1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
8057a7b1-0471-4a41-b699-cb043e935555	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
852e6b2b-3826-4020-84a0-320833b9abbc	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
199835d1-7b23-4b48-b614-584246a93847	5749c390-4c94-419d-a2b5-1ee98952427f
fdcccffc-2f2a-46d0-be5c-f40af4d32c14	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
e98913e0-1bcf-4904-b0e2-33f07a20a2b4	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
41fbface-ec6a-417c-af5a-5150ed584853	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
ed22a6df-71c0-4748-aa74-167c0ae7297d	5749c390-4c94-419d-a2b5-1ee98952427f
5839a909-35b1-4528-a30b-9af575616c61	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
929450fa-2614-47b0-9ba6-b322fd78bc6d	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
b25c564d-1446-4476-9eca-3ceee16bcb3e	be50b6cf-7350-44c7-bfc8-f36ed55f63d1
24b28ecc-1eaf-40e0-9e39-3ca47212e496	5749c390-4c94-419d-a2b5-1ee98952427f
cfce7263-8a62-453f-99e1-b5ea25df6bcc	5749c390-4c94-419d-a2b5-1ee98952427f
\.


--
-- Data for Name: WorkItemLabel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkItemLabel" ("workItemId", "labelId") FROM stdin;
5a2e0b65-4590-455c-b95f-9fb634005ed1	c497a450-1daf-42b5-8e1c-46cdb8ded1ed
5a2e0b65-4590-455c-b95f-9fb634005ed1	71f6320b-ace9-4b79-9367-774658ee8b94
f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	62e987f9-1572-41c7-8d96-244ea4b538ac
4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	69075bb2-c651-4d7d-99a7-faa5ffe054de
d37258aa-06e6-4752-8e59-39692820cef6	fd0acf6d-2265-410c-b580-1a9b759cfdcd
d37258aa-06e6-4752-8e59-39692820cef6	e8fe6200-4ef8-4905-b4cd-2e78ac21ff62
cfce7263-8a62-453f-99e1-b5ea25df6bcc	614e7554-a57f-469f-9c3a-6d3622d84393
cfce7263-8a62-453f-99e1-b5ea25df6bcc	f9a2b6fb-5444-40dc-8006-0fa2ae2a779e
51d95517-9a19-4493-a365-8710ac4fc28f	c607d0e4-c59e-4801-a707-4160a3240ac3
51d95517-9a19-4493-a365-8710ac4fc28f	37a58c90-c478-46f0-ace8-0f2fca5d805c
f589af2c-4103-4b7c-9880-424a11304c9e	dba8085f-cb78-4fa2-9db3-68534a20e0f8
f589af2c-4103-4b7c-9880-424a11304c9e	bb0b245e-280a-46f4-93d5-1aa2d02af489
653537b8-3b61-4416-8179-f510392cbf41	8cff907b-4057-4441-8c2a-d3cf1a0958ee
653537b8-3b61-4416-8179-f510392cbf41	69075bb2-c651-4d7d-99a7-faa5ffe054de
00a54042-5865-41d9-9e53-a77e14227e4b	9e5ef588-6535-41b4-9057-f3dec3e7f5dc
00a54042-5865-41d9-9e53-a77e14227e4b	13384893-d3d0-4226-a991-674f7f3ad6b9
43d96871-8ee0-4737-8c9d-d9c6b99c8139	0b8053fd-249e-447f-ad34-ef5ed20d162d
7c827bbf-e16f-4de5-8a47-c8400dd90e7b	6f560bc2-00c2-4ba8-b493-cbd61dd8e8e7
7dc03ff6-521c-4240-9827-17ff30f0b949	f9a2b6fb-5444-40dc-8006-0fa2ae2a779e
7dc03ff6-521c-4240-9827-17ff30f0b949	8033c539-dd29-4ee0-b8fd-9186c755e1be
b56d545e-3804-44cc-8f81-04c44c038cc9	26841ee1-3576-4932-885c-aa8b9135f77c
3316ab52-f4f8-4e50-ac17-a30435829c35	c599cf77-fdb0-4ea7-ac2b-a791fd244c37
78093e5c-0fa7-4a82-8c84-4ac52baee037	fc883508-36fd-421b-882f-f302558da191
9c3c889d-171a-4f9b-817e-d7ff4fa159e3	437dd8ff-a56e-48a5-8632-25c28462f762
a0d1106e-19ae-430b-99df-a0631f79f57b	2e11384a-87bd-43bd-9b21-80f68cd23651
d04c487a-de6f-4ff8-872e-65c4888209b3	c71d3569-e933-4251-a358-45ae137de4e5
69fb4c3b-7da8-4abd-a550-7aaddc9a6809	dba8085f-cb78-4fa2-9db3-68534a20e0f8
69fb4c3b-7da8-4abd-a550-7aaddc9a6809	bb0b245e-280a-46f4-93d5-1aa2d02af489
31e21678-2353-4070-a1e4-e13bfb60eae9	f9a2b6fb-5444-40dc-8006-0fa2ae2a779e
4a3aff3d-1cb9-42ad-8697-86ad331f28bb	f9a2b6fb-5444-40dc-8006-0fa2ae2a779e
bd3ad592-2a3c-4347-aff4-ff64efd584be	6806eef1-7856-49d8-bd7e-c7450fd36fe6
\.


--
-- Data for Name: WorkItemMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkItemMember" ("workItemId", "userId") FROM stdin;
51d95517-9a19-4493-a365-8710ac4fc28f	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
5a2e0b65-4590-455c-b95f-9fb634005ed1	d0723d2c-9568-4349-a3b0-75cd66310c99
653537b8-3b61-4416-8179-f510392cbf41	a843cda0-4e41-40b9-95a0-a9eef8fdaef6
a8764c9c-67b5-412b-b64d-8d186c6a00cb	ede08911-c701-4524-8687-73971fd33d78
7c827bbf-e16f-4de5-8a47-c8400dd90e7b	278f85a0-ca0e-48c4-97a2-e2728476ea52
7dc03ff6-521c-4240-9827-17ff30f0b949	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11
69fb4c3b-7da8-4abd-a550-7aaddc9a6809	278f85a0-ca0e-48c4-97a2-e2728476ea52
b56d545e-3804-44cc-8f81-04c44c038cc9	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea
78093e5c-0fa7-4a82-8c84-4ac52baee037	0cb23c6d-98fe-42bd-a305-78e03f0673cf
d04c487a-de6f-4ff8-872e-65c4888209b3	02474385-9aea-4556-9bc8-e1a0b152fb44
9c3c889d-171a-4f9b-817e-d7ff4fa159e3	278f85a0-ca0e-48c4-97a2-e2728476ea52
f589af2c-4103-4b7c-9880-424a11304c9e	5acd72c3-8b34-4665-9e0d-fcdb5d29bb11
5a2e0b65-4590-455c-b95f-9fb634005ed1	278f85a0-ca0e-48c4-97a2-e2728476ea52
31e21678-2353-4070-a1e4-e13bfb60eae9	278f85a0-ca0e-48c4-97a2-e2728476ea52
4a3aff3d-1cb9-42ad-8697-86ad331f28bb	278f85a0-ca0e-48c4-97a2-e2728476ea52
f589af2c-4103-4b7c-9880-424a11304c9e	278f85a0-ca0e-48c4-97a2-e2728476ea52
c5808557-38b5-4010-9cae-afbdcca1ffd2	278f85a0-ca0e-48c4-97a2-e2728476ea52
15a7f1bc-d41c-4a88-ac27-bf66cab5b04c	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea
b8189e4d-65dc-4eec-8b39-d2bf461b242b	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
1d425560-b11a-4af8-84ed-620af29bdbbc	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
3da677b2-eb8a-4091-92ce-fc9ed3a50d23	278f85a0-ca0e-48c4-97a2-e2728476ea52
ad56ba40-ff17-4316-bb16-89758d84fb71	0bda13f2-6af3-4ac0-bac7-8cffdeaf56ea
f76d4aae-53bb-4fcc-9e78-93e6e6eb7126	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
1b1fc5a2-1a35-4ddf-83a1-aed0c593fec9	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
8057a7b1-0471-4a41-b699-cb043e935555	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
852e6b2b-3826-4020-84a0-320833b9abbc	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
199835d1-7b23-4b48-b614-584246a93847	278f85a0-ca0e-48c4-97a2-e2728476ea52
fdcccffc-2f2a-46d0-be5c-f40af4d32c14	2253a72b-43e5-48d4-9d42-ba3db021b20e
fdcccffc-2f2a-46d0-be5c-f40af4d32c14	a843cda0-4e41-40b9-95a0-a9eef8fdaef6
fdcccffc-2f2a-46d0-be5c-f40af4d32c14	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
e98913e0-1bcf-4904-b0e2-33f07a20a2b4	2253a72b-43e5-48d4-9d42-ba3db021b20e
e98913e0-1bcf-4904-b0e2-33f07a20a2b4	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
41fbface-ec6a-417c-af5a-5150ed584853	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
5839a909-35b1-4528-a30b-9af575616c61	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
929450fa-2614-47b0-9ba6-b322fd78bc6d	d0723d2c-9568-4349-a3b0-75cd66310c99
b25c564d-1446-4476-9eca-3ceee16bcb3e	d0723d2c-9568-4349-a3b0-75cd66310c99
24b28ecc-1eaf-40e0-9e39-3ca47212e496	278f85a0-ca0e-48c4-97a2-e2728476ea52
4ce2090e-8f36-4d5c-9c77-74a96f5c9b0b	c5f9c4f4-9faf-4a12-a878-1f6ba4d5c0b4
f20aa7cd-c9f9-4e9a-81f7-41d9d87bc8b0	278f85a0-ca0e-48c4-97a2-e2728476ea52
d37258aa-06e6-4752-8e59-39692820cef6	d0723d2c-9568-4349-a3b0-75cd66310c99
cfce7263-8a62-453f-99e1-b5ea25df6bcc	278f85a0-ca0e-48c4-97a2-e2728476ea52
\.


--
-- Data for Name: WorkItemMirror; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkItemMirror" ("workItemId", "boardId") FROM stdin;
653537b8-3b61-4416-8179-f510392cbf41	227bc34c-05cf-428e-a302-e9abb512c955
\.


--
-- Name: Activity Activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_pkey" PRIMARY KEY (id);


--
-- Name: AppPermission AppPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppPermission"
    ADD CONSTRAINT "AppPermission_pkey" PRIMARY KEY (key);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: AutomationRule AutomationRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutomationRule"
    ADD CONSTRAINT "AutomationRule_pkey" PRIMARY KEY (id);


--
-- Name: BoardMember BoardMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardMember"
    ADD CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("boardId", "userId");


--
-- Name: Board Board_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Board"
    ADD CONSTRAINT "Board_pkey" PRIMARY KEY (id);


--
-- Name: ChecklistTemplate ChecklistTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChecklistTemplate"
    ADD CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: CronRun CronRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CronRun"
    ADD CONSTRAINT "CronRun_pkey" PRIMARY KEY ("runId");


--
-- Name: Division Division_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Division"
    ADD CONSTRAINT "Division_pkey" PRIMARY KEY (id);


--
-- Name: Label Label_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Label"
    ADD CONSTRAINT "Label_pkey" PRIMARY KEY (id);


--
-- Name: List List_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."List"
    ADD CONSTRAINT "List_pkey" PRIMARY KEY (id);


--
-- Name: LoginAttempt LoginAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoginAttempt"
    ADD CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY (identifier);


--
-- Name: MasterCard MasterCard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasterCard"
    ADD CONSTRAINT "MasterCard_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: RolePermission RolePermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY (id);


--
-- Name: Setting Setting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Setting"
    ADD CONSTRAINT "Setting_pkey" PRIMARY KEY (key);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WorkItemAssignmentHistory WorkItemAssignmentHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemAssignmentHistory"
    ADD CONSTRAINT "WorkItemAssignmentHistory_pkey" PRIMARY KEY (id);


--
-- Name: WorkItemDivision WorkItemDivision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemDivision"
    ADD CONSTRAINT "WorkItemDivision_pkey" PRIMARY KEY ("workItemId", "divisionId");


--
-- Name: WorkItemLabel WorkItemLabel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemLabel"
    ADD CONSTRAINT "WorkItemLabel_pkey" PRIMARY KEY ("workItemId", "labelId");


--
-- Name: WorkItemMember WorkItemMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemMember"
    ADD CONSTRAINT "WorkItemMember_pkey" PRIMARY KEY ("workItemId", "userId");


--
-- Name: WorkItemMirror WorkItemMirror_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemMirror"
    ADD CONSTRAINT "WorkItemMirror_pkey" PRIMARY KEY ("workItemId", "boardId");


--
-- Name: WorkItem WorkItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_pkey" PRIMARY KEY (id);


--
-- Name: Comment_workItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Comment_workItemId_idx" ON public."Comment" USING btree ("workItemId");


--
-- Name: Division_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Division_key_key" ON public."Division" USING btree (key);


--
-- Name: MasterCard_ownerUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterCard_ownerUserId_idx" ON public."MasterCard" USING btree ("ownerUserId");


--
-- Name: Payment_masterCardId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_masterCardId_idx" ON public."Payment" USING btree ("masterCardId");


--
-- Name: Payment_paidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_paidAt_idx" ON public."Payment" USING btree ("paidAt");


--
-- Name: Payment_picUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_picUserId_idx" ON public."Payment" USING btree ("picUserId");


--
-- Name: RolePermission_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RolePermission_role_idx" ON public."RolePermission" USING btree (role);


--
-- Name: RolePermission_role_permKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RolePermission_role_permKey_key" ON public."RolePermission" USING btree (role, "permKey");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: WorkItem_masterCardId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkItem_masterCardId_idx" ON public."WorkItem" USING btree ("masterCardId");


--
-- Name: WorkItem_targetDivisionId_distributionStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkItem_targetDivisionId_distributionStatus_idx" ON public."WorkItem" USING btree ("targetDivisionId", "distributionStatus");


--
-- Name: Activity Activity_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Activity Activity_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Activity Activity_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Attachment Attachment_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutomationRule AutomationRule_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutomationRule"
    ADD CONSTRAINT "AutomationRule_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutomationRule AutomationRule_triggerListId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutomationRule"
    ADD CONSTRAINT "AutomationRule_triggerListId_fkey" FOREIGN KEY ("triggerListId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BoardMember BoardMember_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardMember"
    ADD CONSTRAINT "BoardMember_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BoardMember BoardMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardMember"
    ADD CONSTRAINT "BoardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Board Board_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Board"
    ADD CONSTRAINT "Board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Board Board_divisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Board"
    ADD CONSTRAINT "Board_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comment Comment_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Label Label_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Label"
    ADD CONSTRAINT "Label_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: List List_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."List"
    ADD CONSTRAINT "List_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MasterCard MasterCard_ownerDivisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasterCard"
    ADD CONSTRAINT "MasterCard_ownerDivisionId_fkey" FOREIGN KEY ("ownerDivisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MasterCard MasterCard_ownerUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasterCard"
    ADD CONSTRAINT "MasterCard_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_masterCardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_masterCardId_fkey" FOREIGN KEY ("masterCardId") REFERENCES public."MasterCard"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RolePermission RolePermission_permKey_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_permKey_fkey" FOREIGN KEY ("permKey") REFERENCES public."AppPermission"(key) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_divisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItemAssignmentHistory WorkItemAssignmentHistory_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemAssignmentHistory"
    ADD CONSTRAINT "WorkItemAssignmentHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkItemAssignmentHistory WorkItemAssignmentHistory_fromUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemAssignmentHistory"
    ADD CONSTRAINT "WorkItemAssignmentHistory_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItemAssignmentHistory WorkItemAssignmentHistory_toUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemAssignmentHistory"
    ADD CONSTRAINT "WorkItemAssignmentHistory_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItemAssignmentHistory WorkItemAssignmentHistory_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemAssignmentHistory"
    ADD CONSTRAINT "WorkItemAssignmentHistory_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemDivision WorkItemDivision_divisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemDivision"
    ADD CONSTRAINT "WorkItemDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemDivision WorkItemDivision_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemDivision"
    ADD CONSTRAINT "WorkItemDivision_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemLabel WorkItemLabel_labelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemLabel"
    ADD CONSTRAINT "WorkItemLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES public."Label"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemLabel WorkItemLabel_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemLabel"
    ADD CONSTRAINT "WorkItemLabel_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemMember WorkItemMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemMember"
    ADD CONSTRAINT "WorkItemMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemMember WorkItemMember_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemMember"
    ADD CONSTRAINT "WorkItemMember_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemMirror WorkItemMirror_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemMirror"
    ADD CONSTRAINT "WorkItemMirror_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItemMirror WorkItemMirror_workItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItemMirror"
    ADD CONSTRAINT "WorkItemMirror_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES public."WorkItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkItem WorkItem_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_boardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkItem WorkItem_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkItem WorkItem_currentPicId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_currentPicId_fkey" FOREIGN KEY ("currentPicId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_listId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkItem WorkItem_masterCardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_masterCardId_fkey" FOREIGN KEY ("masterCardId") REFERENCES public."MasterCard"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_sourceBoardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_sourceBoardId_fkey" FOREIGN KEY ("sourceBoardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_sourceListId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_sourceListId_fkey" FOREIGN KEY ("sourceListId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_sourceUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_targetBoardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_targetBoardId_fkey" FOREIGN KEY ("targetBoardId") REFERENCES public."Board"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_targetDivisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_targetDivisionId_fkey" FOREIGN KEY ("targetDivisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkItem WorkItem_targetListId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkItem"
    ADD CONSTRAINT "WorkItem_targetListId_fkey" FOREIGN KEY ("targetListId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict z00izcuHzOlgH8ivlmAN8y5396I4kIkLytNOBQSjMVEMwSzyhJwhlULemjm6r2e

