-- 台北之心闖關網頁
-- Migration 009: individual answer deletion and media review
-- 草案日期：2026-07-11

set search_path = taipei_challenge, public, extensions;

alter table taipei_challenge.media_files
add column if not exists review_status text not null default 'pending';

alter table taipei_challenge.media_files
drop constraint if exists media_files_review_status_check;

alter table taipei_challenge.media_files
add constraint media_files_review_status_check
check (review_status in ('pending', 'approved'));

create or replace function taipei_challenge.approve_media_file(p_media_file_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public
as $$
declare
  v_media taipei_challenge.media_files;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  update taipei_challenge.media_files
  set review_status = 'approved',
      updated_at = now()
  where id = p_media_file_id
    and type = 'photo'
  returning * into v_media;

  if v_media.id is null then
    raise exception 'PHOTO_MEDIA_FILE_NOT_FOUND';
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
    'approve_media_file',
    'media_files',
    p_media_file_id,
    jsonb_build_object('team_id', v_media.team_id, 'mission_id', v_media.mission_id)
  );
end;
$$;

create or replace function taipei_challenge.delete_submission(p_submission_id uuid)
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

  select *
  into v_submission
  from taipei_challenge.submissions
  where id = p_submission_id;

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
    'delete_submission',
    'submissions',
    p_submission_id,
    jsonb_build_object('team_id', v_submission.team_id, 'mission_id', v_submission.mission_id)
  );

  delete from taipei_challenge.submissions
  where id = p_submission_id;
end;
$$;

grant execute on function taipei_challenge.approve_media_file(uuid) to authenticated;
grant execute on function taipei_challenge.delete_submission(uuid) to authenticated;
