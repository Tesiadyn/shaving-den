import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createShave,
  deleteShave,
  listShaves,
} from "@/db/shave-queries";
import { toShaveDTO } from "@/server/dto";
import { badRequest, notFound } from "@/server/errors";
import { requireAuth } from "@/server/middleware/require-auth";
import type { AppEnv } from "@/server/types";
import { shaveInputSchema } from "@/shared/schemas";

export const shaves = new Hono<AppEnv>();

shaves.use("*", requireAuth);

shaves.get("/", async (c) => {
  const rows = await listShaves(c.var.db, c.var.user.id);
  return c.json({ shaves: rows.map(toShaveDTO) });
});

shaves.post("/", zValidator("json", shaveInputSchema), async (c) => {
  const result = await createShave(
    c.var.db,
    c.var.user.id,
    c.req.valid("json"),
  );

  if (!result.ok) badRequest("no_owned_items");
  return c.json({ shave: toShaveDTO(result.shave) }, 201);
});

shaves.delete("/:id", async (c) => {
  const ok = await deleteShave(c.var.db, c.var.user.id, c.req.param("id"));
  if (!ok) notFound();
  return c.body(null, 204);
});
