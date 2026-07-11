-- 台北之心闖關網頁
-- Migration 002: create tables
-- 草案日期：2026-07-10

set search_path = taipei_challenge, public, extensions;

create table if not exists taipei_challenge.activities (
  id uuid primary key default gen_random_uuid(),
  title_zh text not null,
  title_en text not null,
  date date,
  min_team_size integer not null default 3 check (min_team_size >= 1),
  max_team_size integer not null default 6 check (max_team_size >= min_team_size),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists taipei_challenge.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists taipei_challenge.teams (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references taipei_challenge.activities(id) on delete cascade,
  team_name text not null,
  team_code text not null unique,
  passcode_plaintext text not null,
  passcode_hash text not null,
  assigned_teacher_id uuid references taipei_challenge.teacher_profiles(id) on delete set null,
  submitted_at timestamptz,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, team_name)
);

create table if not exists taipei_challenge.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references taipei_challenge.teams(id) on delete cascade,
  class_name text,
  seat_number text,
  student_name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists taipei_challenge.team_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references taipei_challenge.teams(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (team_id, auth_user_id)
);

create table if not exists taipei_challenge.content_pages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references taipei_challenge.activities(id) on delete cascade,
  page_key text not null,
  title_zh text not null,
  title_en text not null,
  intro_en text,
  intro_zh text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, page_key)
);

create table if not exists taipei_challenge.missions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references taipei_challenge.activities(id) on delete cascade,
  page_key text not null,
  mission_type text not null check (mission_type in ('photo_text', 'audio', 'station_sign', 'world_friend', 'info_card')),
  name_zh text not null,
  name_en text not null,
  intro_en text,
  intro_zh text,
  suggested_keywords text[] not null default array[]::text[],
  required_media text not null default 'none' check (required_media in ('none', 'photo', 'audio')),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, page_key, sort_order)
);

create table if not exists taipei_challenge.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references taipei_challenge.teams(id) on delete cascade,
  mission_id uuid not null references taipei_challenge.missions(id) on delete cascade,
  answer_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'synced', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, mission_id)
);

create table if not exists taipei_challenge.media_files (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references taipei_challenge.teams(id) on delete cascade,
  mission_id uuid references taipei_challenge.missions(id) on delete set null,
  submission_id uuid references taipei_challenge.submissions(id) on delete set null,
  type text not null check (type in ('photo', 'audio')),
  storage_path text not null unique,
  file_size integer,
  mime_type text,
  upload_status text not null default 'queued' check (upload_status in ('queued', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists taipei_challenge.world_friend_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references taipei_challenge.teams(id) on delete cascade,
  country_text text not null,
  interview_completed boolean not null default false,
  photo_media_id uuid references taipei_challenge.media_files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists taipei_challenge.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_taipei_activities_status on taipei_challenge.activities(status);
create index if not exists idx_taipei_teacher_profiles_auth_user_id on taipei_challenge.teacher_profiles(auth_user_id);
create index if not exists idx_taipei_teams_activity_id on taipei_challenge.teams(activity_id);
create index if not exists idx_taipei_teams_assigned_teacher_id on taipei_challenge.teams(assigned_teacher_id);
create index if not exists idx_taipei_team_members_team_id on taipei_challenge.team_members(team_id);
create index if not exists idx_taipei_team_sessions_team_id on taipei_challenge.team_sessions(team_id);
create index if not exists idx_taipei_team_sessions_auth_user_id on taipei_challenge.team_sessions(auth_user_id);
create index if not exists idx_taipei_content_pages_activity_page on taipei_challenge.content_pages(activity_id, page_key);
create index if not exists idx_taipei_missions_activity_page on taipei_challenge.missions(activity_id, page_key);
create index if not exists idx_taipei_submissions_team_mission on taipei_challenge.submissions(team_id, mission_id);
create index if not exists idx_taipei_world_friend_team_id on taipei_challenge.world_friend_records(team_id);
create index if not exists idx_taipei_media_team_id on taipei_challenge.media_files(team_id);
create index if not exists idx_taipei_audit_actor on taipei_challenge.audit_logs(actor_auth_user_id);
create index if not exists idx_taipei_audit_target on taipei_challenge.audit_logs(target_table, target_id);

grant select on taipei_challenge.activities to anon, authenticated;
grant select on taipei_challenge.content_pages to anon, authenticated;
grant select on taipei_challenge.missions to anon, authenticated;
grant select, insert, update, delete on all tables in schema taipei_challenge to authenticated;
