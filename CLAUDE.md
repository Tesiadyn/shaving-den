# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概觀

Shaving Den：濕刮用品收藏 + 刮鬍日誌。單一 Cloudflare Worker，Google 登入、多使用者各自收藏。
完整背景與設計動機見 `README.md`（部署、Google OAuth 設定、免費額度分析都在那裡，這裡不重複）。

## 常用指令

```bash
pnpm dev                  # 本機開發，http://localhost:5173（Vite + Cloudflare plugin 同一個 port）
pnpm typecheck             # tsc -b --noEmit，三個 tsconfig project 一起檢查
pnpm build                 # tsc -b && vite build
pnpm deploy                # build 後 wrangler deploy

pnpm db:generate            # 改了 src/db/schema.ts 之後，用 drizzle-kit 產生新的 migration
pnpm db:migrate:local       # 套用 migration 到本機模擬 D1（.wrangler/state）
pnpm db:migrate:remote      # 套用到正式 D1

pnpm cf-typegen             # 依 wrangler.jsonc 的 bindings 重新產生 worker-configuration.d.ts
pnpm auth:generate          # better-auth CLI，升級 better-auth 版本後用來核對 schema 有無變動
```

沒有測試套件。改完程式碼至少要跑 `pnpm typecheck`；牽涉到資料庫的改動要跑一次
`pnpm db:migrate:local` 並用 `node scripts/dev-session.mjs [name]` 造一個本機登入 cookie
手動打 API 驗證（不需要真的 Google 帳號，見下方「本機測試」）。

## 架構

```
單一 Cloudflare Worker（src/server/index.ts 是入口）
├─ /*        → Static Assets 直接發送 Vite 產出的 React SPA，不啟動 Worker
└─ /api/*    → Hono app，掛 withContext（每請求建立 db/auth 實例）
     ├─ /api/auth/*            Better Auth 全權處理（Google OAuth）
     ├─ /api/items             收藏 CRUD、換刀片、掛圖              [需登入]
     ├─ /api/shaves            刮鬍日誌 CRUD                        [需登入]
     ├─ /api/images/*          抓圖／搜圖／供應 R2 圖片（擁有權驗證） [需登入]
     ├─ /api/stats             刀片壽命、使用排行、庫存警示          [需登入]
     ├─ /api/shares            建立／列出／撤銷分享連結              [需登入]
     └─ /api/public/shares/*   公開分享頁的資料與圖片                [不需登入]

D1 ← 所有結構化資料（Drizzle ORM）      R2 ← 產品圖片
```

`assets.not_found_handling: "single-page-application"` + `run_worker_first: ["/api/*"]`
（見 `wrangler.jsonc`）：只有 `/api/*` 會真的跑到 Worker，其餘一律由 Static Assets 直接回應，
這是專案不用 SSR 框架的原因（見 README 的免費額度分析）。

## 程式碼組織

```
src/shared/   前後端共用：領域常數（domain.ts）、Zod schema（schemas.ts）、API 契約型別（dto.ts）
src/db/       Drizzle schema（schema.ts）與查詢；每支查詢一律帶 userId 做資料隔離
src/server/   Hono routes、Better Auth 設定、圖片管線（server/images/）
src/client/   React SPA（React Router + TanStack Query）
migrations/   drizzle-kit 產出，不要手改；用 pnpm db:generate 產生
```

- Path alias `@/` → `src/`（`vite.config.ts` 與各 tsconfig 都有設，前後端共用）。
- 三個獨立 tsconfig project：`tsconfig.app.json`（`src/client` + `src/shared`，含 DOM lib）、
  `tsconfig.worker.json`（`src/server` + `src/db` + `src/shared`，純 ES2022、無 DOM）、
  `tsconfig.node.json`（vite/drizzle 設定檔）。在 `src/server` 或 `src/db` 裡不能用瀏覽器 API，
  在 `src/client` 裡不能假設 Node/Workers 專屬 API 存在；`src/shared` 兩邊都要能跑。
- 全專案開了 `noUncheckedIndexedAccess`：陣列索引、`Map.get()` 等一律要處理 `undefined`。

## 資料隔離與驗證模式

- `withContext`（`src/server/middleware/context.ts`）在每個 `/api/*` 請求建立一次 `db` 與 `auth`
  ——D1 binding 只有 request scope 拿得到，不能在模組頂層建單例。
