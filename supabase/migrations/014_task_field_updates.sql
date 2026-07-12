-- 台北之心闖關網頁
-- Migration 014: task field updates for museum, paleontology, and station signs
-- 草案日期：2026-07-12
-- 說明：
-- 1. 博物館英文分類卡改為每類最多 3 組英文／中文得分。
-- 2. 古生物英文介紹支援第 2 隻古生物的 5 個文字欄位得分。
-- 3. 古生物任務新增合照照片，照片審核後可得到 100 分。

create or replace function taipei_challenge.sync_score_items_for_submission(p_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path = taipei_challenge, public
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
  v_key text;
  v_animal_index integer;
begin
  select * into v_submission
  from taipei_challenge.submissions
  where id = p_submission_id;

  if v_submission.id is null then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  select * into v_mission
  from taipei_challenge.missions
  where id = v_submission.mission_id;

  if v_mission.id is null then
    raise exception 'MISSION_NOT_FOUND';
  end if;

  select * into v_team
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
        v_team.activity_id, v_submission.team_id, v_submission.mission_id,
        'submissions', p_submission_id, 'keyword',
        '核心英文單字', 'Key English word', 'text_field', 100
      );
      v_count := v_count + 1;
    end if;

    v_value := trim(coalesce(v_answer ->> 'sentence', ''));
    if v_value <> '' then
      perform taipei_challenge.upsert_score_item(
        v_team.activity_id, v_submission.team_id, v_submission.mission_id,
        'submissions', p_submission_id, 'sentence',
        '英文句子', 'English sentence', 'text_field', 100
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
        exit when v_index > 3;

        v_word := trim(coalesce(v_entry ->> 'word', ''));
        v_chinese := trim(coalesce(v_entry ->> 'chinese', ''));

        if v_word <> '' and v_chinese <> '' then
          perform taipei_challenge.upsert_score_item(
            v_team.activity_id, v_submission.team_id, v_submission.mission_id,
            'submissions', p_submission_id, format('museum_%s_%s', v_category, v_index),
            format('%s 第 %s 組英文與中文', v_category_label, v_index),
            format('%s word pair %s', v_category_label, v_index),
            'word_pair', 100
          );
          v_count := v_count + 1;
        end if;
      end loop;
    end loop;

  elsif v_mission.mission_type = 'audio' then
    for v_animal_index in 1..2 loop
      foreach v_category in array array['name', 'type', 'lived', 'ate', 'fact']
      loop
        v_key := case when v_animal_index = 1 then v_category else format('%s2', v_category) end;
        v_value := trim(coalesce(v_answer #>> array['paleontology', v_key], ''));

        if v_value <> '' then
          perform taipei_challenge.upsert_score_item(
            v_team.activity_id, v_submission.team_id, v_submission.mission_id,
            'submissions', p_submission_id, format('paleontology_%s', v_key),
            format('古生物 %s：%s', v_animal_index,
              case v_category
                when 'name' then '名稱'
                when 'type' then '化石或史前動物'
                when 'lived' then '生活年代'
                when 'ate' then '吃什麼'
                else '有趣的事實'
              end
            ),
            format('Paleontology animal %s %s', v_animal_index, v_category),
            'text_field', 100
          );
          v_count := v_count + 1;
        end if;
      end loop;
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
          v_team.activity_id, v_submission.team_id, v_submission.mission_id,
          'submissions', p_submission_id, format('station_%s_english', v_index),
          format('%s 英文', v_sign_label), format('%s English', v_sign_label), 'text_field', 100
        );
        v_count := v_count + 1;
      end if;

      v_value := trim(coalesce(v_sign ->> 'chinese', ''));
      if v_value <> '' then
        perform taipei_challenge.upsert_score_item(
          v_team.activity_id, v_submission.team_id, v_submission.mission_id,
          'submissions', p_submission_id, format('station_%s_chinese', v_index),
          format('%s 中文意思', v_sign_label), format('%s Chinese meaning', v_sign_label), 'text_field', 100
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
          v_team.activity_id, v_submission.team_id, v_submission.mission_id,
          'world_friend_records', p_submission_id, format('world_friend_%s', v_index),
          format('外國朋友第 %s 組', v_index), format('World friend group %s', v_index),
          'world_friend', 300
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
set search_path = taipei_challenge, public
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
  select * into v_media
  from taipei_challenge.media_files
  where id = p_media_file_id;

  if v_media.id is null then
    raise exception 'MEDIA_FILE_NOT_FOUND';
  end if;

  select * into v_mission
  from taipei_challenge.missions
  where id = v_media.mission_id;

  select * into v_team
  from taipei_challenge.teams
  where id = v_media.team_id;

  delete from taipei_challenge.score_items
  where source_table = 'media_files'
    and source_id = p_media_file_id;

  if v_mission.id is null then
    return 0;
  end if;

  if v_media.type = 'photo' and v_mission.mission_type in ('photo_text', 'station_sign', 'audio') then
    v_item_label_zh := case
      when v_mission.mission_type = 'station_sign' then '雙語標示照片'
      when v_mission.mission_type = 'audio' then '古生物合照照片'
      else '任務照片'
    end;
    v_item_label_en := case
      when v_mission.mission_type = 'station_sign' then 'Bilingual sign photo'
      when v_mission.mission_type = 'audio' then 'Paleontology group photo'
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

grant execute on function taipei_challenge.sync_score_items_for_submission(uuid) to authenticated;
grant execute on function taipei_challenge.sync_score_items_for_media_file(uuid) to authenticated;

-- Re-sync existing data after the scoring rules change.
do $$
declare
  r record;
begin
  for r in select id from taipei_challenge.submissions loop
    perform taipei_challenge.sync_score_items_for_submission(r.id);
  end loop;

  for r in select id from taipei_challenge.media_files loop
    perform taipei_challenge.sync_score_items_for_media_file(r.id);
  end loop;
end;
$$;
