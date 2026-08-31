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

/** 一組 1–5 分量表的共同形狀，`low`/`high` 是量表兩端的文字說明。 */
export type RatingScale<K extends string = string> = {
  key: K;
  label: string;
  low: string;
  high: string;
};

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
export const SHAVE_RATINGS: readonly RatingScale<
  "rating" | "closeness" | "smoothness" | "comfort"
>[] = [
  { key: "rating", label: "整體", low: "不滿意", high: "很滿意" },
  { key: "closeness", label: "刮淨度", low: "沒刮乾淨", high: "非常乾淨" },
  { key: "smoothness", label: "滑順度", low: "澀、拖刀", high: "順到底" },
  { key: "comfort", label: "舒適度", low: "刮傷、刺痛", high: "完全無感" },
];

export type ShaveRatingKey = (typeof SHAVE_RATINGS)[number]["key"];

/**
 * 依這次刮鬍用到的品項分類而定的加碼評分，同樣 1–5 分、越高越好。
 * 只有選到對應分類的品項時，表單才會多顯示這些欄位。
 */
export const CATEGORY_SHAVE_RATINGS = {
  soap: [
    { key: "latherQuality", label: "起泡力", low: "很難打出泡", high: "輕鬆厚綿泡" },
    { key: "moisturizing", label: "保濕度", low: "乾澀緊繃", high: "滋潤服貼" },
  ],
  aftershave: [
    { key: "scentLongevity", label: "香味持久度", low: "很快就沒味道", high: "整天都聞得到" },
  ],
  blade: [
    { key: "edgeDulling", label: "鋒利度衰退", low: "明顯變鈍", high: "跟新的一樣利" },
  ],
} as const satisfies Partial<Record<ItemCategory, readonly RatingScale[]>>;

export type ExtraShaveRatingKey =
  (typeof CATEGORY_SHAVE_RATINGS)[keyof typeof CATEGORY_SHAVE_RATINGS][number]["key"];
export type AnyShaveRatingKey = ShaveRatingKey | ExtraShaveRatingKey;

/**
 * 依分類查表，回傳該分類的量表清單（沒有就是空陣列）。
 *
 * `CATEGORY_SHAVE_RATINGS`／`CATEGORY_ITEM_ATTRIBUTES` 都用 `as const satisfies` 宣告，
 * 只列出實際用到的分類，型別上不是每個 `ItemCategory` 都有對應屬性；直接以任意
 * `ItemCategory` 索引會被 TS 擋下。這個 helper 把參數型別放寬成完整的
 * `Partial<Record<ItemCategory, ...>>` 讓索引安全，呼叫端仍傳原本較窄的常數即可。
 */
function scalesForCategory(
  registry: Partial<Record<ItemCategory, readonly RatingScale[]>>,
  category: ItemCategory,
): readonly RatingScale[] {
  return registry[category] ?? [];
}

/** 固定四項 + 這次用到的分類各自加碼的項目，用 key 去重。 */
export function shaveRatingsFor(
  categories: Iterable<ItemCategory>,
): RatingScale<AnyShaveRatingKey>[] {
  const scales = new Map<string, RatingScale>();
  for (const scale of SHAVE_RATINGS) scales.set(scale.key, scale);
  for (const category of categories) {
    for (const scale of scalesForCategory(CATEGORY_SHAVE_RATINGS, category)) {
      scales.set(scale.key, scale);
    }
  }
  return [...scales.values()] as RatingScale<AnyShaveRatingKey>[];
}

/**
 * 品項固有屬性：建立/編輯品項時填一次，掛在品項本身而非每篇刮鬍日誌。
 * 依分類決定要不要顯示，同樣是 1–5 分、越高越好。
 */
export const CATEGORY_ITEM_ATTRIBUTES = {
  razor: [{ key: "aggressiveness", label: "兇猛度", low: "新手向", high: "老手向" }],
  brush: [{ key: "waterRetention", label: "含水量", low: "少", high: "多" }],
} as const satisfies Partial<Record<ItemCategory, readonly RatingScale[]>>;

export type ItemAttributeKey =
  (typeof CATEGORY_ITEM_ATTRIBUTES)[keyof typeof CATEGORY_ITEM_ATTRIBUTES][number]["key"];

/** 這個分類該顯示哪些品項固有屬性（沒有就是空陣列）。 */
export function itemAttributesFor(
  category: ItemCategory,
): readonly RatingScale<ItemAttributeKey>[] {
  return scalesForCategory(CATEGORY_ITEM_ATTRIBUTES, category) as readonly RatingScale<ItemAttributeKey>[];
}
