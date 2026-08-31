import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import { item, shave, shaveItem, shaveShare } from "./schema";
import type { ShaveInput } from "@/shared/schemas";
import type { ItemCategory } from "@/shared/domain";

export type ShaveRow = {
  id: string;
  shavedAt: Date;
  rating: number | null;
  closeness: number | null;
  smoothness: number | null;
  comfort: number | null;
  latherQuality: number | null;
  moisturizing: number | null;
  scentLongevity: number | null;
  edgeDulling: number | null;
  notes: string | null;
  /** 這篇日誌的分享連結 id；未分享過為 null。 */
  shareId: string | null;
  items: Array<{
    id: string;
    category: ItemCategory;
    brand: string;
    name: string;
    imageKey: string | null;
  }>;
};

/**
 * 把 shave 列表補上各自用到的品項。
 * 拆成兩次查詢而不是一次 join：D1 是 SQLite，兩次索引查詢比在應用層
 * 攤平 join 結果再去重更單純，個人規模下差異可忽略。
 */
async function attachItems(
  db: Db,
  rows: Array<Omit<ShaveRow, "items">>,
): Promise<ShaveRow[]> {
  if (rows.length === 0) return [];

  const links = await db
    .select({
      shaveId: shaveItem.shaveId,
      id: item.id,
      category: item.category,
      brand: item.brand,
      name: item.name,
      imageKey: item.imageKey,
    })
    .from(shaveItem)
    .innerJoin(item, eq(item.id, shaveItem.itemId))
    .where(
      inArray(
        shaveItem.shaveId,
        rows.map((r) => r.id),
      ),
    );

  const byShave = new Map<string, ShaveRow["items"]>();
  for (const link of links) {
    const bucket = byShave.get(link.shaveId) ?? [];
    bucket.push({
      id: link.id,
      category: link.category,
      brand: link.brand,
      name: link.name,
      imageKey: link.imageKey,
    });
    byShave.set(link.shaveId, bucket);
  }

  return rows.map((r) => ({ ...r, items: byShave.get(r.id) ?? [] }));
}

const shaveColumns = {
  id: shave.id,
  shavedAt: shave.shavedAt,
  rating: shave.rating,
  closeness: shave.closeness,
  smoothness: shave.smoothness,
  comfort: shave.comfort,
  latherQuality: shave.latherQuality,
  moisturizing: shave.moisturizing,
  scentLongevity: shave.scentLongevity,
  edgeDulling: shave.edgeDulling,
  notes: shave.notes,
  shareId: shaveShare.id,
};

export async function listShaves(
  db: Db,
  userId: string,
  limit = 100,
): Promise<ShaveRow[]> {
  const rows = await db
    .select(shaveColumns)
    .from(shave)
    .leftJoin(shaveShare, eq(shaveShare.shaveId, shave.id))
    .where(eq(shave.userId, userId))
    .orderBy(desc(shave.shavedAt), desc(shave.createdAt))
    .limit(limit);

  return attachItems(db, rows);
}

/** 用過某項用品的所有刮鬍紀錄。品項本身的擁有權由呼叫端先驗過。 */
export async function listShavesForItem(
  db: Db,
  userId: string,
  itemId: string,
): Promise<ShaveRow[]> {
  const rows = await db
    .select(shaveColumns)
    .from(shave)
    .leftJoin(shaveShare, eq(shaveShare.shaveId, shave.id))
    .innerJoin(shaveItem, eq(shaveItem.shaveId, shave.id))
    .where(and(eq(shave.userId, userId), eq(shaveItem.itemId, itemId)))
    .orderBy(desc(shave.shavedAt));

  return attachItems(db, rows);
}

export async function getShave(
  db: Db,
  userId: string,
  shaveId: string,
): Promise<ShaveRow | null> {
  const rows = await db
    .select(shaveColumns)
    .from(shave)
    .leftJoin(shaveShare, eq(shaveShare.shaveId, shave.id))
    .where(and(eq(shave.id, shaveId), eq(shave.userId, userId)))
    .limit(1);

  const withItems = await attachItems(db, rows);
  return withItems[0] ?? null;
}

/** 過濾掉不屬於這個使用者的 itemId —— 避免把別人的品項掛進自己的日誌。 */
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

export type CreateShaveResult =
  | { ok: true; shave: ShaveRow }
  | { ok: false; reason: "no_owned_items" };

export async function createShave(
  db: Db,
  userId: string,
  input: ShaveInput,
): Promise<CreateShaveResult> {
  const owned = await ownedItemIds(db, userId, input.itemIds);
  if (owned.length === 0) return { ok: false, reason: "no_owned_items" };

  const id = crypto.randomUUID();

  // D1 沒有 interactive transaction，但 batch 是單一原子操作。
  await db.batch([
    db.insert(shave).values({
      id,
      userId,
      shavedAt: new Date(input.shavedAt),
      rating: input.rating,
      closeness: input.closeness,
      smoothness: input.smoothness,
      comfort: input.comfort,
      latherQuality: input.latherQuality,
      moisturizing: input.moisturizing,
      scentLongevity: input.scentLongevity,
      edgeDulling: input.edgeDulling,
      notes: input.notes,
      createdAt: new Date(),
    }),
    db
      .insert(shaveItem)
      .values(owned.map((itemId) => ({ shaveId: id, itemId }))),
  ]);

  const created = await getShave(db, userId, id);
  if (!created) throw new Error("failed to read back created shave");
  return { ok: true, shave: created };
}

export async function deleteShave(
  db: Db,
  userId: string,
  shaveId: string,
): Promise<boolean> {
  const result = await db
    .delete(shave)
    .where(and(eq(shave.id, shaveId), eq(shave.userId, userId)));
  return result.meta.changes > 0;
}

export type ItemUsageStat = {
  itemId: string;
  category: ItemCategory;
  brand: string;
  name: string;
  usesCount: number;
};

/** 統計頁用：各品項的使用次數，由日誌推導。 */
export async function itemUsageStats(
  db: Db,
  userId: string,
): Promise<ItemUsageStat[]> {
  return db
    .select({
      itemId: item.id,
      category: item.category,
      brand: item.brand,
      name: item.name,
      usesCount: sql<number>`count(${shaveItem.shaveId})`,
    })
    .from(item)
    .leftJoin(shaveItem, eq(shaveItem.itemId, item.id))
    .where(eq(item.userId, userId))
    .groupBy(item.id)
    .orderBy(desc(sql`count(${shaveItem.shaveId})`));
}
