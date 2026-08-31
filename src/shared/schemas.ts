import { z } from "zod";
import { ITEM_CATEGORIES, ITEM_STATUSES } from "./domain";

/** 空字串一律視為「沒填」，存 null，避免資料庫裡出現空字串與 null 兩種空值。 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

/** 感受評分：1–5，越高越好，沒填就是 null。 */
const ratingValue = z.int().min(1).max(5).nullable().default(null);

export const itemInputSchema = z.object({
  category: z.enum(ITEM_CATEGORIES),
  brand: z.string().trim().min(1, "請填品牌").max(80),
  name: z.string().trim().min(1, "請填品名").max(120),
  scentNotes: optionalText(500),
  notes: optionalText(2000),
  quantity: z.int().min(0).max(100_000).default(1),
  unit: z.string().trim().min(1).max(8),
  status: z.enum(ITEM_STATUSES).default("active"),
  productUrl: z
    .union([z.url(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
  acquiredAt: z.int().nullable().default(null),
  /** 僅刀架使用，見 shared/domain 的 CATEGORY_ITEM_ATTRIBUTES。 */
  aggressiveness: ratingValue,
  /** 僅鬚刷使用，見 shared/domain 的 CATEGORY_ITEM_ATTRIBUTES。 */
  waterRetention: ratingValue,
});

export type ItemInput = z.infer<typeof itemInputSchema>;

export const itemPatchSchema = itemInputSchema.partial();
export type ItemPatch = z.infer<typeof itemPatchSchema>;

export const itemListQuerySchema = z.object({
  status: z.enum(ITEM_STATUSES).optional(),
});

export const shaveInputSchema = z.object({
  /** epoch ms；UI 送當天的當地時間 00:00。 */
  shavedAt: z.int(),
  rating: ratingValue,
  closeness: ratingValue,
  smoothness: ratingValue,
  comfort: ratingValue,
  /** 依用到的品項分類加碼的評分，見 shared/domain 的 CATEGORY_SHAVE_RATINGS。 */
  latherQuality: ratingValue,
  moisturizing: ratingValue,
  scentLongevity: ratingValue,
  edgeDulling: ratingValue,
  notes: optionalText(2000),
  itemIds: z.array(z.string().min(1)).min(1, "至少選一項用品").max(12),
});

export type ShaveInput = z.infer<typeof shaveInputSchema>;

/**
 * 換上新的一片刀。
 *
 * 帶的是「日期」而不是伺服器當下的時間戳：刮鬍紀錄存的是當地午夜，
 * 換刀邊界如果用真實時刻，早上換刀、晚上才補登今天的刮鬍就會被算到舊刀片。
 * 兩邊都對齊到日，這類歧義就整類消失。
 */
export const installBladeSchema = z.object({
  /** 當地時區當天 00:00 的 epoch ms。 */
  installedAt: z.int(),
});

export const imageFromUrlSchema = z.object({
  productUrl: z.url(),
});

export const imageSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export const imageSelectSchema = z.object({
  imageUrl: z.url(),
  source: z.enum(["og", "search"]),
});

export const shareInputSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1, "至少選一項用品").max(500),
});

export type ShareInput = z.infer<typeof shareInputSchema>;
