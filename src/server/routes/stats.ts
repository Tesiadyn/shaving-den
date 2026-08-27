import { Hono } from "hono";
import { buildStats } from "@/db/stats-queries";
import { requireAuth } from "@/server/middleware/require-auth";
import type { AppEnv } from "@/server/types";

export const stats = new Hono<AppEnv>();

stats.use("*", requireAuth);

stats.get("/", async (c) => {
  return c.json(await buildStats(c.var.db, c.var.user.id));
});
