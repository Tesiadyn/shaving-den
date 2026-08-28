import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { withContext } from "./middleware/context";
import { requireAuth } from "./middleware/require-auth";
import { images } from "./routes/images";
import { items } from "./routes/items";
import { publicShares } from "./routes/public-shares";
import { shares } from "./routes/shares";
import { shaves } from "./routes/shaves";
import { stats } from "./routes/stats";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("/api/*", withContext);

app.get("/api/health", (c) => c.json({ ok: true, at: Date.now() }));

// Better Auth 自己處理 /api/auth 底下所有路由（含 Google OAuth 導向與 callback）。
app.on(["GET", "POST"], "/api/auth/*", (c) => c.var.auth.handler(c.req.raw));

app.get("/api/me", requireAuth, (c) => c.json({ user: c.var.user }));

app.route("/api/items", items);
app.route("/api/shaves", shaves);
app.route("/api/images", images);
app.route("/api/stats", stats);
app.route("/api/shares", shares);
app.route("/api/public/shares", publicShares);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("unhandled error", err);
  return c.json({ error: "internal_error" }, 500);
});

// Static Assets 已處理所有非 /api 路徑；能走到這裡的就是不存在的 API。
app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
