-- 台北之心闖關網頁
-- Migration 011: make individual media deletion remove dashboard record reliably
-- 草案日期：2026-07-11

set search_path = taipei_challenge, public, storage;

create or replace function taipei_challenge.delete_media_file(p_media_file_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public, storage
as $$
declare
  v_media taipei_challenge.media_files;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  select *
  into v_media
  from taipei_challenge.media_files
  where id = p_media_file_id;

  if v_media.id is null then
    raise exception 'MEDIA_FILE_NOT_FOUND';
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
    'delete_media_file',
    'media_files',
    p_media_file_id,
    jsonb_build_object(
      'team_id', v_media.team_id,
      'mission_id', v_media.mission_id,
      'type', v_media.type,
      'storage_path', v_media.storage_path
    )
  );

  delete from taipei_challenge.media_files
  where id = p_media_file_id;

  begin
    delete from storage.objects
    where bucket_id = 'taipei-challenge-media'
      and name = v_media.storage_path;
  exception
    when others then
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
        'delete_media_file_storage_cleanup_failed',
        'media_files',
        p_media_file_id,
        jsonb_build_object('storage_path', v_media.storage_path, 'error', sqlerrm)
      );
  end;
end;
$$;

grant execute on function taipei_challenge.delete_media_file(uuid) to authenticated;