- `requireAuth`（`src/server/middleware/require-auth.ts`）驗 session、把 `user` 放進 Hono context，
  是唯一的登入把關點。除了 `/api/public/shares/*`，其餘路由一律掛它。
- **每一支查詢函式都吃 `userId` 當參數**，`WHERE` 子句永遠帶 `eq(table.userId, userId)`
  （`src/db/queries.ts`、`src/db/shave-queries.ts`）。新增查詢時照抄這個模式，不要只在 route
  層驗證、查詢層信任呼叫端。
- 「找不到」與「不是你的」一律回 404（`src/server/errors.ts` 的 `notFound()`），不區分兩者以免
  洩漏資源存在性。
- 公開端點（`/api/public/shares/*`，見 `src/server/routes/public-shares.ts` 與
  `src/db/share-queries.ts`）刻意不驗身分，改用「資源是否確實掛在這個分享上」當授權邊界——
  新增其他公開分享類功能時比照這個模式，不要用 userId 驗證公開路由。

## 圖片管線（src/server/images/）

三層抓圖，任何一層都收斂到同一個落地流程（`store.ts` 的 `storeFromUrl`/`storeFromUpload`）：
下載進 R2、寫回 `item.image_key`，圖片一律經 `/api/images/:itemId`（或分享版本）供應，不外連
原始網址（外站圖會失效、擋 hotlink、換 CDN 路徑；R2 免費 10 GB 且出站不計費）。

- **Layer 1** `og.ts`：貼商品網址抓 `og:image`，免額度限制、最準。
- **Layer 2** `search-provider.ts`：打品名關鍵字搜圖，走 SerpAPI（有月額度，結果存
  `image_search_cache` 表快取）。供應商被抽成 `ImageSearchProvider` 介面，換家只改這個檔。
- **Layer 3** 手動上傳。

`from-url` 這條路是全站唯一會依使用者輸入對外發請求的地方，也是唯一的 SSRF 風險面。
防護集中在 `url-guard.ts`：只允許 http/https、擋掉私有網段與雲端 metadata 位址、
用 `redirect: "manual"` 逐跳重新檢查（避免合法網址重導向到內網）、加 timeout 與大小上限。
新增任何會依使用者輸入發 outbound fetch 的功能，都要走 `safeFetch`，不要直接用全域 `fetch`。

## 幾個容易踩到的地方

- **使用次數（`usesCount`／`currentUnitUses`）不存欄位，一律用 join+聚合推導**
  （`src/db/queries.ts` 的 `itemColumns`）。改動品項或刮鬍相關 schema 時記得這兩個是算出來的，
  不要試圖直接寫入。
- **Drizzle 在單表查詢會省略欄位的表名前綴**，相關子查詢裡的裸 `"id"` 可能被 SQLite 解析成內層
  表的欄位、靜默算出錯誤結果。需要聚合時照抄現有的 LEFT JOIN + `groupBy` 寫法，不要改回子查詢。
- **D1 沒有 interactive transaction**，多語句的原子寫入一律用 `db.batch([...])`
  （範例：`createShave`、`createShare`）。
- **刀片「目前這一片用了幾次」以 `blade_installed_at` 為界**：null 代表「還沒換過，從頭算」。
  換刀時間對齊到本地日期午夜而非按鈕按下的實際時刻，理由與刮鬍紀錄的時間慣例見
  `src/shared/schemas.ts` 的 `installBladeSchema` 註解。
- **感受評分的量表方向統一「越高越好」**，唯一來源是 `src/shared/domain.ts` 的 `SHAVE_RATINGS`；
  新增或修改評分項目只改這個常數，表單與顯示都會跟著長出來。
- **收藏頁的分類篩選／關鍵字搜尋做在前端**（一次抓齊全部品項），`/api/items` 只保留 `status`
  參數，不要為了「效能」加後端篩選/分頁——個人收藏量級用不到。

## 本機測試（不需要 Google 帳號）

```bash
node scripts/dev-session.mjs [name]   # 造測試使用者 + session，印出可用的 Cookie 字串
```

印出的 `better-auth.session_token=...` 可以直接帶進 `curl -b` 打任何 `/api/*` 端點。
用不同的 `[name]` 可以造第二個使用者，驗證資料隔離（A 拿不到 B 的品項/分享）。
