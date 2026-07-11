-- 台北之心闖關網頁
-- Migration 008: teacher review and team data deletion
-- 草案日期：2026-07-11

set search_path = taipei_challenge, public, extensions;

alter table taipei_challenge.submissions
drop constraint if exists submissions_status_check;

alter table taipei_challenge.submissions
add constraint submissions_status_check
check (status in ('draft', 'synced', 'completed', 'approved'));

create or replace function taipei_challenge.protect_submission_approval_status()
returns trigger
language plpgsql
security definer
set search_path = taipei_challenge, public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'approved' and not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED_FOR_APPROVAL';
  end if;

  if tg_op = 'UPDATE' and not taipei_challenge.is_teacher() then
    if old.status = 'approved' then
      new.status := 'approved';
    elsif new.status = 'approved' then
      raise exception 'TEACHER_REQUIRED_FOR_APPROVAL';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_submissions_protect_approval on taipei_challenge.submissions;
create trigger trg_submissions_protect_approval
before insert or update on taipei_challenge.submissions
for each row execute function taipei_challenge.protect_submission_approval_status();

create or replace function taipei_challenge.approve_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public
as $$
declare
  v_submission taipei_challenge.submissions;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  update taipei_challenge.submissions
  set status = 'approved',
      updated_at = now()
  where id = p_submission_id
  returning * into v_submission;

  if v_submission.id is null then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  insert into taipei_challenge.audit_logs (
    actor_auth_user_id,
    actor_role,
    action,
    target_table,
    target_id,
    details
  )
  values (
    auth.uid(),
    case when taipei_challenge.is_admin() then 'admin' else 'teacher' end,
    'approve_submission',
    'submissions',
    p_submission_id,
    jsonb_build_object('team_id', v_submission.team_id, 'mission_id', v_submission.mission_id)
  );
end;
$$;

create or replace function taipei_challenge.delete_team_data(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public, storage
as $$
declare
  v_team_name text;
  v_team_code text;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  select team_name, team_code
  into v_team_name, v_team_code
  from taipei_challenge.teams
  where id = p_team_id;

  if v_team_name is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  delete from storage.objects
  where bucket_id = 'taipei-challenge-media'
    and name in (
      select storage_path
      from taipei_challenge.media_files
      where team_id = p_team_id
    );

  insert into taipei_challenge.audit_logs (
    actor_auth_user_id,
    actor_role,
    action,
    target_table,
    target_id,
    details
  )
  values (
    auth.uid(),
    case when taipei_challenge.is_admin() then 'admin' else 'teacher' end,
    'delete_team_data',
    'teams',
    p_team_id,
    jsonb_build_object('team_name', v_team_name, 'team_code', v_team_code)
  );

  delete from taipei_challenge.teams
  where id = p_team_id;
end;
$$;

grant execute on function taipei_challenge.approve_submission(uuid) to authenticated;
grant execute on function taipei_challenge.delete_team_data(uuid) to authenticated;
