-- Heart of Taipei Challenge
-- Migration 013: scoring items draft
-- Draft date: 2026-07-11
-- Purpose:
--   1. Add item-level scoring records.
--   2. Let teachers approve, reject, or reset each score item.
--   3. Keep scores derived from existing submissions and media files.
--   4. Provide teacher and student score summaries.

set search_path = taipei_challenge, public, extensions;

create table if not exists taipei_challenge.score_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references taipei_challenge.activities(id) on delete cascade,
  team_id uuid not null references taipei_challenge.teams(id) on delete cascade,
  mission_id uuid references taipei_challenge.missions(id) on delete set null,
  source_table text not null,
  source_id uuid not null,
  item_key text not null,
  item_label_zh text not null,
  item_label_en text not null,
  score_type text not null,
  max_score integer not null default 100 check (max_score >= 0),
  awarded_score integer not null default 0 check (awarded_score >= 0),
  review_status text not null default 'pending',
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint score_items_source_table_check
    check (source_table in ('submissions', 'media_files', 'world_friend_records')),
  constraint score_items_score_type_check
    check (score_type in ('text_field', 'word_pair', 'photo', 'audio', 'world_friend')),
  constraint score_items_review_status_check
    check (review_status in ('pending', 'approved', 'rejected')),
  constraint score_items_awarded_score_cap_check
    check (awarded_score <= max_score)
);

create unique index if not exists idx_score_items_unique_item
on taipei_challenge.score_items (
  team_id,
  coalesce(mission_id, '00000000-0000-0000-0000-000000000000'::uuid),
  source_table,
  source_id,
  item_key
);

create index if not exists idx_score_items_team_id
on taipei_challenge.score_items(team_id);

create index if not exists idx_score_items_mission_id
on taipei_challenge.score_items(mission_id);

create index if not exists idx_score_items_review_status
on taipei_challenge.score_items(review_status);

drop trigger if exists trg_score_items_updated_at on taipei_challenge.score_items;
create trigger trg_score_items_updated_at
before update on taipei_challenge.score_items
for each row execute function taipei_challenge.set_updated_at();

