import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@/db/client";
import * as schema from "@/db/schema";

/**
 * Better Auth 必須每個請求現做一次 —— D1 binding 只有在 request scope 才拿得到，
 * 不能像 Node 那樣在模組頂層建立單例。
 */
export function createAuth(env: Env) {
  const db = createDb(env.DB);

  return betterAuth({
    appName: "Shaving Den",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [env.BETTER_AUTH_URL],

    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      // D1 沒有 interactive transaction，操作必須循序執行。
      transaction: false,
    }),

    // 本站只走 Google 登入，不開放密碼註冊。
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 天
      updateAge: 60 * 60 * 24, // 每天最多續期一次，減少寫入
      // 把 session 快取在簽章 cookie 裡，5 分鐘內的請求不必回 D1 查。
      // 這是把 D1 免費額度（5M reads/day）從「每個 API 請求一次」降到近乎零的關鍵。
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    advanced: {
      // Worker 一律走 HTTPS（本機 localhost 例外由 better-auth 自行處理）
      useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];
