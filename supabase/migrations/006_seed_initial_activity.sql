-- 台北之心闖關網頁
-- Migration 006: seed initial activity data
-- 草案日期：2026-07-10
-- 注意：預設隊名與通關碼可於執行前修改。

set search_path = taipei_challenge, public, extensions;

insert into taipei_challenge.activities (
  id,
  title_zh,
  title_en,
  date,
  min_team_size,
  max_team_size,
  status
)
values (
  '00000000-0000-0000-0000-000000000101',
  '台北之心・雙語闖關',
  'Heart of Taipei: A Bilingual Field Trip Challenge',
  '2026-07-10',
  3,
  6,
  'active'
)
on conflict (id) do update set
  title_zh = excluded.title_zh,
  title_en = excluded.title_en,
  date = excluded.date,
  min_team_size = excluded.min_team_size,
  max_team_size = excluded.max_team_size,
  status = excluded.status,
  updated_at = now();

insert into taipei_challenge.teams (
  id,
  activity_id,
  team_name,
  team_code,
  passcode_plaintext,
  passcode_hash
)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    '第一組',
    'HEART01',
    '8101',
    crypt('8101', gen_salt('bf'))
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000101',
    '第二組',
    'HEART02',
    '8102',
    crypt('8102', gen_salt('bf'))
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000101',
    '第三組',
    'HEART03',
    '8103',
    crypt('8103', gen_salt('bf'))
  )
on conflict (id) do update set
  team_name = excluded.team_name,
  team_code = excluded.team_code,
  passcode_plaintext = excluded.passcode_plaintext,
  passcode_hash = excluded.passcode_hash,
  updated_at = now();

insert into taipei_challenge.content_pages (
  activity_id,
  page_key,
  title_zh,
  title_en,
  intro_en,
  intro_zh,
  sort_order
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'home',
    '首頁',
    'Home',
    'Taipei is an international city where bilingual signs appear in many public spaces. Today, you will explore the heart of Taipei and learn how English helps people connect across cultures.',
    '臺北是一座國際城市，雙語資訊遍布公共空間。今天你們將探索台北之心，觀察英文如何幫助不同文化的人互相連結。',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'peace_park',
    '二二八和平公園',
    '2/28 Peace Park',
    '2/28 Peace Park is an important public space in Taipei. As you walk through the park, observe how history, memory, and daily life meet in one place.',
    '二二八和平公園是臺北重要的公共空間。走進公園時，請觀察歷史記憶與日常生活如何在同一個場域交會。',
    2
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'ntm_main',
    '臺博館本館',
    'NTM Main Building',
    'The National Taiwan Museum is one of Taiwan''s oldest museums. Its exhibitions help visitors learn about Taiwan through nature, culture, and history.',
    '國立臺灣博物館是臺灣歷史悠久的博物館之一。館內展覽透過自然、文化與歷史，引導參觀者認識臺灣。',
    3
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'paleontology',
    '古生物館',
    'Paleontology Hall',
    'In the Paleontology Hall, you can meet fossils and prehistoric animals. Choose one that interests your team and introduce it in English.',
    '在古生物館中，你可以認識化石與史前動物。請選擇你們小組最感興趣的一項，並用英文介紹它。',
    4
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'taipei_station',
    '臺北車站',
    'Taipei Main Station',
    'Taipei Main Station is a busy transportation hub. Look for English signs and think about how they help travelers move safely and easily.',
    '臺北車站是繁忙的交通樞紐。請尋找英文標示，思考它們如何協助旅客安全、順利地移動。',
    5
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'world_friend',
    '與世界交朋友',
    'Connecting with the World',
    'Use polite English to invite an international visitor for a short interview. If the visitor agrees, ask a few questions and request a group photo.',
    '請用有禮貌的英文邀請外國遊客接受簡短訪談。若對方願意，請詢問幾個問題，並徵詢是否可以合照。',
    6
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'review_submit',
    '成果總覽',
    'Review & Submit',
    'Review your team progress before submitting your final work.',
    '送出成果前，請檢查你們小組的完成狀態。',
    7
  )
