-- Heart of Taipei Challenge
-- Migration 012: make whole team deletion reliable
-- Draft date: 2026-07-11

set search_path = taipei_challenge, public, storage;

create or replace function taipei_challenge.delete_team_data(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public, storage
as $$
declare
  v_team_name text;
  v_team_code text;
  v_storage_paths text[];
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

  select coalesce(array_agg(storage_path), array[]::text[])
  into v_storage_paths
  from taipei_challenge.media_files
  where team_id = p_team_id;

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
    jsonb_build_object(
      'team_name', v_team_name,
      'team_code', v_team_code,
      'media_file_count', coalesce(array_length(v_storage_paths, 1), 0)
    )
  );

  delete from taipei_challenge.teams
  where id = p_team_id;

  begin
    if coalesce(array_length(v_storage_paths, 1), 0) > 0 then
      delete from storage.objects
      where bucket_id = 'taipei-challenge-media'
        and name = any(v_storage_paths);
    end if;
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
        'delete_team_data_storage_cleanup_failed',
        'teams',
        p_team_id,
        jsonb_build_object(
          'team_name', v_team_name,
          'team_code', v_team_code,
          'storage_paths', v_storage_paths,
          'error', sqlerrm
        )
      );
  end;
end;
$$;

grant execute on function taipei_challenge.delete_team_data(uuid) to authenticated;
