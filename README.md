# Shaving Den

濕刮用品收藏 + 刮鬍日誌。記錄手上的 DE 刀片、刮鬍皂、鬚前／鬚後、鬚刷與刀架，
每次刮鬍記一筆日誌，使用次數由日誌自動推導。Google 登入，多使用者各自收藏。

整站跑在 Cloudflare 免費額度內，而且不會因為閒置被暫停。

---

## 架構

```
單一 Cloudflare Worker
├─ /*        → Static Assets（Vite 產出的 React SPA）  不啟動 Worker
└─ /api/*    → Hono
     ├─ /api/auth/*     Better Auth（Google OAuth）
     ├─ /api/items      收藏 CRUD、換刀片、掛圖
     ├─ /api/shaves     刮鬍日誌
     ├─ /api/images/*   抓圖 / 搜圖 / 供應 R2 圖片
     └─ /api/stats      刀片壽命、使用排行、庫存警示

D1  ← 所有結構化資料      R2  ← 產品圖片
```

SPA 由 Static Assets 直接發送，不會啟動 Worker，所以不受免費版
**每次請求 10ms CPU** 與 **Worker 腳本 3 MiB** 的限制。只有 `/api/*` 進 Worker，
每支 JSON handler 約 1–3ms CPU。這也是這個專案不用 Next.js SSR 的原因。

| 免費額度 | 上限 | 目前用量 |
|---|---|---|
| Worker 腳本（gzip） | 3 MiB | 約 0.35 MiB（12%） |
| CPU / 請求 | 10 ms | JSON handler 約 1–3 ms |
| 請求 | 100,000 / 天 | 個人用不到 1% |
| D1 | 5 GB、5M 列讀取／天 | — |
| R2 | 10 GB、出站不計費 | 每張圖上限 2 MB |

---

## 本機開發

```bash
pnpm install
cp .dev.vars.example .dev.vars     # 填入下面「設定」章節的值
pnpm db:migrate:local
pnpm dev
```

開 http://localhost:5173。

## 設定

### 1. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   建立專案 → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type 選 **Web application**
3. **Authorized redirect URIs** 加入（本機與正式各一）：
   - `http://localhost:5173/api/auth/callback/google`
   - `https://<你的-worker>.workers.dev/api/auth/callback/google`
4. 把 Client ID 與 Client secret 填進 `.dev.vars`

### 2. Better Auth secret

```bash
openssl rand -base64 32
```

### 3. SerpAPI（選用）

只影響「打品名自動搜圖」那一層。留空的話這層會優雅停用，
**貼商品網址抓圖**與**手動上傳**完全不受影響。

免費方案 250 次／月，而且同一個產品只會查一次（結果進 D1 快取），
個人使用綽綽有餘 → https://serpapi.com/manage-api-key

> 為什麼不用 Google Custom Search JSON API：它已經不收新客戶，
> 而且 2027-01-01 停止服務。搜圖供應商被隔離在
> `src/server/images/search-provider.ts`，要換一家只改那個檔。

---

## 部署

```bash
# 一次性：建立資源
npx wrangler d1 create shaving-den        # 把回傳的 database_id 貼進 wrangler.jsonc
npx wrangler r2 bucket create shaving-den-images

# 一次性：設定 secrets
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL     # https://<你的-worker>.workers.dev
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SERPAPI_KEY         # 選用

# 每次部署
pnpm db:migrate:remote
pnpm deploy
```

部署後到 Cloudflare Dashboard 看 Worker 大小應遠低於 3 MiB，
Metrics 的 CPU time 應穩定在 10ms 以下 —— 這兩個數字決定能不能一直待在免費方案。

---

## 幾個刻意的設計決定

**使用次數不存計數器，一律推導。**
總使用次數 = 這項用品出現在幾筆刮鬍日誌裡。編輯或刪除舊日誌時數字自動修正，
不可能出現計數器漂移。個人規模下聚合查詢是微秒級，不需要反正規化。

**刀片的「目前這一片用了幾次」以 `blade_installed_at` 為界推導。**
還沒換過刀時這個欄位是 null，代表「還在用第一片」，所以從頭算 ——
這樣補登比建檔更早的刮鬍紀錄也會被正確計入。

**換刀時間對齊到「日」，不是按下按鈕的時刻。**
刮鬍紀錄存的是當地午夜。如果換刀記真實時刻，早上換刀、晚上才補登今天的刮鬍，
那次刮鬍就會被算到舊刀片。兩邊都對齊到日，這類歧義整類消失。

**平均壽命只算已經換掉的刀片。**
目前這一片還沒用完，算進去會把平均拉低。

**圖片一律下載進 R2，不外連原始網址。**
外站圖片會失效、會擋 hotlink、會換 CDN 路徑。R2 免費 10 GB 且出站不計費。

**`/api/images/from-url` 是全站唯一會依使用者輸入對外發請求的地方。**
SSRF 防護集中在 `src/server/images/url-guard.ts`：只允許 http/https、
擋掉私有網段與雲端 metadata 位址、逐跳檢查重導向、加 timeout 與大小上限。

**Drizzle 在單表查詢會省略欄位的表名前綴。**
所以相關子查詢裡的 `"id"` 可能被 SQLite 解析成內層的表 —— 靜默算出錯的結果。
`src/db/queries.ts` 因此改用 LEFT JOIN + 條件聚合。這點在改動查詢時要留意。

---

## 專案結構

```
src/
├─ shared/       前後端共用：領域常數、Zod schema、API 契約型別
├─ db/           Drizzle schema 與查詢（每支查詢都強制帶 userId）
├─ server/       Hono routes、Better Auth、圖片管線
└─ client/       React SPA
migrations/      drizzle-kit 產出，wrangler 套用
scripts/
└─ dev-session.mjs   本機造測試用的登入 session（不需要 Google 帳號）
```
