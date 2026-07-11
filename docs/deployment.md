# 台北之心闖關網頁：GitHub Pages 部署前檢查與設定

更新日期：2026-07-11

## 1. 部署目標

本專案使用 GitHub Pages 部署前端靜態網站，後端資料、登入狀態、作答、媒體檔案皆連到 Supabase。

部署方式：

- 前端：React + TypeScript + Vite
- 自動部署：GitHub Actions
- 發布平台：GitHub Pages
- 資料庫與檔案：Supabase

## 2. 本機部署前檢查

已確認項目：

- `pnpm run build` 可成功完成。
- `.env.local` 已被 `.gitignore` 排除，不會提交到 GitHub。
- 版本檔中未發現 Supabase URL 或 anon key 外洩。
- GitHub Actions 工作流程已建立於 `.github/workflows/deploy.yml`。
- GitHub Actions 會在建置前檢查 Supabase secrets 是否存在。

## 3. GitHub Repository 必要設定

到 GitHub repository 的 `Settings` 設定以下項目。

### Pages

路徑：

`Settings` → `Pages`

設定：

- Source：`GitHub Actions`

### Actions Secrets

路徑：

`Settings` → `Secrets and variables` → `Actions` → `Secrets`

新增：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

注意：

- `VITE_SUPABASE_URL` 填 Supabase Project URL。
- `VITE_SUPABASE_ANON_KEY` 填 Supabase anon public key。
- 不要放 `service_role key`。

### Actions Variables

路徑：

`Settings` → `Secrets and variables` → `Actions` → `Variables`

可選新增：

```text
PAGES_BASE
```

建議值：

```text
./
```

若未設定，專案會使用 `./` 作為預設值。

## 4. GitHub Actions 流程

部署流程檔：

`.github/workflows/deploy.yml`

流程會做以下事情：

1. 取得 repository 原始碼。
2. 安裝 `pnpm`。
3. 設定 Node.js。
4. 安裝前端套件。
5. 檢查 Supabase secrets。
6. 執行 `pnpm run build`。
7. 上傳 `dist`。
8. 部署到 GitHub Pages。

觸發方式：

- 推送到 `main` 分支。
- 手動執行 `workflow_dispatch`。

## 5. Supabase 部署後檢查

正式網址產生後，回到 Supabase 後台確認：

### Authentication

路徑：

`Authentication` → `URL Configuration`

建議加入：

- Site URL：GitHub Pages 正式網址。
- Redirect URLs：GitHub Pages 正式網址。

本專案目前主要使用 anonymous sign-ins 與 RPC，不是 email redirect flow，但仍建議補上正式網址，避免未來加入教師 email 登入時出現限制。

### Data API

確認 `taipei_challenge` schema 已在 Exposed schemas 中。

### Storage

確認 bucket：

```text
taipei-challenge-media
```

狀態：

- private
- file size limit：`10 MB`
- allowed MIME types 包含照片與音訊格式。

## 6. 部署後驗收清單

學生端：

- 可用 `HEART01` / `8101` 登入。
- 可儲存文字作答到 `submissions`。
- 可上傳照片或錄音到 `taipei-challenge-media`。
- 可寫入 `media_files`。

教師端：

- 可用 `tkjhs810` 進入教師後台。
- 可看到隊伍名稱、隊伍代碼、通關碼。
- 可看到 `submissions` 作答內容。
- 可看到 `media_files` 檔案。
- 可開啟 private Storage 暫時連結。
- 可依關卡篩選。
- 可展開／收合小組。
- 可下載作答彙整 `CSV`。

## 7. 不應提交到 GitHub 的內容

請勿提交：

- `.env`
- `.env.local`
- `service_role key`
- Supabase database password
- GitHub token
- 測試下載的 `CSV`

目前 `.gitignore` 已排除本機環境檔與建置輸出。
