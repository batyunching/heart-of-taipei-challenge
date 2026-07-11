-- 台北之心闖關網頁
-- Migration 005: create private bucket and storage policies
-- 草案日期：2026-07-10

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'taipei-challenge-media',
  'taipei-challenge-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'taipei challenge read own media') then
    create policy "taipei challenge read own media"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'taipei-challenge-media'
      and taipei_challenge.can_access_team(taipei_challenge.media_team_id_from_path(name))
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'taipei challenge upload own unlocked media') then
    create policy "taipei challenge upload own unlocked media"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'taipei-challenge-media'
      and taipei_challenge.can_access_team(taipei_challenge.media_team_id_from_path(name))
      and taipei_challenge.team_is_unlocked(taipei_challenge.media_team_id_from_path(name))
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'taipei challenge update own unlocked media') then
    create policy "taipei challenge update own unlocked media"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'taipei-challenge-media'
      and taipei_challenge.can_access_team(taipei_challenge.media_team_id_from_path(name))
      and taipei_challenge.team_is_unlocked(taipei_challenge.media_team_id_from_path(name))
    )
    with check (
      bucket_id = 'taipei-challenge-media'
      and taipei_challenge.can_access_team(taipei_challenge.media_team_id_from_path(name))
      and taipei_challenge.team_is_unlocked(taipei_challenge.media_team_id_from_path(name))
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'taipei challenge delete own unlocked media') then
    create policy "taipei challenge delete own unlocked media"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'taipei-challenge-media'
      and (
        taipei_challenge.is_admin()
        or (
          taipei_challenge.can_access_team(taipei_challenge.media_team_id_from_path(name))
          and taipei_challenge.team_is_unlocked(taipei_challenge.media_team_id_from_path(name))
        )
      )
    );
  end if;
end;
$$;

