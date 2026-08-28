import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createShare, deleteShare, listShares } from "@/db/share-queries";
import { toShareDTO } from "@/server/dto";
import { badRequest, notFound } from "@/server/errors";
import { requireAuth } from "@/server/middleware/require-auth";
import type { AppEnv } from "@/server/types";
import { shareInputSchema } from "@/shared/schemas";

export const shares = new Hono<AppEnv>();

shares.use("*", requireAuth);

shares.get("/", async (c) => {
  const rows = await listShares(c.var.db, c.var.user.id);
  return c.json({ shares: rows.map(toShareDTO) });
});

shares.post("/", zValidator("json", shareInputSchema), async (c) => {
  const result = await createShare(
    c.var.db,
    c.var.user.id,
    c.req.valid("json").itemIds,
  );
  if (!result.ok) badRequest(result.reason);
  return c.json({ id: result.id }, 201);
});

shares.delete("/:id", async (c) => {
  const ok = await deleteShare(c.var.db, c.var.user.id, c.req.param("id"));
  if (!ok) notFound();
  return c.body(null, 204);
});