alter table taipei_challenge.score_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'taipei_challenge'
      and tablename = 'score_items'
      and policyname = 'users read accessible score items'
  ) then
    create policy "users read accessible score items"
    on taipei_challenge.score_items
    for select
    to authenticated
    using (taipei_challenge.can_access_team(team_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'taipei_challenge'
      and tablename = 'score_items'
      and policyname = 'teachers manage score items'
  ) then
    create policy "teachers manage score items"
    on taipei_challenge.score_items
    for all
    to authenticated
    using (taipei_challenge.is_teacher())
    with check (taipei_challenge.is_teacher());
  end if;
end;
$$;

grant select on taipei_challenge.score_items to authenticated;
grant insert, update, delete on taipei_challenge.score_items to authenticated;

alter table taipei_challenge.media_files
drop constraint if exists media_files_review_status_check;

alter table taipei_challenge.media_files
add constraint media_files_review_status_check
check (review_status in ('pending', 'approved', 'rejected'));

create or replace function taipei_challenge.upsert_score_item(
  p_activity_id uuid,
  p_team_id uuid,
  p_mission_id uuid,
  p_source_table text,
  p_source_id uuid,
  p_item_key text,
  p_item_label_zh text,
  p_item_label_en text,
  p_score_type text,
  p_max_score integer
)
returns taipei_challenge.score_items
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_item taipei_challenge.score_items;
begin
  update taipei_challenge.score_items
  set
    activity_id = p_activity_id,
    item_label_zh = p_item_label_zh,
    item_label_en = p_item_label_en,
    score_type = p_score_type,
    max_score = p_max_score,
    awarded_score = case
      when review_status = 'approved' then p_max_score
      else 0
    end,
    updated_at = now()
  where team_id = p_team_id
    and coalesce(mission_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_mission_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and source_table = p_source_table
    and source_id = p_source_id
    and item_key = p_item_key
  returning * into v_item;

  if v_item.id is not null then
    return v_item;
  end if;

  insert into taipei_challenge.score_items (
    activity_id,
    team_id,
    mission_id,
    source_table,
    source_id,
    item_key,
    item_label_zh,
    item_label_en,
    score_type,
    max_score
  )
  values (
    p_activity_id,
    p_team_id,
    p_mission_id,
    p_source_table,
    p_source_id,
    p_item_key,
    p_item_label_zh,
    p_item_label_en,
    p_score_type,
    p_max_score
  )
  returning * into v_item;

  return v_item;
end;
$$;

create or replace function taipei_challenge.sync_score_items_for_submission(p_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_submission taipei_challenge.submissions;
  v_mission taipei_challenge.missions;
  v_team taipei_challenge.teams;
  v_answer jsonb;
  v_count integer := 0;
  v_value text;
  v_categories text[] := array['regulatory', 'informational', 'safety', 'exhibition'];
  v_category text;
  v_category_label text;
  v_entry jsonb;
  v_index integer;
  v_word text;
  v_chinese text;
  v_sign jsonb;
  v_sign_label text;
  v_country text;
  v_photo_name text;
begin
  select *
  into v_submission
  from taipei_challenge.submissions
  where id = p_submission_id;

  if v_submission.id is null then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  select *
  into v_mission
  from taipei_challenge.missions
  where id = v_submission.mission_id;

  if v_mission.id is null then
    raise exception 'MISSION_NOT_FOUND';
  end if;

  select *
  into v_team
  from taipei_challenge.teams
  where id = v_submission.team_id;

  if v_team.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_answer := coalesce(v_submission.answer_json, '{}'::jsonb);

  delete from taipei_challenge.score_items
  where source_table = 'submissions'
    and source_id = p_submission_id;

  if v_mission.mission_type = 'photo_text' then
    v_value := trim(coalesce(v_answer ->> 'keyword', ''));
    if v_value <> '' then
      perform taipei_challenge.upsert_score_item(
        v_team.activity_id,
        v_submission.team_id,
        v_submission.mission_id,
        'submissions',
        p_submission_id,
        'keyword',
        '核心英文單字',
        'Key English word',
        'text_field',
        100
      );
      v_count := v_count + 1;
    end if;

    v_value := trim(coalesce(v_answer ->> 'sentence', ''));
    if v_value <> '' then
      perform taipei_challenge.upsert_score_item(
        v_team.activity_id,
        v_submission.team_id,
        v_submission.mission_id,
        'submissions',
        p_submission_id,
        'sentence',
        '英文句子',
        'English sentence',
        'text_field',
        100
      );
      v_count := v_count + 1;
    end if;
  elsif v_mission.mission_type = 'info_card' then
    foreach v_category in array v_categories
    loop
      v_category_label := initcap(v_category);
      if v_category = 'informational' then
        v_category_label := 'Informational';
      elsif v_category = 'regulatory' then
        v_category_label := 'Regulatory';
      elsif v_category = 'safety' then
        v_category_label := 'Safety';
      elsif v_category = 'exhibition' then
        v_category_label := 'Exhibition';
      end if;

      v_index := 0;
      for v_entry in
        select value
        from jsonb_array_elements(coalesce(v_answer #> array['museum_categories', v_category], '[]'::jsonb))
      loop
        v_index := v_index + 1;
        exit when v_index > 5;

        v_word := trim(coalesce(v_entry ->> 'word', ''));
        v_chinese := trim(coalesce(v_entry ->> 'chinese', ''));

        if v_word <> '' and v_chinese <> '' then
          perform taipei_challenge.upsert_score_item(
            v_team.activity_id,
            v_submission.team_id,
            v_submission.mission_id,
            'submissions',
            p_submission_id,
            format('museum_%s_%s', v_category, v_index),
            format('%s 第 %s 格英文中文配對', v_category_label, v_index),
            format('%s word pair %s', v_category_label, v_index),
            'word_pair',
            100
          );
          v_count := v_count + 1;
        end if;
      end loop;
    end loop;
  elsif v_mission.mission_type = 'audio' then
    foreach v_category in array array['name', 'type', 'lived', 'ate', 'fact']
    loop
      v_value := trim(coalesce(v_answer #>> array['paleontology', v_category], ''));
      if v_value <> '' then
        perform taipei_challenge.upsert_score_item(
          v_team.activity_id,
          v_submission.team_id,
          v_submission.mission_id,
          'submissions',
          p_submission_id,
          format('paleontology_%s', v_category),
          case v_category
            when 'name' then '名稱'
            when 'type' then '化石或史前動物類型'
            when 'lived' then '生活年代'
            when 'ate' then '食物'
            else '有趣事實'
          end,
          case v_category
            when 'name' then 'Name'
            when 'type' then 'Fossil or prehistoric animal'
            when 'lived' then 'When it lived'
            when 'ate' then 'What it ate'
            else 'Interesting fact'
          end,
          'text_field',
          100
        );
        v_count := v_count + 1;
      end if;
    end loop;
  elsif v_mission.mission_type = 'station_sign' then
    v_index := 0;
    for v_sign in
      select value
      from jsonb_array_elements(coalesce(v_answer -> 'station_signs', '[]'::jsonb))
    loop
      v_index := v_index + 1;
      exit when v_index > 5;

      v_sign_label := coalesce(nullif(trim(v_sign ->> 'purpose'), ''), format('Sign %s', v_index));

      v_value := trim(coalesce(v_sign ->> 'english', ''));
      if v_value <> '' then
        perform taipei_challenge.upsert_score_item(
          v_team.activity_id,
          v_submission.team_id,
          v_submission.mission_id,
          'submissions',
          p_submission_id,
          format('station_sign_%s_english', v_index),
          format('%s 英文標示', v_sign_label),
          format('%s English on the sign', v_sign_label),
          'text_field',
          100
        );
        v_count := v_count + 1;
      end if;

      v_value := trim(coalesce(v_sign ->> 'chinese', ''));
      if v_value <> '' then
        perform taipei_challenge.upsert_score_item(
          v_team.activity_id,
          v_submission.team_id,
          v_submission.mission_id,
          'submissions',
          p_submission_id,
          format('station_sign_%s_chinese', v_index),
          format('%s 中文標示', v_sign_label),
          format('%s Chinese on the sign', v_sign_label),
          'text_field',
          100
        );
        v_count := v_count + 1;
      end if;
    end loop;
  elsif v_mission.mission_type = 'world_friend' then
    v_index := 0;
    for v_entry in
      select value
      from jsonb_array_elements(coalesce(v_answer -> 'world_friends', '[]'::jsonb))
    loop
      v_index := v_index + 1;
      v_country := trim(coalesce(v_entry ->> 'countryText', v_entry ->> 'country_text', ''));
      v_photo_name := trim(coalesce(v_entry ->> 'photoName', v_entry ->> 'photo_name', ''));

      if v_country <> '' and v_photo_name <> '' then
        perform taipei_challenge.upsert_score_item(
          v_team.activity_id,
          v_submission.team_id,
          v_submission.mission_id,
          'submissions',
          p_submission_id,
          format('world_friend_%s', v_index),
          format('外國朋友第 %s 組互動紀錄', v_index),
          format('World friend record %s', v_index),
          'world_friend',
          300
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  return v_count;
end;
$$;

create or replace function taipei_challenge.sync_score_items_for_media_file(p_media_file_id uuid)
returns integer
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_media taipei_challenge.media_files;
  v_mission taipei_challenge.missions;
  v_team taipei_challenge.teams;
  v_item_label_zh text;
  v_item_label_en text;
  v_score_type text;
  v_max_score integer;
begin
  select *
  into v_media
  from taipei_challenge.media_files
  where id = p_media_file_id;

  if v_media.id is null then
    raise exception 'MEDIA_FILE_NOT_FOUND';
  end if;

  select *
  into v_team
  from taipei_challenge.teams
  where id = v_media.team_id;

  if v_team.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  select *
  into v_mission
  from taipei_challenge.missions
  where id = v_media.mission_id;

  delete from taipei_challenge.score_items
  where source_table = 'media_files'
    and source_id = p_media_file_id;

  if v_mission.id is null then
    return 0;
  end if;

  if v_media.type = 'photo' and v_mission.mission_type in ('photo_text', 'station_sign') then
    v_item_label_zh := case
      when v_mission.mission_type = 'station_sign' then '雙語指標照片'
      else '任務照片'
    end;
    v_item_label_en := case
      when v_mission.mission_type = 'station_sign' then 'Bilingual sign photo'
      else 'Mission photo'
    end;
    v_score_type := 'photo';
    v_max_score := 100;
  elsif v_media.type = 'audio' and v_mission.mission_type = 'audio' then
    v_item_label_zh := '古生物英文介紹錄音';
    v_item_label_en := 'Paleontology English recording';
    v_score_type := 'audio';
    v_max_score := 300;
  else
    return 0;
  end if;

  perform taipei_challenge.upsert_score_item(
    v_team.activity_id,
    v_media.team_id,
    v_media.mission_id,
    'media_files',
    p_media_file_id,
    format('%s_%s', v_score_type, p_media_file_id),
    v_item_label_zh,
    v_item_label_en,
    v_score_type,
    v_max_score
  );

  return 1;
end;
$$;

create or replace function taipei_challenge.trg_sync_submission_score_items()
returns trigger
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
begin
  perform taipei_challenge.sync_score_items_for_submission(new.id);
  return new;
end;
$$;

create or replace function taipei_challenge.trg_cleanup_submission_score_items()
returns trigger
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
begin
  delete from taipei_challenge.score_items
  where source_table = 'submissions'
    and source_id = old.id;
  return old;
end;
$$;

create or replace function taipei_challenge.trg_sync_media_score_items()
returns trigger
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
begin
  perform taipei_challenge.sync_score_items_for_media_file(new.id);
  return new;
end;
$$;

create or replace function taipei_challenge.trg_cleanup_media_score_items()
returns trigger
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
begin
  delete from taipei_challenge.score_items
  where source_table = 'media_files'
    and source_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_submissions_sync_score_items on taipei_challenge.submissions;
create trigger trg_submissions_sync_score_items
after insert or update of answer_json, status
on taipei_challenge.submissions
for each row execute function taipei_challenge.trg_sync_submission_score_items();

drop trigger if exists trg_submissions_cleanup_score_items on taipei_challenge.submissions;
create trigger trg_submissions_cleanup_score_items
before delete on taipei_challenge.submissions
for each row execute function taipei_challenge.trg_cleanup_submission_score_items();

drop trigger if exists trg_media_files_sync_score_items on taipei_challenge.media_files;
create trigger trg_media_files_sync_score_items
after insert or update of upload_status, review_status
on taipei_challenge.media_files
for each row execute function taipei_challenge.trg_sync_media_score_items();

drop trigger if exists trg_media_files_cleanup_score_items on taipei_challenge.media_files;
create trigger trg_media_files_cleanup_score_items
before delete on taipei_challenge.media_files
for each row execute function taipei_challenge.trg_cleanup_media_score_items();

create or replace function taipei_challenge.approve_score_item(p_score_item_id uuid)
returns taipei_challenge.score_items
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_item taipei_challenge.score_items;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  update taipei_challenge.score_items
  set review_status = 'approved',
      awarded_score = max_score,
      review_note = null,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_score_item_id
  returning * into v_item;

  if v_item.id is null then
    raise exception 'SCORE_ITEM_NOT_FOUND';
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
    'approve_score_item',
    'score_items',
    p_score_item_id,
    jsonb_build_object('team_id', v_item.team_id, 'mission_id', v_item.mission_id, 'score', v_item.awarded_score)
  );

  return v_item;
end;
$$;

create or replace function taipei_challenge.reject_score_item(
  p_score_item_id uuid,
  p_note text default null
)
returns taipei_challenge.score_items
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_item taipei_challenge.score_items;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  update taipei_challenge.score_items
  set review_status = 'rejected',
      awarded_score = 0,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_score_item_id
  returning * into v_item;

  if v_item.id is null then
    raise exception 'SCORE_ITEM_NOT_FOUND';
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
    'reject_score_item',
    'score_items',
    p_score_item_id,
    jsonb_build_object('team_id', v_item.team_id, 'mission_id', v_item.mission_id, 'note', v_item.review_note)
  );

  return v_item;
end;
$$;

create or replace function taipei_challenge.reset_score_item(p_score_item_id uuid)
returns taipei_challenge.score_items
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_item taipei_challenge.score_items;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  update taipei_challenge.score_items
  set review_status = 'pending',
      awarded_score = 0,
      review_note = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where id = p_score_item_id
  returning * into v_item;

  if v_item.id is null then
    raise exception 'SCORE_ITEM_NOT_FOUND';
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
    'reset_score_item',
    'score_items',
    p_score_item_id,
    jsonb_build_object('team_id', v_item.team_id, 'mission_id', v_item.mission_id)
  );

  return v_item;
end;
$$;

create or replace function taipei_challenge.approve_submission_score_items(p_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_count integer;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  perform taipei_challenge.sync_score_items_for_submission(p_submission_id);

  update taipei_challenge.score_items
  set review_status = 'approved',
      awarded_score = max_score,
      review_note = null,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where source_table = 'submissions'
    and source_id = p_submission_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function taipei_challenge.approve_media_score_item(p_media_file_id uuid)
returns integer
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
as $$
declare
  v_count integer;
begin
  if not taipei_challenge.is_teacher() then
    raise exception 'TEACHER_REQUIRED';
  end if;

  perform taipei_challenge.sync_score_items_for_media_file(p_media_file_id);

  update taipei_challenge.score_items
  set review_status = 'approved',
      awarded_score = max_score,
      review_note = null,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where source_table = 'media_files'
    and source_id = p_media_file_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function taipei_challenge.approve_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
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

  perform taipei_challenge.approve_submission_score_items(p_submission_id);

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

create or replace function taipei_challenge.approve_media_file(p_media_file_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
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
  returning * into v_media;

  if v_media.id is null then
    raise exception 'MEDIA_FILE_NOT_FOUND';
  end if;

  perform taipei_challenge.approve_media_score_item(p_media_file_id);

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
    jsonb_build_object('team_id', v_media.team_id, 'mission_id', v_media.mission_id, 'type', v_media.type)
  );
end;
$$;

create or replace function taipei_challenge.delete_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = taipei_challenge, public, extensions
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

  delete from taipei_challenge.score_items
  where source_table = 'submissions'
    and source_id = p_submission_id;

  delete from taipei_challenge.submissions
  where id = p_submission_id;
end;
$$;

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

  delete from taipei_challenge.score_items
  where source_table = 'media_files'
    and source_id = p_media_file_id;

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

create or replace function taipei_challenge.get_teacher_scoreboard()
returns table (
  team_id uuid,
  team_name text,
  team_code text,
  passcode_plaintext text,
  total_score integer,
  approved_count integer,
  pending_count integer,
  rejected_count integer,
  peace_park_score integer,
  ntm_main_score integer,
  paleontology_score integer,
  taipei_station_score integer,
  world_friend_score integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = taipei_challenge, public
as $$
  select
    t.id as team_id,
    t.team_name,
    t.team_code,
    t.passcode_plaintext,
    coalesce(sum(si.awarded_score), 0)::integer as total_score,
    count(si.id) filter (where si.review_status = 'approved')::integer as approved_count,
    count(si.id) filter (where si.review_status = 'pending')::integer as pending_count,
    count(si.id) filter (where si.review_status = 'rejected')::integer as rejected_count,
    coalesce(sum(si.awarded_score) filter (where m.page_key = 'peace_park'), 0)::integer as peace_park_score,
    coalesce(sum(si.awarded_score) filter (where m.page_key = 'ntm_main'), 0)::integer as ntm_main_score,
    coalesce(sum(si.awarded_score) filter (where m.page_key = 'paleontology'), 0)::integer as paleontology_score,
    coalesce(sum(si.awarded_score) filter (where m.page_key = 'taipei_station'), 0)::integer as taipei_station_score,
    coalesce(sum(si.awarded_score) filter (where m.page_key = 'world_friend'), 0)::integer as world_friend_score,
    greatest(t.updated_at, coalesce(max(si.updated_at), t.updated_at)) as updated_at
  from taipei_challenge.teams t
  left join taipei_challenge.score_items si
    on si.team_id = t.id
  left join taipei_challenge.missions m
    on m.id = si.mission_id
  where taipei_challenge.is_teacher()
  group by t.id, t.team_name, t.team_code, t.passcode_plaintext, t.updated_at
  order by total_score desc, pending_count asc, t.created_at asc;
$$;

create or replace function taipei_challenge.get_team_score_summary(p_team_id uuid)
returns table (
  team_id uuid,
  total_score integer,
  approved_count integer,
  pending_count integer,
  rejected_count integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = taipei_challenge, public
as $$
  select
    t.id as team_id,
    coalesce(sum(si.awarded_score), 0)::integer as total_score,
    count(si.id) filter (where si.review_status = 'approved')::integer as approved_count,
    count(si.id) filter (where si.review_status = 'pending')::integer as pending_count,
    count(si.id) filter (where si.review_status = 'rejected')::integer as rejected_count,
    greatest(t.updated_at, coalesce(max(si.updated_at), t.updated_at)) as updated_at
  from taipei_challenge.teams t
  left join taipei_challenge.score_items si
    on si.team_id = t.id
  where t.id = p_team_id
    and taipei_challenge.can_access_team(t.id)
  group by t.id, t.updated_at;
$$;

revoke execute on function taipei_challenge.upsert_score_item(uuid, uuid, uuid, text, uuid, text, text, text, text, integer) from public;
revoke execute on function taipei_challenge.sync_score_items_for_submission(uuid) from public;
revoke execute on function taipei_challenge.sync_score_items_for_media_file(uuid) from public;
revoke execute on function taipei_challenge.trg_sync_submission_score_items() from public;
revoke execute on function taipei_challenge.trg_cleanup_submission_score_items() from public;
revoke execute on function taipei_challenge.trg_sync_media_score_items() from public;
revoke execute on function taipei_challenge.trg_cleanup_media_score_items() from public;

grant execute on function taipei_challenge.approve_score_item(uuid) to authenticated;
grant execute on function taipei_challenge.reject_score_item(uuid, text) to authenticated;
grant execute on function taipei_challenge.reset_score_item(uuid) to authenticated;
grant execute on function taipei_challenge.approve_submission_score_items(uuid) to authenticated;
grant execute on function taipei_challenge.approve_media_score_item(uuid) to authenticated;
grant execute on function taipei_challenge.approve_submission(uuid) to authenticated;
grant execute on function taipei_challenge.approve_media_file(uuid) to authenticated;
grant execute on function taipei_challenge.delete_submission(uuid) to authenticated;
grant execute on function taipei_challenge.delete_media_file(uuid) to authenticated;
grant execute on function taipei_challenge.get_teacher_scoreboard() to authenticated;
grant execute on function taipei_challenge.get_team_score_summary(uuid) to authenticated;

do $$
declare
  r record;
begin
  for r in select id from taipei_challenge.submissions
  loop
    perform taipei_challenge.sync_score_items_for_submission(r.id);
  end loop;

  for r in select id from taipei_challenge.media_files
  loop
    perform taipei_challenge.sync_score_items_for_media_file(r.id);
  end loop;
end;
$$;
