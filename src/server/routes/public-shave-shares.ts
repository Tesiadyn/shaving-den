import { Hono } from "hono";
import { getPublicShaveShare, getShaveShareItemImageKey } from "@/db/shave-share-queries";
import { toPublicShaveDTO } from "@/server/dto";
import { notFound } from "@/server/errors";
import type { AppEnv } from "@/server/types";

/**
 * 公開日誌分享頁的後端。刻意不掛 requireAuth —— 拿著連結的任何人都能讀，
 * 但只讀得到這篇日誌本身，讀不到分享者的其他紀錄。
 */
export const publicShaveShares = new Hono<AppEnv>();

publicShaveShares.get("/:id", async (c) => {
  const found = await getPublicShaveShare(c.var.db, c.req.param("id"));
  if (!found) notFound();
  return c.json({ shave: toPublicShaveDTO(found) });
});

/**
 * 供應分享日誌裡用品的圖片。授權邊界是「這個 item 是否掛在這篇被分享的日誌上」，
 * 不檢查瀏覽者身分 —— 分享出去的圖本來就是要給人看的。
 */
publicShaveShares.get("/:id/items/:itemId/image", async (c) => {
  const found = await getShaveShareItemImageKey(
    c.var.db,
    c.req.param("id"),
    c.req.param("itemId"),
  );
  if (!found?.imageKey) notFound();

  const object = await c.env.IMAGES.get(found.imageKey);
  if (!object) notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
});
