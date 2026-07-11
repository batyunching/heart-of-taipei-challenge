# 013_scoring_items.sql 執行前安全檢查

檢查日期：2026-07-11

## 檢查結論

`013_scoring_items.sql` 可以進入 Supabase 執行前準備。此 migration 的主要作用是新增「得分項目」資料表與評分彙總函式，並把既有審核、刪除流程同步到分數紀錄。

本次檢查沒有發現會主動清空既有小組、既有作答、既有照片或既有錄音的語句。

## 會新增的內容

1. 新增 `taipei_challenge.score_items` 資料表。
2. 新增得分項目同步函式。
3. 新增教師可用的單項通過、退回、重設評分函式。
4. 新增教師後台得分彙總函式 `get_teacher_scoreboard()`。
5. 新增學生端小組得分彙總函式 `get_team_score_summary(team_id)`。
6. 新增 trigger，讓作答或媒體檔案更新時，自動整理對應得分項目。

## 會調整的既有內容

1. `media_files.review_status` 檢查條件從 `pending`、`approved` 擴充為 `pending`、`approved`、`rejected`。
2. 重新定義 `approve_submission()`，保留原本審核作答功能，並同步把該作答產生的得分項目標為通過。
3. 重新定義 `approve_media_file()`，保留原本審核媒體功能，並同步把該媒體得分項目標為通過。
4. 重新定義 `delete_submission()`，保留原本刪除個別作答功能，並同步刪除該作答的得分項目。
5. 重新定義 `delete_media_file()`，保留原本刪除個別媒體功能，並同步刪除該媒體的得分項目。

## 不會更動的內容

1. 不會刪除 `teams`。
2. 不會刪除全部 `submissions`。
3. 不會刪除全部 `media_files`。
4. 不會刪除 `activities`、`missions`、`content_pages`。
5. 不會改寫 `delete_team_data()`，所以 012 已修復的整組刪除流程會保留。
6. 不會改變 Storage bucket 或既有檔案路徑。

## 權限安全檢查

1. `score_items` 已啟用 RLS。
2. 學生只能讀取自己小組可存取的分數資料。
3. 只有教師可以新增、修改、刪除得分項目。
4. 內部同步函式已撤銷 public execute 權限，避免前端直接呼叫內部整理函式。
5. 教師可呼叫的審核、退回、重設、彙總函式都有 `is_teacher()` 或 `can_access_team()` 檢查。

## 回填行為

`013` 最後會掃描既有 `submissions` 與 `media_files`，替已存在的作答與媒體建立對應的 `score_items`。

此回填只會新增或重建 `score_items`，不會刪除原始作答、照片或錄音。

## 需要接受的設計行為

1. 若學生修改已審核過的作答，該作答對應的得分項目會重新整理，可能回到待審核狀態。
2. 「與世界交朋友」目前依照作答中的國家與照片檔名建立每組 300 分項目，老師仍需在後台查看照片後再審核通過。
3. 「台北車站」照片目前依照上傳的照片檔案建立每張 100 分項目，系統不會自動判斷照片是否真的屬於指定功能類型，仍由老師審核。

## 執行時提醒

如果 Supabase SQL Editor 跳出 Row Level Security 提醒，因為本 SQL 已經包含：

```sql
alter table taipei_challenge.score_items enable row level security;
```

可以選擇 `Run without RLS` 後繼續執行，讓本 SQL 自己建立預定的 RLS 設定。

執行成功時，畫面預期會顯示：

```text
Success. No rows returned
```

