import { Hono } from "hono";
import { getPublicShare, getShareItemImageKey } from "@/db/share-queries";
import { toPublicShareDTO } from "@/server/dto";
import { notFound } from "@/server/errors";
import type { AppEnv } from "@/server/types";

/**
 * 公開分享頁的後端。刻意不掛 requireAuth —— 拿著連結的任何人都能讀，
 * 但只讀得到 share 明確掛上的那些品項，讀不到別的東西。
 */
export const publicShares = new Hono<AppEnv>();

publicShares.get("/:id", async (c) => {
  const found = await getPublicShare(c.var.db, c.req.param("id"));
  if (!found) notFound();
  return c.json({ share: toPublicShareDTO(found) });
});

/**
 * 供應分享品項的圖片。授權邊界是「這個 item 是否掛在這個 share 上」，
 * 不檢查瀏覽者身分 —— 分享出去的圖本來就是要給人看的。
 */
publicShares.get("/:id/items/:itemId/image", async (c) => {
  const found = await getShareItemImageKey(
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
