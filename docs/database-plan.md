# 台北之心闖關網頁：Database Plan

版本日期：2026-07-10

本文件整理 Supabase 資料庫實作草案。此階段僅供審核，尚未執行 SQL。

## 1. 基本原則

- 使用既有 Supabase Project：`batyunching's Org / batyunching's project`。
- 新增自訂 schema：`taipei_challenge`。
- 不修改、刪除、重新命名或覆寫既有 `public` schema 內任何物件。
- 前端所有資料查詢必須使用 `supabase.schema("taipei_challenge")`。
- 所有業務資料表均啟用 Row Level Security。
- 前端只使用 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。
- `service_role key` 不得放入 GitHub、GitHub Pages 或前端程式碼。

## 2. 預計新增物件

| 類型 | 名稱 |
|---|---|
| schema | `taipei_challenge` |
| extension | `pgcrypto`，若已存在則沿用 |
| tables | `activities`、`teacher_profiles`、`teams`、`team_members`、`team_sessions`、`content_pages`、`missions`、`submissions`、`world_friend_records`、`media_files`、`audit_logs` |
| functions | 權限判斷、小組登入、教師註冊、送出、退回補件、更新時間 |
| triggers | 各主要資料表 `updated_at` 自動更新 |
| storage bucket | `taipei-challenge-media` |

## 3. 資料表關聯摘要

| 主表 | 關聯表 | 關聯 |
|---|---|---|
| `activities` | `teams` | 一個活動有多個小組 |
| `activities` | `content_pages` | 一個活動有多個頁面介紹 |
| `activities` | `missions` | 一個活動有多個任務 |
| `teacher_profiles` | `teams` | 一位老師可被分派多個小組 |
| `teams` | `team_members` | 一個小組有 3 至 6 位組員 |
| `teams` | `team_sessions` | 一個小組可被多個登入 session 綁定 |
| `teams` | `submissions` | 一個小組有多筆任務作答 |
| `teams` | `world_friend_records` | 一個小組可有一筆或多筆外國朋友訪談紀錄 |
| `teams` | `media_files` | 一個小組可有多筆照片或錄音 |
| `missions` | `submissions` | 一個任務可對應多組作答 |
| `media_files` | `world_friend_records` | 合照以媒體檔 ID 關聯 |

## 4. 資料表重點欄位

### `teams`

- `team_name`：隊名。
- `team_code`：隊伍代碼，供登入與 QR Code 使用。
- `passcode_plaintext`：通關碼明文，供教師後台協助學生。
- `passcode_hash`：通關碼雜湊，供登入驗證。
- `submitted_at`、`locked`：控制成果送出後是否唯讀。

### `world_friend_records`

第 6 頁「與世界交朋友」最新版本只保存：

- 外國朋友國家：`country_text`，自由輸入。
- 是否完成訪談：`interview_completed`。
- 合照媒體：`photo_media_id`。

不建立姓名、電話、Email、社群帳號等欄位。

### `media_files`

紀錄照片、錄音與合照的 Storage 路徑、檔案大小、媒體類型與上傳狀態。

## 5. 建議索引

| 資料表 | 索引 |
|---|---|
| `teams` | `activity_id`、`team_code`、`assigned_teacher_id` |
| `team_sessions` | `team_id`、`auth_user_id` |
| `team_members` | `team_id` |
| `content_pages` | `activity_id`、`page_key` |
| `missions` | `activity_id`、`page_key` |
| `submissions` | `team_id`、`mission_id` |
| `world_friend_records` | `team_id` |
| `media_files` | `team_id`、`mission_id`、`submission_id` |
| `audit_logs` | `actor_auth_user_id`、`target_table`、`target_id` |

## 6. Seed Data

初版 seed data 會建立：

- 1 筆活動：`台北之心・雙語闖關`。
- 預設 3 組隊伍：可於 SQL 草案中調整隊名與通關碼。
- 首頁、二二八和平公園、臺博館本館、古生物館、臺北車站、與世界交朋友、成果總覽。
- 二二八和平公園 3 個景點任務。
- 臺博館本館 1F、2F、3F 任務。
- 古生物館五題問答與錄音任務。
- 臺北車站英文標示探索任務。
- 與世界交朋友訪談句型與合照任務。

## 7. 執行前必要設定

Supabase 後端建立前，需先確認：

- Supabase Auth 已允許 anonymous sign-ins，供學生小組免 Email 使用。
- `taipei_challenge` 會加入 Exposed schemas。
- 教師共用入口密碼 `tkjhs810` 不放入前端環境變數；資料庫 function 使用雜湊比對。
- GitHub 與 GitHub Pages 不保存 `service_role key`。

## 8. 對既有系統影響

預期不影響既有系統，因為：

- 所有業務資料表均建立於 `taipei_challenge` schema。
- 不修改 `public` schema。
- Storage 使用獨立 bucket：`taipei-challenge-media`。
- rollback 只移除本系統新增物件。
