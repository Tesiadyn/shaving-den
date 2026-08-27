import { createMiddleware } from "hono/factory";
import type { AppEnv } from "@/server/types";

/**
 * 擋下未登入請求，並把 user 放進 context。
 * 所有讀寫使用者資料的路由都必須掛這支 —— 資料隔離的唯一入口。
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) return c.json({ error: "unauthorized" }, 401);

  c.set("user", {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  });

  await next();
});
