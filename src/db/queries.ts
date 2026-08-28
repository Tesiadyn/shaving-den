import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { bladeSwap, item, shave, shaveItem } from "./schema";
import type { Item } from "./schema";
import type { ItemInput, ItemPatch } from "@/shared/schemas";
import type { ItemStatus } from "@/shared/domain";

/**
 * 使用次數一律用推導，不存計數器。
 * 好處：編輯或刪除舊日誌時數字自動修正，不可能漂移。
 *
 * 用 LEFT JOIN + 條件聚合而不是相關子查詢：Drizzle 在單表查詢時會省略欄位的
 * 表名前綴，子查詢裡的 `"id"` 會被 SQLite 解析成內層的 shave.id 而不是外層的
 * item.id（靜默算出 0）。有 join 時 Drizzle 一律加上前綴，就沒有這個歧義。
 */
const usesCountSql = sql<number>`count(${shaveItem.shaveId})`;

/**
 * 目前這一片刀自上次換刀（blade_installed_at）之後被用了幾次。
 * null 代表還沒換過 —— 也就是還在用第一片，所以從頭算。
 */
const currentUnitUsesSql = sql<number>`coalesce(sum(case when ${shave.shavedAt} >= coalesce(${item.bladeInstalledAt}, 0) then 1 else 0 end), 0)`;

export type ItemWithUses = Item & {
  usesCount: number;
  currentUnitUses: number;
};

export const itemColumns = {
  id: item.id,
  userId: item.userId,
  category: item.category,
  brand: item.brand,
  name: item.name,
  scentNotes: item.scentNotes,
  notes: item.notes,
  quantity: item.quantity,
  unit: item.unit,
  status: item.status,
  productUrl: item.productUrl,
  imageKey: item.imageKey,
  imageSource: item.imageSource,
  bladeInstalledAt: item.bladeInstalledAt,
  acquiredAt: item.acquiredAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  usesCount: usesCountSql,
  currentUnitUses: currentUnitUsesSql,
};

/** 帶上推導欄位的基礎查詢；所有讀取都從這裡出發，確保聚合方式只有一份。 */
function selectItemsWithUses(db: Db) {
  return db
    .select(itemColumns)
    .from(item)
    .leftJoin(shaveItem, eq(shaveItem.itemId, item.id))
    .leftJoin(shave, eq(shave.id, shaveItem.shaveId))
    .groupBy(item.id);
}

export type ItemFilter = {
  status?: ItemStatus;
};

/**
 * 分類篩選與關鍵字搜尋刻意不做在這裡：收藏頁一次把清單抓齊、在前端篩，
 * 這樣分類按鈕上能直接顯示數量、切換也不必等網路。
 */
export async function listItems(
  db: Db,
  userId: string,
  filter: ItemFilter = {},
): Promise<ItemWithUses[]> {
  const conditions = [eq(item.userId, userId)];
  if (filter.status) conditions.push(eq(item.status, filter.status));

  return selectItemsWithUses(db)
    .where(and(...conditions))
    .orderBy(desc(item.createdAt));
}

export async function getItem(
  db: Db,
  userId: string,
  itemId: string,
): Promise<ItemWithUses | null> {
  const rows = await selectItemsWithUses(db)
    .where(and(eq(item.id, itemId), eq(item.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function createItem(
  db: Db,
  userId: string,
  input: ItemInput,
): Promise<ItemWithUses> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(item).values({
    id,
    userId,
    ...input,
    acquiredAt: input.acquiredAt === null ? null : new Date(input.acquiredAt),
    // 刻意留 null：還沒換過刀片時「目前這一片」等同於全部使用次數。
    // 若在這裡填 now，補登比建檔更早的刮鬍紀錄就不會被算進目前這片。
    bladeInstalledAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const created = await getItem(db, userId, id);
  if (!created) throw new Error("failed to read back created item");
  return created;
}

export async function updateItem(
  db: Db,
  userId: string,
  itemId: string,
  patch: ItemPatch,
): Promise<ItemWithUses | null> {
  const { acquiredAt, ...rest } = patch;

  const result = await db
    .update(item)
    .set({
      ...rest,
      ...(acquiredAt !== undefined
        ? { acquiredAt: acquiredAt === null ? null : new Date(acquiredAt) }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(item.id, itemId), eq(item.userId, userId)));

  if (result.meta.changes === 0) return null;
  return getItem(db, userId, itemId);
}

export async function deleteItem(
  db: Db,
  userId: string,
  itemId: string,
): Promise<boolean> {
  const result = await db
    .delete(item)
    .where(and(eq(item.id, itemId), eq(item.userId, userId)));
  return result.meta.changes > 0;
}

/**
 * 換上新的一片刀：庫存 -1，使用次數的起算點移到現在。
 * 庫存為 0 時回 null，由呼叫端決定怎麼提示。
 */
export async function installNewBlade(
  db: Db,
  userId: string,
  itemId: string,
  installedOn: Date,
): Promise<ItemWithUses | null> {
  const installedAt = installedOn;

  const result = await db
    .update(item)
    .set({
      bladeInstalledAt: installedAt,
      quantity: sql`max(${item.quantity} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(item.id, itemId),
        eq(item.userId, userId),
        eq(item.category, "blade"),
        sql`${item.quantity} > 0`,
      ),
    );

  // 條件不成立（不是自己的、不是刀片、庫存 0）就不留歷史。
  if (result.meta.changes === 0) return null;

  await db
    .insert(bladeSwap)
    .values({ id: crypto.randomUUID(), itemId, installedAt });

  return getItem(db, userId, itemId);
}

export async function setItemImage(
  db: Db,
  userId: string,
  itemId: string,
  imageKey: string | null,
  imageSource: Item["imageSource"],
): Promise<boolean> {
  const result = await db
    .update(item)
    .set({ imageKey, imageSource, updatedAt: new Date() })
    .where(and(eq(item.id, itemId), eq(item.userId, userId)));
  return result.meta.changes > 0;
}
