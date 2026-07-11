# 台北之心闖關網頁：RLS Plan

版本日期：2026-07-10

本文件整理 Row Level Security 實作草案。此階段僅供審核，尚未執行 SQL。

## 1. 權限角色

| 角色 | 說明 |
|---|---|
| 學生小組 | 不使用 Email，以 anonymous user session 搭配隊伍通關碼綁定小組 |
| 教師 | 使用 Supabase Auth，註冊時輸入共用入口密碼 `tkjhs810`；SQL 中以 SHA-256 雜湊比對，不直接用明文判斷 |
| 管理者 | 使用 Supabase Auth，角色為 `admin` |

## 2. 核心判斷函式

| 函式 | 用途 |
|---|---|
| `is_teacher()` | 判斷目前 `auth.uid()` 是否為教師或管理者 |
| `is_admin()` | 判斷目前 `auth.uid()` 是否為管理者 |
| `can_access_team(team_id)` | 判斷目前使用者是否可讀取某小組 |
| `team_is_unlocked(team_id)` | 判斷小組是否尚未送出鎖定 |

## 3. 學生小組權限

學生只能存取已透過 `team_sessions` 綁定的小組。

| 資料表 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `activities` | 可讀取 active 活動 | 不可 | 不可 | 不可 |
| `content_pages` | 可讀取 active 活動頁面 | 不可 | 不可 | 不可 |
| `missions` | 可讀取 active 活動任務 | 不可 | 不可 | 不可 |
| `teams` | 只看自己小組 | 透過 function 建立 | 未鎖定時可更新自己小組部分資料 | 不可 |
| `team_members` | 只看自己小組 | 未鎖定時可新增 | 未鎖定時可更新 | 未鎖定時可刪除 |
| `submissions` | 只看自己小組 | 未鎖定時可新增 | 未鎖定時可更新 | 未鎖定時可刪除 |
| `world_friend_records` | 只看自己小組 | 未鎖定時可新增 | 未鎖定時可更新 | 未鎖定時可刪除 |
| `media_files` | 只看自己小組 | 未鎖定時可新增 | 未鎖定時可更新 | 未鎖定時可刪除 |

## 4. 教師權限

初版已確認採用「一般教師可查看本活動全部隊伍」的現場支援設計，方便老師在活動中互相支援。若後續要縮小權限，可再改為只看 `assigned_teacher_id` 指派的小組。

| 資料表 | 教師權限 |
|---|---|
| `activities` | 可讀取 |
| `content_pages` | 可讀取 |
| `missions` | 可讀取 |
| `teams` | 可讀取隊名、通關碼明文、進度與鎖定狀態 |
| `team_members` | 可讀取 |
| `submissions` | 可讀取 |
| `world_friend_records` | 可讀取國家與合照紀錄 |
| `media_files` | 可讀取媒體紀錄 |
| `audit_logs` | 一般教師不可直接讀取 |

教師可透過 `reopen_team(team_id)` 退回補件。

## 5. 管理者權限

管理者可管理 `taipei_challenge` schema 內本系統資料，包含：

- 活動管理。
- 頁面與任務內容管理。
- 隊伍管理。
- 教師角色管理。
- 成果檢視。
- 退回補件。
- 匯出紀錄。

管理者仍不會取得修改既有 `public` schema 的特殊權限。

## 6. 重要安全限制

- 所有資料表啟用 RLS。
- 不建立 `anon` 全表讀寫政策。
- 學生送出成果後，學生端不得更新或刪除資料。
- 教師後台入口密碼 `tkjhs810` 只作為入口門檻，不能替代 RLS；migration function 使用雜湊比對，避免在 SQL 判斷式中保存明文密碼。
- 教師可看通關碼明文是基於現場協助需求，登入驗證仍使用雜湊。
