import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import { bladeSwap, item, shave, shaveItem } from "./schema";
import { CONSUMABLE_CATEGORIES } from "@/shared/domain";
import type {
  BladeLife,
  LowStockItem,
  Stats,
  TopItem,
} from "@/shared/dto";

const LOW_STOCK_THRESHOLD = 3;

export async function buildStats(db: Db, userId: string): Promise<Stats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [totals, recent, itemCount, topItems, lowStock, bladeLife] =
    await Promise.all([
      countShaves(db, userId),
      countShaves(db, userId, thirtyDaysAgo),
      countItems(db, userId),
      loadTopItems(db, userId),
      loadLowStock(db, userId),
      loadBladeLife(db, userId),
    ]);

  return {
    totalShaves: totals,
    shavesLast30Days: recent,
    itemCount,
    bladeLife,
    topItems,
    lowStock,
  };
}

async function countShaves(
  db: Db,
  userId: string,
  since?: Date,
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(shave)
    .where(
      since
        ? and(eq(shave.userId, userId), gte(shave.shavedAt, since))
        : eq(shave.userId, userId),
    );
  return rows[0]?.n ?? 0;
}

async function countItems(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(item)
    .where(and(eq(item.userId, userId), eq(item.status, "active")));
  return rows[0]?.n ?? 0;
}

async function loadTopItems(db: Db, userId: string): Promise<TopItem[]> {
  const rows = await db
    .select({
      itemId: item.id,
      category: item.category,
      brand: item.brand,
      name: item.name,
      usesCount: sql<number>`count(${shaveItem.shaveId})`,
    })
    .from(item)
    .innerJoin(shaveItem, eq(shaveItem.itemId, item.id))
    .where(eq(item.userId, userId))
    .groupBy(item.id)
    .orderBy(sql`count(${shaveItem.shaveId}) desc`)
    .limit(8);

  return rows;
}

async function loadLowStock(db: Db, userId: string): Promise<LowStockItem[]> {
  return db
    .select({
      itemId: item.id,
      category: item.category,
      brand: item.brand,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    })
    .from(item)
    .where(
      and(
        eq(item.userId, userId),
        eq(item.status, "active"),
        inArray(item.category, [...CONSUMABLE_CATEGORIES]),
        sql`${item.quantity} <= ${LOW_STOCK_THRESHOLD}`,
      ),
    )
    .orderBy(asc(item.quantity))
    .limit(12);
}

/**
 * 平均壽命只能用「已經換掉」的刀片來算 —— 目前這一片還沒用完，
 * 把它算進去會把平均拉低。
 *
 * 換刀時間 t1 < t2 < … < tn 把歷史切成 n 段已完成 + 1 段進行中：
 *   已完成的刮鬍次數 = shaved_at < tn 的筆數
 *   平均 = 已完成次數 / n
 *
 * 資料量是個人規模（幾支刀、數百筆日誌），在 JS 裡算比寫成一坨 SQL 清楚得多。
 */
async function loadBladeLife(db: Db, userId: string): Promise<BladeLife[]> {
  const blades = await db
    .select({
      id: item.id,
      brand: item.brand,
      name: item.name,
      quantity: item.quantity,
    })
    .from(item)
    .where(and(eq(item.userId, userId), eq(item.category, "blade")));

  if (blades.length === 0) return [];

  const bladeIds = blades.map((b) => b.id);

  const [swaps, uses] = await Promise.all([
    db
      .select({ itemId: bladeSwap.itemId, installedAt: bladeSwap.installedAt })
      .from(bladeSwap)
      .where(inArray(bladeSwap.itemId, bladeIds)),
    db
      .select({ itemId: shaveItem.itemId, shavedAt: shave.shavedAt })
      .from(shaveItem)
      .innerJoin(shave, eq(shave.id, shaveItem.shaveId))
      .where(
        and(eq(shave.userId, userId), inArray(shaveItem.itemId, bladeIds)),
      ),
  ]);

  const swapsByItem = groupBy(swaps, (s) => s.itemId);
  const usesByItem = groupBy(uses, (u) => u.itemId);

  return blades.map((blade) => {
    const swapTimes = (swapsByItem.get(blade.id) ?? [])
      .map((s) => s.installedAt.getTime())
      .sort((a, b) => a - b);
    const shaveTimes = (usesByItem.get(blade.id) ?? []).map((u) =>
      u.shavedAt.getTime(),
    );

    const lastSwap = swapTimes.at(-1);
    const completedRuns = swapTimes.length;

    const completedShaves =
      lastSwap === undefined
        ? 0
        : shaveTimes.filter((t) => t < lastSwap).length;
    const currentRunShaves =
      lastSwap === undefined
        ? shaveTimes.length
        : shaveTimes.filter((t) => t >= lastSwap).length;

    return {
      itemId: blade.id,
      brand: blade.brand,
      name: blade.name,
      completedRuns,
      averageShaves:
        completedRuns > 0
          ? Math.round((completedShaves / completedRuns) * 10) / 10
          : null,
      currentRunShaves,
      quantityLeft: blade.quantity,
    };
  });
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const bucket = map.get(key(row)) ?? [];
    bucket.push(row);
    map.set(key(row), bucket);
  }
  return map;
}
