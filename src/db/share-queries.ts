import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import { itemColumns, type ItemWithUses } from "./queries";
import { item, shave, shaveItem, share, shareItem, user } from "./schema";

export type ShareWithCount = {
  id: string;
  createdAt: Date;
  itemCount: number;
};

export async function listShares(
  db: Db,
  userId: string,
): Promise<ShareWithCount[]> {
  return db
    .select({
      id: share.id,
      createdAt: share.createdAt,
      itemCount: sql<number>`count(${shareItem.itemId})`,
    })
    .from(share)
    .leftJoin(shareItem, eq(shareItem.shareId, share.id))
    .where(eq(share.userId, userId))
    .groupBy(share.id)
    .orderBy(desc(share.createdAt));
}

/** 過濾掉不屬於這個使用者的 itemId —— 避免把別人的品項分享出去。 */
async function ownedItemIds(
  db: Db,
  userId: string,
  itemIds: string[],
): Promise<string[]> {
  const rows = await db
    .select({ id: item.id })
    .from(item)
    .where(and(eq(item.userId, userId), inArray(item.id, itemIds)));
  return rows.map((r) => r.id);
}

export type CreateShareResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_owned_items" };

export async function createShare(
  db: Db,
  userId: string,
  itemIds: string[],
): Promise<CreateShareResult> {
  const owned = await ownedItemIds(db, userId, itemIds);
  if (owned.length === 0) return { ok: false, reason: "no_owned_items" };

  const id = crypto.randomUUID();

  // D1 沒有 interactive transaction，但 batch 是單一原子操作。
  await db.batch([
    db.insert(share).values({ id, userId, createdAt: new Date() }),
    db
      .insert(shareItem)
      .values(owned.map((itemId) => ({ shareId: id, itemId }))),
  ]);

  return { ok: true, id };
}

export async function deleteShare(
  db: Db,
  userId: string,
  shareId: string,
): Promise<boolean> {
  const result = await db
    .delete(share)
    .where(and(eq(share.id, shareId), eq(share.userId, userId)));
  return result.meta.changes > 0;
}

export type PublicShare = {
  id: string;
  createdAt: Date;
  ownerName: string;
  items: ItemWithUses[];
};

/** 公開分享頁：不驗身分，任何人拿著連結都能讀。 */
export async function getPublicShare(
  db: Db,
  shareId: string,
): Promise<PublicShare | null> {
  const rows = await db
    .select({ id: share.id, createdAt: share.createdAt, ownerName: user.name })
    .from(share)
    .innerJoin(user, eq(user.id, share.userId))
    .where(eq(share.id, shareId))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const items = await db
    .select(itemColumns)
    .from(shareItem)
    .innerJoin(item, eq(item.id, shareItem.itemId))
    .leftJoin(shaveItem, eq(shaveItem.itemId, item.id))
    .leftJoin(shave, eq(shave.id, shaveItem.shaveId))
    .where(eq(shareItem.shareId, shareId))
    .groupBy(item.id)
    .orderBy(desc(item.createdAt));

  return { ...found, items };
}

/**
 * 公開圖片路由的授權邊界：不管是誰在看，只要這個 item 確實掛在這個 share 上就能讀。
 */
export async function getShareItemImageKey(
  db: Db,
  shareId: string,
  itemId: string,
): Promise<{ imageKey: string | null } | null> {
  const rows = await db
    .select({ imageKey: item.imageKey })
    .from(shareItem)
    .innerJoin(item, eq(item.id, shareItem.itemId))
    .where(and(eq(shareItem.shareId, shareId), eq(shareItem.itemId, itemId)))
    .limit(1);

  return rows[0] ?? null;
}
