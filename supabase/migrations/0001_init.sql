-- ════════════════════════════════════════════════════════════════════════════
--  HackaroundCIA — schema + Row-Level Security
--  Run once in the Supabase SQL editor (or via `supabase db push`).
--  Every table is scoped to the authenticated (anonymous-or-linked) user via
--  RLS: student_id = auth.uid(). One user's rows are unreadable by any other
--  through every code path. Re-runnable (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin create type document_type as enum
  ('course_plan','cia_handout','syllabus','other');
exception when duplicate_object then null; end $$;

do $$ begin create type confidence as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

do $$ begin create type extraction_status as enum
  ('pending','extracted','parse_failed','confirmed');
exception when duplicate_object then null; end $$;

do $$ begin create type grouping_method as enum
  ('code_exact','code_near','name_fuzzy','none');
exception when duplicate_object then null; end $$;

do $$ begin create type grouping_status as enum ('auto','user_confirmed');
exception when duplicate_object then null; end $$;

do $$ begin create type due_date_type as enum
  ('calendar_date','week_number','unknown');
exception when duplicate_object then null; end $$;

do $$ begin create type resolution_status as enum
  ('auto','user_confirmed','unresolved_conflict');
exception when duplicate_object then null; end $$;

do $$ begin create type item_status as enum
  ('urgent','later','done','needs_input');
exception when duplicate_object then null; end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists terms (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,
  week1_start_date date,
  created_at       timestamptz not null default now()
);

create table if not exists documents (
  id                        uuid primary key default gen_random_uuid(),
  student_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term_id                   uuid references terms(id) on delete set null,
  original_filename         text not null,
  document_type             document_type,
  document_type_confidence  confidence,
  extraction_status         extraction_status not null default 'pending',
  raw_file_ref              text,                    -- storage path; nulled on confirm (DPDP)
  extracted_json            jsonb,
  uploaded_at               timestamptz not null default now(),
  confirmed_at              timestamptz
);

create table if not exists subjects (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term_id             uuid references terms(id) on delete set null,
  course_code         text,
  title               text not null,
  program_class       text,
  grouping_method     grouping_method not null default 'none',
  grouping_confidence numeric,
  grouping_status     grouping_status not null default 'auto',
  reading_lists       jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);

-- join: which documents compose a subject
create table if not exists subject_documents (
  subject_id  uuid not null references subjects(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  primary key (subject_id, document_id)
);

create table if not exists assessment_items (
  id                  uuid primary key default gen_random_uuid(),
  subject_id          uuid not null references subjects(id) on delete cascade,
  label               text not null,              -- free text: 'CIA I A', 'ESE', ...
  resolved_weight     numeric,
  resolved_due_date   date,
  due_date_type       due_date_type,
  resolved_deliverable text,
  resolution_status   resolution_status not null default 'auto',
  status              item_status not null default 'needs_input',
  created_at          timestamptz not null default now()
);

-- provenance ledger: each candidate value with the document it came from
create table if not exists item_values (
  id                    uuid primary key default gen_random_uuid(),
  assessment_item_id    uuid not null references assessment_items(id) on delete cascade,
  source_document_id    uuid references documents(id) on delete set null,
  field_name            text not null,
  candidate_value       text,
  extraction_confidence confidence,
  created_at            timestamptz not null default now()
);

create table if not exists user_overrides (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assessment_item_id uuid references assessment_items(id) on delete cascade,
  field              text not null,
  value              text not null,
  set_at             timestamptz not null default now()
);

create table if not exists extraction_log (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  model       text not null,
  in_tokens   integer,
  out_tokens  integer,
  est_cost    numeric,
  attempt_no  integer not null default 1,
  created_at  timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_terms_student        on terms(student_id);
create index if not exists idx_documents_student     on documents(student_id);
create index if not exists idx_documents_term        on documents(term_id);
create index if not exists idx_documents_status      on documents(extraction_status);
create index if not exists idx_subjects_student      on subjects(student_id);
create index if not exists idx_subjects_term         on subjects(term_id);
create index if not exists idx_subjects_code         on subjects(course_code);
create index if not exists idx_subdocs_document      on subject_documents(document_id);
create index if not exists idx_items_subject         on assessment_items(subject_id);
create index if not exists idx_itemvalues_item       on item_values(assessment_item_id);
create index if not exists idx_itemvalues_srcdoc     on item_values(source_document_id);
create index if not exists idx_overrides_student     on user_overrides(student_id);
create index if not exists idx_overrides_item        on user_overrides(assessment_item_id);
create index if not exists idx_extlog_student        on extraction_log(student_id);
create index if not exists idx_extlog_document       on extraction_log(document_id);

-- ════════════════════════════════════════════════════════════════════════════
--  Row-Level Security
-- ════════════════════════════════════════════════════════════════════════════

-- Tables owning student_id directly: owner-only for all operations.
alter table terms           enable row level security;
alter table documents       enable row level security;
alter table subjects        enable row level security;
alter table user_overrides  enable row level security;
alter table extraction_log  enable row level security;

drop policy if exists owner_all on terms;
create policy owner_all on terms for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

drop policy if exists owner_all on documents;
create policy owner_all on documents for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

drop policy if exists owner_all on subjects;
create policy owner_all on subjects for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

drop policy if exists owner_all on user_overrides;
create policy owner_all on user_overrides for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

drop policy if exists owner_all on extraction_log;
create policy owner_all on extraction_log for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- Child tables: ownership derived from parent that carries student_id.
alter table subject_documents enable row level security;
alter table assessment_items  enable row level security;
alter table item_values       enable row level security;

drop policy if exists owner_all on subject_documents;
create policy owner_all on subject_documents for all
  using (
    exists (select 1 from subjects s
            where s.id = subject_id and s.student_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from subjects s
            where s.id = subject_id and s.student_id = (select auth.uid()))
    and exists (select 1 from documents d
            where d.id = document_id and d.student_id = (select auth.uid()))
  );

drop policy if exists owner_all on assessment_items;
create policy owner_all on assessment_items for all
  using (
    exists (select 1 from subjects s
            where s.id = subject_id and s.student_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from subjects s
            where s.id = subject_id and s.student_id = (select auth.uid()))
  );

drop policy if exists owner_all on item_values;
create policy owner_all on item_values for all
  using (
    exists (select 1 from assessment_items ai
            join subjects s on s.id = ai.subject_id
            where ai.id = assessment_item_id and s.student_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from assessment_items ai
            join subjects s on s.id = ai.subject_id
            where ai.id = assessment_item_id and s.student_id = (select auth.uid()))
  );

-- ════════════════════════════════════════════════════════════════════════════
--  Storage — private bucket for raw uploads, owner-scoped by top folder = uid
--  (path convention: `<auth.uid()>/<term>/<filename>`). Raw files are deleted
--  on document confirmation (DPDP); these policies also let a user purge their
--  own objects for delete-my-data.
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('raw-uploads', 'raw-uploads', false)
on conflict (id) do nothing;

drop policy if exists raw_uploads_select on storage.objects;
create policy raw_uploads_select on storage.objects for select
  using (bucket_id = 'raw-uploads'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists raw_uploads_insert on storage.objects;
create policy raw_uploads_insert on storage.objects for insert
  with check (bucket_id = 'raw-uploads'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists raw_uploads_update on storage.objects;
create policy raw_uploads_update on storage.objects for update
  using (bucket_id = 'raw-uploads'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists raw_uploads_delete on storage.objects;
create policy raw_uploads_delete on storage.objects for delete
  using (bucket_id = 'raw-uploads'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
