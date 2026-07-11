# Supabase 後端執行前最終檢查報告

版本日期：2026-07-11

本文件記錄執行 Supabase SQL 前的最終檢查結果。檢查範圍包含 schema、資料表、functions、RLS policies、Storage policies、seed data 與 rollback。此階段尚未執行任何 Supabase SQL。

## 1. 檢查結論

目前 SQL 草案已完成最終檢查與必要修正。

建議狀態：可進入「建立 Supabase 後端」前的人工確認階段。

也就是：

1. 先由使用者確認本報告。
2. 再確認 Supabase 專案設定。
3. 確認後才依序執行 migration SQL。

## 2. 已確認安全項目

| 項目 | 檢查結果 |
|---|---|
| 不修改既有 `public` schema | 通過。所有業務資料表建立於 `taipei_challenge` schema |
| 不建立新的 Supabase Project | 通過。SQL 未包含建立 Project 的內容 |
| 所有業務表啟用 RLS | 通過。`004_create_rls_policies.sql` 已對 11 張表啟用 RLS |
| Storage bucket 獨立 | 通過。只建立 `taipei-challenge-media` |
| Storage bucket private | 通過。`public = false` |
| 不在前端使用 service role key | 通過。前端 `.env.example` 只包含 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY` |
| seed data 可重複執行 | 通過。活動、隊伍、頁面、任務均使用 `ON CONFLICT` |
| rollback 限制在本系統 | 通過。rollback 只刪除 `taipei_challenge` 與 `taipei-challenge-media` |

## 3. 已修正項目

### 3.1 教師入口密碼不再於 function 中明文判斷

原草案中 `register_teacher()` 直接比較：

```sql
p_access_code <> 'tkjhs810'
```

已修正為：

- 新增 `teacher_access_code_matches()`。
- 使用 SHA-256 雜湊比對。
- SQL function 不再直接以明文條件判斷入口密碼。

說明：文件仍會寫明現場共用入口密碼為 `tkjhs810`，但 migration function 使用雜湊檢查，降低 SQL 外洩時的明文暴露。

### 3.2 教師姓名空白不會造成註冊失敗

原草案中若教師註冊時姓名空白，`display_name` 可能變成 `null`，但資料表欄位為 `not null`。

已修正為：

```sql
coalesce(nullif(trim(p_display_name), ''), '未命名教師')
```

### 3.3 學生建立隊伍時會檢查活動狀態

原草案允許對任意 `activity_id` 建立小組。

已修正為：

- `create_team()` 只允許對 `status = 'active'` 的活動建立隊伍。
- 若找不到 active activity，回傳 `ACTIVE_ACTIVITY_NOT_FOUND`。

### 3.4 小組人數改依活動設定檢查

原草案固定檢查 3 至 6 人。

已修正為：

- 讀取 `activities.min_team_size` 與 `activities.max_team_size`。
- 依活動設定檢查小組人數。

### 3.5 組員 JSON 格式檢查

原草案直接對 `p_members` 執行 `jsonb_array_length()`。

已修正為：

- 先確認 `jsonb_typeof(p_members) = 'array'`。
- 否則回傳 `MEMBERS_MUST_BE_ARRAY`。

### 3.6 組員排序欄位更穩定

原草案若 `sort_order` 傳入空字串，可能造成型別轉換錯誤。

已修正為：

```sql
coalesce(nullif(v_member ->> 'sort_order', '')::integer, 1)
```

## 4. RLS 檢查結果

### 4.1 學生權限

學生透過 `team_sessions.auth_user_id = auth.uid()` 綁定小組。

檢查結果：

- 學生只能讀寫自己小組的 `teams`、`team_members`、`submissions`、`world_friend_records`、`media_files`。
- 小組送出並鎖定後，學生不可再更新作答與媒體紀錄。
- 學生不能讀取其他小組資料。

### 4.2 教師權限

目前草案讓教師可查看活動中的小組與成果，以符合營隊現場互相支援需求。

檢查結果：

- 教師可查看隊名與通關碼明文。
- 教師可查看學生文字作答、媒體紀錄與第 6 頁合照紀錄。
- 教師可退回補件。
- 一般教師不可讀取 `audit_logs`，管理者可讀取。

### 4.3 管理者權限

管理者可管理 `taipei_challenge` schema 內本系統資料。

檢查結果：

- 管理者不會取得修改既有 `public` schema 的特殊設定。
- 管理者可管理活動、任務、隊伍與教師角色。

## 5. Storage Policies 檢查結果

Storage bucket：

```text
taipei-challenge-media
```

路徑格式：

```text
activity-id/team-id/mission-id/file-uuid.ext
```

檢查結果：

- policies 限制 `bucket_id = 'taipei-challenge-media'`。
- 透過路徑第二層解析 `team_id`。
- 讀取、上傳、更新、刪除均搭配 `can_access_team(team_id)`。
- 學生只能管理自己小組且尚未鎖定的媒體。
- 管理者可刪除錯誤媒體。

## 6. Seed Data 檢查結果

已確認 seed data 使用固定 UUID 與 `ON CONFLICT`。

可重複執行項目：

- 活動資料。
- 預設 3 組隊伍。
- 頁面介紹。
- 任務資料。

注意：預設 3 組通關碼仍以明文保存在 `teams.passcode_plaintext`，這是依照教師現場協助需求設計；登入驗證使用 `passcode_hash`。

## 7. Rollback 檢查結果

rollback 草案會移除：

- Storage policies。
- `taipei-challenge-media` bucket 內 objects。
- `taipei-challenge-media` bucket。
- `taipei_challenge` schema。

不會移除：

- 既有 `public` schema。
- 既有 Supabase Auth 使用者。
- 其他網站既有 Storage bucket。

高風險提醒：刪除 bucket 會刪除學生照片與錄音，正式 rollback 前需再次確認。

## 8. 執行前仍需人工確認

在實際執行 SQL 前，仍需確認 Supabase 後台設定：

1. 已啟用或允許 anonymous sign-ins，供學生小組免 Email 使用。
2. 執行 SQL 後，將 `taipei_challenge` 加入 Exposed schemas。
3. GitHub Pages 網址確定後，加入 Supabase Auth Redirect URLs。
4. 確認前端只使用 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。
5. 確認不把 `service_role key` 放入 GitHub 或前端。
6. 已確認接受「一般教師可查看本活動全部小組」的現場支援設計，因此初版不限制教師只能查看 `assigned_teacher_id` 指派小組。

## 9. 建議執行順序

確認本報告後，建議依序執行：

1. `001_create_taipei_challenge_schema.sql`
2. `002_create_tables.sql`
3. `003_create_functions.sql`
4. `004_create_rls_policies.sql`
5. `005_create_storage_policies.sql`
6. `006_seed_initial_activity.sql`

執行後再做：

1. Supabase Exposed schemas 設定。
2. Anonymous Auth 設定確認。
3. Storage bucket private 狀態確認。
4. 使用測試教師帳號註冊。
5. 使用測試小組建立與登入。
6. 測試學生是否無法讀取其他小組。
7. 測試教師是否可查看隊伍、通關碼與成果。

## 10. 最終建議

SQL 草案經修正後，已可進入「建立 Supabase 後端」的確認階段。

建議不要直接一次貼上全部 SQL，而是依 migration 編號逐一執行，方便定位錯誤與回復。
