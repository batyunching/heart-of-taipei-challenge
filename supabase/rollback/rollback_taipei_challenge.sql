-- 台北之心闖關網頁
-- Rollback 草案
-- 草案日期：2026-07-10
--
-- 高風險提醒：
-- 1. 本檔會刪除 taipei_challenge schema 及其中所有資料。
-- 2. 本檔會刪除 taipei-challenge-media bucket 內所有 objects。
-- 3. 執行前務必再次確認已備份需要保留的學生成果、照片與錄音。
-- 4. 本檔不會刪除既有 public schema，也不會刪除 Supabase Auth 使用者。

begin;

drop policy if exists "taipei challenge read own media" on storage.objects;
drop policy if exists "taipei challenge upload own unlocked media" on storage.objects;
drop policy if exists "taipei challenge update own unlocked media" on storage.objects;
drop policy if exists "taipei challenge delete own unlocked media" on storage.objects;

-- 高風險：刪除本系統 bucket 內所有檔案。
delete from storage.objects
where bucket_id = 'taipei-challenge-media';

-- 高風險：刪除本系統 private bucket。
delete from storage.buckets
where id = 'taipei-challenge-media';

drop schema if exists taipei_challenge cascade;

commit;

