import { createMiddleware } from "hono/factory";
import { createDb } from "@/db/client";
import { createAuth } from "@/server/auth";
import type { AppEnv } from "@/server/types";

/** 每個請求建立 db 與 auth 實例（bindings 只有 request scope 拿得到）。 */
export const withContext = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", createDb(c.env.DB));
  c.set("auth", createAuth(c.env));
  await next();
});
