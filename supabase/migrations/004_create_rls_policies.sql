-- 台北之心闖關網頁
-- Migration 004: enable RLS and create policies
-- 草案日期：2026-07-10

set search_path = taipei_challenge, public, extensions;

alter table taipei_challenge.activities enable row level security;
alter table taipei_challenge.teacher_profiles enable row level security;
alter table taipei_challenge.teams enable row level security;
alter table taipei_challenge.team_members enable row level security;
alter table taipei_challenge.team_sessions enable row level security;
alter table taipei_challenge.content_pages enable row level security;
alter table taipei_challenge.missions enable row level security;
alter table taipei_challenge.submissions enable row level security;
alter table taipei_challenge.world_friend_records enable row level security;
alter table taipei_challenge.media_files enable row level security;
alter table taipei_challenge.audit_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'activities' and policyname = 'active activities are readable') then
    create policy "active activities are readable"
    on taipei_challenge.activities
    for select
    to anon, authenticated
    using (status = 'active' or taipei_challenge.is_teacher());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'activities' and policyname = 'admins manage activities') then
    create policy "admins manage activities"
    on taipei_challenge.activities
    for all
    to authenticated
    using (taipei_challenge.is_admin())
    with check (taipei_challenge.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'teacher_profiles' and policyname = 'teachers read own profile') then
    create policy "teachers read own profile"
    on taipei_challenge.teacher_profiles
    for select
    to authenticated
    using (auth_user_id = auth.uid() or taipei_challenge.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'teacher_profiles' and policyname = 'admins manage teacher profiles') then
    create policy "admins manage teacher profiles"
    on taipei_challenge.teacher_profiles
    for all
    to authenticated
    using (taipei_challenge.is_admin())
    with check (taipei_challenge.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'teams' and policyname = 'users read accessible teams') then
    create policy "users read accessible teams"
    on taipei_challenge.teams
    for select
    to authenticated
    using (taipei_challenge.can_access_team(id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'teams' and policyname = 'users update accessible unlocked teams') then
    create policy "users update accessible unlocked teams"
    on taipei_challenge.teams
    for update
    to authenticated
    using (taipei_challenge.can_access_team(id) and (taipei_challenge.team_is_unlocked(id) or taipei_challenge.is_teacher()))
    with check (taipei_challenge.can_access_team(id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'team_members' and policyname = 'users read accessible team members') then
    create policy "users read accessible team members"
    on taipei_challenge.team_members
    for select
    to authenticated
    using (taipei_challenge.can_access_team(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'team_members' and policyname = 'students manage unlocked team members') then
    create policy "students manage unlocked team members"
    on taipei_challenge.team_members
    for all
    to authenticated
    using (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id))
    with check (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'team_sessions' and policyname = 'users read own team sessions') then
    create policy "users read own team sessions"
    on taipei_challenge.team_sessions
    for select
    to authenticated
    using (auth_user_id = auth.uid() or taipei_challenge.is_teacher());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'content_pages' and policyname = 'active content pages are readable') then
    create policy "active content pages are readable"
    on taipei_challenge.content_pages
    for select
    to anon, authenticated
    using (
      exists (
        select 1 from taipei_challenge.activities a
        where a.id = activity_id
          and (a.status = 'active' or taipei_challenge.is_teacher())
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'content_pages' and policyname = 'admins manage content pages') then
    create policy "admins manage content pages"
    on taipei_challenge.content_pages
    for all
    to authenticated
    using (taipei_challenge.is_admin())
    with check (taipei_challenge.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'missions' and policyname = 'active missions are readable') then
    create policy "active missions are readable"
    on taipei_challenge.missions
    for select
    to anon, authenticated
    using (
      exists (
        select 1 from taipei_challenge.activities a
        where a.id = activity_id
          and (a.status = 'active' or taipei_challenge.is_teacher())
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'missions' and policyname = 'admins manage missions') then
    create policy "admins manage missions"
    on taipei_challenge.missions
    for all
    to authenticated
    using (taipei_challenge.is_admin())
    with check (taipei_challenge.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'submissions' and policyname = 'users read accessible submissions') then
    create policy "users read accessible submissions"
    on taipei_challenge.submissions
    for select
    to authenticated
    using (taipei_challenge.can_access_team(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'submissions' and policyname = 'students manage unlocked submissions') then
    create policy "students manage unlocked submissions"
    on taipei_challenge.submissions
    for all
    to authenticated
    using (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id))
    with check (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'world_friend_records' and policyname = 'users read accessible world friend records') then
    create policy "users read accessible world friend records"
    on taipei_challenge.world_friend_records
    for select
    to authenticated
    using (taipei_challenge.can_access_team(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'world_friend_records' and policyname = 'students manage unlocked world friend records') then
    create policy "students manage unlocked world friend records"
    on taipei_challenge.world_friend_records
    for all
    to authenticated
    using (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id))
    with check (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'media_files' and policyname = 'users read accessible media files') then
    create policy "users read accessible media files"
    on taipei_challenge.media_files
    for select
    to authenticated
    using (taipei_challenge.can_access_team(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'media_files' and policyname = 'students manage unlocked media files') then
    create policy "students manage unlocked media files"
    on taipei_challenge.media_files
    for all
    to authenticated
    using (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id))
    with check (taipei_challenge.can_access_team(team_id) and taipei_challenge.team_is_unlocked(team_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'taipei_challenge' and tablename = 'audit_logs' and policyname = 'admins read audit logs') then
    create policy "admins read audit logs"
    on taipei_challenge.audit_logs
    for select
    to authenticated
    using (taipei_challenge.is_admin());
  end if;
end;
$$;

