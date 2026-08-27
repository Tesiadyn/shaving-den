import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { readSearchCache, writeSearchCache } from "@/db/image-cache";
import { getItem } from "@/db/queries";
import { badRequest, notFound } from "@/server/errors";
import { extractOgImages } from "@/server/images/og";
import { resolveSearchProvider } from "@/server/images/search-provider";
import { requireAuth } from "@/server/middleware/require-auth";
import type { AppEnv } from "@/server/types";
import {
  imageFromUrlSchema,
  imageSearchQuerySchema,
} from "@/shared/schemas";

const SEARCH_LIMIT = 8;

export const images = new Hono<AppEnv>();

images.use("*", requireAuth);

/** Layer 1：貼商品網址 → 抓 og:image。免費、無額度上限、最準。 */
images.post("/from-url", zValidator("json", imageFromUrlSchema), async (c) => {
  const result = await extractOgImages(c.req.valid("json").productUrl);
  if (!result.ok) badRequest(result.reason);
  return c.json({ candidates: result.candidates });
});

/** Layer 2：只打品名 → 搜尋 API 回候選圖。有額度，所以先查快取。 */
images.get("/search", zValidator("query", imageSearchQuerySchema), async (c) => {
  const { q } = c.req.valid("query");

  const cached = await readSearchCache(c.var.db, q);
  if (cached) return c.json({ candidates: cached, cached: true });

  const provider = resolveSearchProvider(c.env);
  if (!provider) badRequest("search_not_configured");

  let candidates;
  try {
    candidates = await provider.search(q, SEARCH_LIMIT);
  } catch {
    badRequest("search_failed");
  }

  // 只有查到東西才寫快取，免得把一次暫時性的空結果永久記住。
  if (candidates.length > 0) {
    await writeSearchCache(c.var.db, q, candidates);
  }

  return c.json({ candidates, cached: false });
});

/**
 * 供應圖片。驗完身分與擁有權才讀 R2。
 * 網址帶的 ?v= 是 R2 key 的版本片段，換圖時網址會變，所以可以放心用長快取。
 * 用 private 而非 public：這是使用者自己的收藏，不該進共用快取。
 */
images.get("/:itemId", async (c) => {
  const found = await getItem(c.var.db, c.var.user.id, c.req.param("itemId"));
  if (!found?.imageKey) notFound();

  const object = await c.env.IMAGES.get(found.imageKey);
  if (!object) notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
});
