// Worker secrets。wrangler.jsonc 裡不會有這些值（它們是 secret），
// 所以 `wrangler types` 產不出來 —— 在這裡明確宣告，順便當成必要設定的清單。
// 本機值放 .dev.vars，正式環境用 `wrangler secret put <NAME>`。
interface Env {
  /** openssl rand -base64 32 */
  BETTER_AUTH_SECRET: string;
  /** 站台對外的完整網址，OAuth callback 以此為基準 */
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** 留空則停用「打品名搜圖」那一層 */
  SERPAPI_KEY: string;
}
