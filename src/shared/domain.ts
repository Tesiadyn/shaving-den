// 前後端共用的領域常數。放在 shared 讓 Zod schema、Drizzle schema、UI 都吃同一份定義。

export const ITEM_CATEGORIES = [
  "blade",
  "soap",
  "preshave",
  "aftershave",
  "brush",
  "razor",
  "other",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  blade: "DE 刀片",
  soap: "刮鬍皂／膏",
  preshave: "鬚前",
  aftershave: "鬚後",
  brush: "鬚刷",
  razor: "刀架",
  other: "其他",
};

/** 每個分類的預設計量單位。 */
export const CATEGORY_UNITS: Record<ItemCategory, string> = {
  blade: "片",
  soap: "塊",
  preshave: "瓶",
  aftershave: "瓶",
  brush: "支",
  razor: "支",
  other: "個",
};

/**
 * 消耗品才需要追蹤庫存與「用完」。刀架與鬚刷是耐久財，
 * 數量固定為 1、也不會有「換新一片」的概念。
 */
export const CONSUMABLE_CATEGORIES: readonly ItemCategory[] = [
  "blade",
  "soap",
  "preshave",
  "aftershave",
  "other",
];

/**
 * 只有 DE 刀片有「同一片重複使用、用鈍了換下一片」的行為，
 * 所以只有它需要 blade_installed_at 與「換新刀片」動作。
 */
export function tracksIndividualUnits(category: ItemCategory): boolean {
  return category === "blade";
}

export const ITEM_STATUSES = ["active", "finished", "wishlist"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const STATUS_LABELS: Record<ItemStatus, string> = {
  active: "使用中",
  finished: "已用完",
  wishlist: "want list",
};

export const IMAGE_SOURCES = ["og", "search", "upload"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

/**
 * 每次刮鬍的感受評分，全部都是 1–5 分。
 *
 * 刻意讓每一項都「越高越好」：同一張表單裡若混著相反方向的量表
 * （一排越多分越棒、下一排越多分越慘），填的時候極容易點反。
 * 所以「刮傷」是用「舒適度」表達 —— 5 分＝完全沒感覺。
 *
 * 這份清單是單一來源：表單的輸入列與日誌的顯示都從這裡長出來，
 * 要增減指標只要改這裡加上對應的欄位。
 */
export const SHAVE_RATINGS = [
  { key: "rating", label: "整體", low: "不滿意", high: "很滿意" },
  { key: "closeness", label: "刮淨度", low: "沒刮乾淨", high: "非常乾淨" },
  { key: "smoothness", label: "滑順度", low: "澀、拖刀", high: "順到底" },
  { key: "comfort", label: "舒適度", low: "刮傷、刺痛", high: "完全無感" },
] as const;

export type ShaveRatingKey = (typeof SHAVE_RATINGS)[number]["key"];
