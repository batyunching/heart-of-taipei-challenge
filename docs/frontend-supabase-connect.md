# 前端接上 Supabase：小組建立與登入

版本日期：2026-07-11

本文件記錄目前前端已完成的 Supabase 串接範圍，以及下一步設定方式。

## 已完成

前端已新增：

- Supabase client，指定使用 `taipei_challenge` schema。
- 學生匿名登入流程。
- 建立小組：呼叫 `create_team()`。
- 登入既有小組：呼叫 `login_team()`。
- 將登入成功的小組資訊保存於瀏覽器本機。
- 中文錯誤提示，例如通關碼錯誤、找不到隊伍、尚未設定 Supabase。

相關檔案：

- `src/lib/supabase.ts`
- `src/lib/teamApi.ts`
- `src/lib/localStore.ts`
- `src/App.tsx`

## 本機環境變數

建立 `.env.local`，填入：

```text
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

不要放入：

- `service_role key`
- 資料庫密碼
- GitHub token

## Supabase 後台取得位置

進入 Supabase 專案後：

1. 點左側 `Project Settings`。
2. 點 `Data API` 或 `API`。
3. 複製 Project URL，填入 `VITE_SUPABASE_URL`。
4. 複製 `anon public` key，填入 `VITE_SUPABASE_ANON_KEY`。

## 測試方式

設定 `.env.local` 後，啟動前端並測試：

1. 使用預設隊伍登入：
   - 隊名或隊伍代碼：`HEART01`
   - 通關碼：`8101`
2. 預期畫面顯示：
   - 已登入小組：第一組，隊伍代碼 HEART01
3. 測試建立新隊伍：
   - 輸入隊名。
   - 通關碼至少 4 個字元。
   - 組員 3 至 6 人。
   - 點「建立隊伍 Create Team」。

## 下一步

完成小組登入測試後，下一階段建議依序串接：

1. 一般關卡文字作答儲存到 `submissions`。
2. 第 6 頁儲存到 `world_friend_records`。
3. 照片與錄音上傳到 `taipei-challenge-media`。
4. 教師後台讀取 `teams`、`submissions`、`media_files`。
