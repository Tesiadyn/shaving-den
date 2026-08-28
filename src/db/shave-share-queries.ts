import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { item, shave, shaveItem, shaveShare, user } from "./schema";
import type { ItemCategory } from "@/shared/domain";

export type CreateShaveShareResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" };

/** 一篇日誌最多一個分享連結，已經分享過就直接回傳既有的那個。 */
export async function createShaveShare(
  db: Db,
  userId: string,
  shaveId: string,
): Promise<CreateShaveShareResult> {
  const owned = await db
    .select({ id: shave.id })
    .from(shave)
    .where(and(eq(shave.id, shaveId), eq(shave.userId, userId)))
    .limit(1);
  if (owned.length === 0) return { ok: false, reason: "not_found" };

  const existing = await db
    .select({ id: shaveShare.id })
    .from(shaveShare)
    .where(eq(shaveShare.shaveId, shaveId))
    .limit(1);
  if (existing[0]) return { ok: true, id: existing[0].id };

  const id = crypto.randomUUID();
  await db
    .insert(shaveShare)
    .values({ id, userId, shaveId, createdAt: new Date() });

  return { ok: true, id };
}

export async function deleteShaveShare(
  db: Db,
  userId: string,
  shaveId: string,
): Promise<boolean> {
  const result = await db
    .delete(shaveShare)
    .where(and(eq(shaveShare.shaveId, shaveId), eq(shaveShare.userId, userId)));
  return result.meta.changes > 0;
}

export type PublicShave = {
  id: string;
  ownerName: string;
  shavedAt: Date;
  rating: number | null;
  closeness: number | null;
  smoothness: number | null;
  comfort: number | null;
  notes: string | null;
  items: Array<{
    id: string;
    category: ItemCategory;
    brand: string;
    name: string;
    imageKey: string | null;
  }>;
};

/** 公開日誌分享頁：不驗身分，任何人拿著連結都能讀。 */
export async function getPublicShaveShare(
  db: Db,
  shareId: string,
): Promise<PublicShave | null> {
  const rows = await db
    .select({
      id: shaveShare.id,
      shaveId: shave.id,
      shavedAt: shave.shavedAt,
      rating: shave.rating,
      closeness: shave.closeness,
      smoothness: shave.smoothness,
      comfort: shave.comfort,
      notes: shave.notes,
      ownerName: user.name,
    })
    .from(shaveShare)
    .innerJoin(shave, eq(shave.id, shaveShare.shaveId))
    .innerJoin(user, eq(user.id, shaveShare.userId))
    .where(eq(shaveShare.id, shareId))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const items = await db
    .select({
      id: item.id,
      category: item.category,
      brand: item.brand,
      name: item.name,
      imageKey: item.imageKey,
    })
    .from(shaveItem)
    .innerJoin(item, eq(item.id, shaveItem.itemId))
    .where(eq(shaveItem.shaveId, found.shaveId));

  const { shaveId: _shaveId, ...rest } = found;
  return { ...rest, items };
}

/**
 * 公開圖片路由的授權邊界：不管是誰在看，只要這個 item 確實掛在這篇被分享的日誌上就能讀。
 */
export async function getShaveShareItemImageKey(
  db: Db,
  shareId: string,
  itemId: string,
): Promise<{ imageKey: string | null } | null> {
  const rows = await db
    .select({ imageKey: item.imageKey })
    .from(shaveShare)
    .innerJoin(shaveItem, eq(shaveItem.shaveId, shaveShare.shaveId))
    .innerJoin(item, eq(item.id, shaveItem.itemId))
    .where(and(eq(shaveShare.id, shareId), eq(shaveItem.itemId, itemId)))
    .limit(1);

  return rows[0] ?? null;
}
