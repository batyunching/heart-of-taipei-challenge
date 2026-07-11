-- 台北之心闖關網頁
-- Migration 003: create helper functions and triggers
-- 草案日期：2026-07-10

set search_path = taipei_challenge, public, extensions;

create or replace function taipei_challenge.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function taipei_challenge.is_admin()
returns boolean
language sql
stable
security definer
set search_path = taipei_challenge, public
as $$
  select exists (
    select 1
    from taipei_challenge.teacher_profiles tp
    where tp.auth_user_id = auth.uid()
      and tp.role = 'admin'
  );
$$;

create or replace function taipei_challenge.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = taipei_challenge, public
as $$
  select exists (
    select 1
    from taipei_challenge.teacher_profiles tp
    where tp.auth_user_id = auth.uid()
      and tp.role in ('teacher', 'admin')
  );
$$;

create or replace function taipei_challenge.team_is_unlocked(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = taipei_challenge, public
as $$
  select exists (
    select 1
    from taipei_challenge.teams t
    where t.id = p_team_id
      and t.locked = false
      and t.submitted_at is null
  );
$$;

create or replace function taipei_challenge.can_access_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = taipei_challenge, public
as $$
  select
    taipei_challenge.is_admin()
    or taipei_challenge.is_teacher()
    or exists (
      select 1
      from taipei_challenge.team_sessions ts
      where ts.team_id = p_team_id
        and ts.auth_user_id = auth.uid()
    );
$$;

create or replace function taipei_challenge.media_team_id_from_path(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_team text;
begin
  v_team := split_part(p_name, '/', 2);
  if v_team ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_team::uuid;
  end if;
  return null;
end;
$$;

create or replace function taipei_challenge.teacher_access_code_matches(p_access_code text)
returns boolean
language sql
stable
security definer
set search_path = taipei_challenge, public, extensions
as $$
  select encode(digest(coalesce(p_access_code, ''), 'sha256'), 'hex')
    = '19d1dd93252b1830c1b3c58fc3ec7c76fcecb2ce84c207f2cfba74af08a7440a';
$$;

create or replace function taipei_challenge.register_teacher(
  p_access_code text,
  p_display_name text
)
returns taipei_challenge.teacher_profiles
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_profile taipei_challenge.teacher_profiles;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not taipei_challenge.teacher_access_code_matches(p_access_code) then
    raise exception 'INVALID_TEACHER_ACCESS_CODE';
  end if;

  v_email := auth.jwt() ->> 'email';

  insert into taipei_challenge.teacher_profiles (auth_user_id, display_name, email, role)
  values (auth.uid(), coalesce(nullif(trim(p_display_name), ''), '未命名教師'), v_email, 'teacher')
  on conflict (auth_user_id)
  do update set
    display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function taipei_challenge.create_team(
  p_activity_id uuid,
  p_team_name text,
  p_passcode text,
  p_members jsonb
)
returns taipei_challenge.teams
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_team taipei_challenge.teams;
  v_member jsonb;
  v_count integer;
  v_team_code text;
  v_activity taipei_challenge.activities;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if trim(coalesce(p_team_name, '')) = '' then
    raise exception 'TEAM_NAME_REQUIRED';
  end if;

  if length(coalesce(p_passcode, '')) < 4 then
    raise exception 'PASSCODE_TOO_SHORT';
  end if;

  select *
  into v_activity
  from taipei_challenge.activities
  where id = p_activity_id
    and status = 'active';

  if v_activity.id is null then
    raise exception 'ACTIVE_ACTIVITY_NOT_FOUND';
  end if;

  if jsonb_typeof(p_members) <> 'array' then
    raise exception 'MEMBERS_MUST_BE_ARRAY';
  end if;

  v_count := coalesce(jsonb_array_length(p_members), 0);
  if v_count < v_activity.min_team_size or v_count > v_activity.max_team_size then
    raise exception 'TEAM_SIZE_OUT_OF_RANGE';
  end if;

  loop
    v_team_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
    exit when not exists (
      select 1 from taipei_challenge.teams where team_code = v_team_code
    );
  end loop;

  insert into taipei_challenge.teams (
    activity_id,
    team_name,
    team_code,
    passcode_plaintext,
    passcode_hash
  )
  values (
    p_activity_id,
    trim(p_team_name),
    v_team_code,
    p_passcode,
    crypt(p_passcode, gen_salt('bf'))
  )
  returning * into v_team;

  for v_member in select * from jsonb_array_elements(p_members)
  loop
    insert into taipei_challenge.team_members (
      team_id,
      class_name,
      seat_number,
      student_name,
      sort_order
    )
    values (
      v_team.id,
      v_member ->> 'class_name',
      v_member ->> 'seat_number',
      coalesce(nullif(v_member ->> 'student_name', ''), '未填姓名'),
      coalesce(nullif(v_member ->> 'sort_order', '')::integer, 1)
    );
  end loop;

  insert into taipei_challenge.team_sessions (team_id, auth_user_id)
  values (v_team.id, auth.uid())
  on conflict (team_id, auth_user_id)
  do update set last_seen_at = now();

  return v_team;
end;
$$;

create or replace function taipei_challenge.login_team(
  p_team_code text,
  p_passcode text
)
returns taipei_challenge.teams
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_team taipei_challenge.teams;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into v_team
  from taipei_challenge.teams
  where upper(team_code) = upper(trim(p_team_code))
     or team_name = trim(p_team_code)
  order by created_at desc
  limit 1;

  if v_team.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if v_team.passcode_hash <> crypt(p_passcode, v_team.passcode_hash) then
    raise exception 'INVALID_PASSCODE';
  end if;

  insert into taipei_challenge.team_sessions (team_id, auth_user_id)
  values (v_team.id, auth.uid())
  on conflict (team_id, auth_user_id)
  do update set last_seen_at = now();

  return v_team;
end;
$$;

create or replace function taipei_challenge.submit_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public
as $$
begin
  if not taipei_challenge.can_access_team(p_team_id) then
    raise exception 'FORBIDDEN';
  end if;

  update taipei_challenge.teams
  set submitted_at = now(),
      locked = true,
      updated_at = now()
  where id = p_team_id;
end;
$$;

create or replace function taipei_challenge.reopen_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public
as $$
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  update taipei_challenge.teams
  set submitted_at = null,
      locked = false,
      updated_at = now()
  where id = p_team_id;

  insert into taipei_challenge.audit_logs (
    actor_auth_user_id,
    actor_role,
    action,
    target_table,
    target_id
  )
  values (
    auth.uid(),
    case when taipei_challenge.is_admin() then 'admin' else 'teacher' end,
    'reopen_team',
    'teams',
    p_team_id
  );
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'taipei_challenge'
      and column_name = 'updated_at'
  loop
    execute format('drop trigger if exists trg_%I_updated_at on taipei_challenge.%I', r.table_name, r.table_name);
    execute format(
      'create trigger trg_%I_updated_at before update on taipei_challenge.%I for each row execute function taipei_challenge.set_updated_at()',
      r.table_name,
      r.table_name
    );
  end loop;
end;
$$;

grant execute on function taipei_challenge.register_teacher(text, text) to authenticated;
grant execute on function taipei_challenge.create_team(uuid, text, text, jsonb) to authenticated;
grant execute on function taipei_challenge.login_team(text, text) to authenticated;
grant execute on function taipei_challenge.submit_team(uuid) to authenticated;
grant execute on function taipei_challenge.reopen_team(uuid) to authenticated;
grant execute on function taipei_challenge.can_access_team(uuid) to authenticated;
grant execute on function taipei_challenge.media_team_id_from_path(text) to authenticated;
grant execute on function taipei_challenge.teacher_access_code_matches(text) to authenticated;
