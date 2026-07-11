-- 台北之心闖關網頁
-- Migration 001: create schema and base grants
-- 草案日期：2026-07-10
-- 注意：執行前請先確認不影響既有 Supabase Project。

create schema if not exists taipei_challenge;

create extension if not exists pgcrypto with schema extensions;

grant usage on schema taipei_challenge to anon, authenticated, service_role;

alter default privileges in schema taipei_challenge
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema taipei_challenge
grant select on tables to anon;

alter default privileges in schema taipei_challenge
grant usage, select on sequences to authenticated;

comment on schema taipei_challenge is
'台北之心・雙語闖關互動網站專用 schema。不得與既有 public schema 混用。';

