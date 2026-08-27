import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { imageSearchCache } from "./schema";
import type { ImageCandidate } from "@/shared/dto";

/**
 * 搜圖 API 的免費額度有限（SerpAPI 250 次/月），而同一個產品一輩子只需要查一次。
 * 快取是跨使用者共用的：查的是公開的產品名稱，沒有任何個人資料。
 */
function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

async function hash(query: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalize(query)),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function readSearchCache(
  db: Db,
  query: string,
): Promise<ImageCandidate[] | null> {
  const key = await hash(query);
  const rows = await db
    .select({ results: imageSearchCache.resultsJson })
    .from(imageSearchCache)
    .where(eq(imageSearchCache.queryHash, key))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  try {
    return JSON.parse(row.results) as ImageCandidate[];
  } catch {
    return null;
  }
}

export async function writeSearchCache(
  db: Db,
  query: string,
  candidates: ImageCandidate[],
): Promise<void> {
  const key = await hash(query);
  await db
    .insert(imageSearchCache)
    .values({
      queryHash: key,
      resultsJson: JSON.stringify(candidates),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: imageSearchCache.queryHash,
      set: {
        resultsJson: JSON.stringify(candidates),
        createdAt: new Date(),
      },
    });
}
