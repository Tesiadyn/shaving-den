import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createItem,
  deleteItem,
  getItem,
  installNewBlade,
  listItems,
  setItemImage,
  updateItem,
} from "@/db/queries";
import { listShavesForItem } from "@/db/shave-queries";
import { toItemDTO, toShaveDTO } from "@/server/dto";
import { badRequest, notFound } from "@/server/errors";
import {
  MAX_IMAGE_BYTES,
  storeFromUpload,
  storeFromUrl,
} from "@/server/images/store";
import { requireAuth } from "@/server/middleware/require-auth";
import type { AppEnv } from "@/server/types";
import {
  imageSelectSchema,
  installBladeSchema,
  itemInputSchema,
  itemListQuerySchema,
  itemPatchSchema,
} from "@/shared/schemas";

export const items = new Hono<AppEnv>();

items.use("*", requireAuth);

items.get("/", zValidator("query", itemListQuerySchema), async (c) => {
  const rows = await listItems(c.var.db, c.var.user.id, c.req.valid("query"));
  return c.json({ items: rows.map(toItemDTO) });
});

items.post("/", zValidator("json", itemInputSchema), async (c) => {
  const created = await createItem(c.var.db, c.var.user.id, c.req.valid("json"));
  return c.json({ item: toItemDTO(created) }, 201);
});

items.get("/:id", async (c) => {
  const found = await getItem(c.var.db, c.var.user.id, c.req.param("id"));
  if (!found) notFound();
  return c.json({ item: toItemDTO(found) });
});

items.get("/:id/shaves", async (c) => {
  const id = c.req.param("id");
  // 先確認品項是自己的，否則等於讓人用別人的 id 探測資料。
  const owned = await getItem(c.var.db, c.var.user.id, id);
  if (!owned) notFound();

  const rows = await listShavesForItem(c.var.db, c.var.user.id, id);
  return c.json({ shaves: rows.map(toShaveDTO) });
});

items.patch("/:id", zValidator("json", itemPatchSchema), async (c) => {
  const updated = await updateItem(
    c.var.db,
    c.var.user.id,
    c.req.param("id"),
    c.req.valid("json"),
  );
  if (!updated) notFound();
  return c.json({ item: toItemDTO(updated) });
});

items.delete("/:id", async (c) => {
  const ok = await deleteItem(c.var.db, c.var.user.id, c.req.param("id"));
  if (!ok) notFound();
  return c.body(null, 204);
});

/** 換上新的一片刀：庫存 -1，使用次數起算點歸零。 */
items.post(
  "/:id/install-blade",
  zValidator("json", installBladeSchema),
  async (c) => {
    const id = c.req.param("id");
    const updated = await installNewBlade(
      c.var.db,
      c.var.user.id,
      id,
      new Date(c.req.valid("json").installedAt),
    );
    if (updated) return c.json({ item: toItemDTO(updated) });

    // 分辨「不存在／不是你的／不是刀片」與「庫存已經是 0」，給前端有用的訊息。
    const existing = await getItem(c.var.db, c.var.user.id, id);
    if (!existing || existing.category !== "blade") notFound();
    badRequest("out_of_stock");
  },
);

/* ---------------------------------------------------------------------------
 * 圖片：三層取得方式最後都收斂到同一個落地流程 —— 下載進 R2，寫回 image_key。
 * ------------------------------------------------------------------------ */

const STORE_ERRORS: Record<string, string> = {
  blocked: "blocked_url",
  fetch_failed: "fetch_failed",
  not_an_image: "not_an_image",
  too_large: "too_large",
};

/** 換圖或移除圖片後，把舊的 R2 物件清掉，不留孤兒。 */
async function dropObject(bucket: R2Bucket, key: string | null) {
  if (key) await bucket.delete(key);
}

/** Layer 1 與 Layer 2 共用：使用者選定一張候選圖之後存進來。 */
items.post("/:id/image", zValidator("json", imageSelectSchema), async (c) => {
  const id = c.req.param("id");
  const existing = await getItem(c.var.db, c.var.user.id, id);
  if (!existing) notFound();

  const { imageUrl, source } = c.req.valid("json");
  const stored = await storeFromUrl(
    c.env.IMAGES,
    c.var.user.id,
    id,
    imageUrl,
  );
  if (!stored.ok) badRequest(STORE_ERRORS[stored.reason] ?? "store_failed");

  await setItemImage(c.var.db, c.var.user.id, id, stored.key, source);
  await dropObject(c.env.IMAGES, existing.imageKey);

  const updated = await getItem(c.var.db, c.var.user.id, id);
  if (!updated) notFound();
  return c.json({ item: toItemDTO(updated) });
});

/** Layer 3：手動上傳。 */
items.post("/:id/image/upload", async (c) => {
  const id = c.req.param("id");
  const existing = await getItem(c.var.db, c.var.user.id, id);
  if (!existing) notFound();

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) badRequest("no_file");
  if (file.size > MAX_IMAGE_BYTES) badRequest("too_large");

  const stored = await storeFromUpload(
    c.env.IMAGES,
    c.var.user.id,
    id,
    file,
  );
  if (!stored.ok) badRequest(STORE_ERRORS[stored.reason] ?? "store_failed");

  await setItemImage(c.var.db, c.var.user.id, id, stored.key, "upload");
  await dropObject(c.env.IMAGES, existing.imageKey);

  const updated = await getItem(c.var.db, c.var.user.id, id);
  if (!updated) notFound();
  return c.json({ item: toItemDTO(updated) });
});

items.delete("/:id/image", async (c) => {
  const id = c.req.param("id");
  const existing = await getItem(c.var.db, c.var.user.id, id);
  if (!existing) notFound();

  await setItemImage(c.var.db, c.var.user.id, id, null, null);
  await dropObject(c.env.IMAGES, existing.imageKey);

  const updated = await getItem(c.var.db, c.var.user.id, id);
  if (!updated) notFound();
  return c.json({ item: toItemDTO(updated) });
});