on conflict (activity_id, page_key) do update set
  title_zh = excluded.title_zh,
  title_en = excluded.title_en,
  intro_en = excluded.intro_en,
  intro_zh = excluded.intro_zh,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into taipei_challenge.missions (
  activity_id,
  page_key,
  mission_type,
  name_zh,
  name_en,
  intro_en,
  intro_zh,
  suggested_keywords,
  required_media,
  sort_order
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'peace_park',
    'photo_text',
    '和平公園景點任務 1',
    'Peace Park Spot Mission 1',
    'Take one photo, write one key English word, and write one English sentence about this spot.',
    '拍一張照片，寫一個核心英文單字，並用英文寫一句對這個景點的觀察。',
    array['history', 'memory', 'park'],
    'photo',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'peace_park',
    'photo_text',
    '和平公園景點任務 2',
    'Peace Park Spot Mission 2',
    'Find another meaningful place in the park. Take a photo and write one English observation.',
    '在公園中尋找另一個有意義的地點，拍照並寫下一句英文觀察。',
    array['monument', 'public', 'city'],
    'photo',
    2
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'peace_park',
    'photo_text',
    '和平公園景點任務 3',
    'Peace Park Spot Mission 3',
    'Choose a final spot and explain what your team noticed in English.',
    '選擇最後一個景點，並用英文說明你們小組觀察到什麼。',
    array['peace', 'observe', 'reflection'],
    'photo',
    3
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'ntm_main',
    'photo_text',
    '一樓指定文物',
    '1F Featured Object',
    'Observe the featured object on the first floor. Take a photo, write a keyword, and write one English sentence.',
    '觀察一樓指定文物，拍照、寫一個關鍵字，並完成一句英文觀察。',
    array['museum', 'object', 'exhibition'],
    'photo',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'ntm_main',
    'photo_text',
    '二樓指定文物',
    '2F Featured Object',
    'Observe the featured object on the second floor and record your finding in English.',
    '觀察二樓指定文物，並用英文記錄你們的發現。',
    array['display', 'collection', 'culture'],
    'photo',
    2
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'ntm_main',
    'photo_text',
    '三樓指定文物',
    '3F Featured Object',
    'Observe the featured object on the third floor and write one English response.',
    '觀察三樓指定文物，並寫下一句英文回應。',
    array['history', 'visitor', 'learn'],
    'photo',
    3
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'ntm_main',
    'info_card',
    '博物館英文分類卡',
    'Museum English Category Cards',
    'Explore museum English in four categories: Regulatory, Informational, Safety, and Exhibition.',
    '探索四類博物館英文：規範、資訊、安全與展覽。',
    array['Regulatory', 'Informational', 'Safety', 'Exhibition'],
    'none',
    4
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'paleontology',
    'audio',
    '古生物英文介紹',
    'Paleontology English Recording',
    'Choose your favorite fossil or prehistoric animal. Complete five fields and record your English introduction.',
    '選擇最喜歡的化石或史前動物，完成五個欄位，並錄製英文介紹。',
    array['fossil', 'prehistoric', 'animal'],
    'audio',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'taipei_station',
    'station_sign',
    '臺北車站英文標示探索',
    'Taipei Main Station English Sign Hunt',
    'Find at least six English signs. Record the English, Chinese, purpose, and location.',
    '尋找至少六個英文標示，記錄英文、中文、用途與位置。',
    array['Transportation', 'Direction', 'Service', 'Safety'],
    'photo',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'world_friend',
    'world_friend',
    '與世界交朋友',
    'Connecting with the World',
    'Use the bilingual interview prompts, complete a short interview, ask for a photo, and enter the visitor''s country.',
    '使用中英訪談句型，完成簡短訪談，徵詢合照，並填寫外國朋友的國家。',
    array['interview', 'country', 'photo'],
    'photo',
    1
  )
on conflict (activity_id, page_key, sort_order) do update set
  mission_type = excluded.mission_type,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  intro_en = excluded.intro_en,
  intro_zh = excluded.intro_zh,
  suggested_keywords = excluded.suggested_keywords,
  required_media = excluded.required_media,
  updated_at = now();
