import type { ImageSource, ItemCategory, ItemStatus } from "./domain";

/**
 * API 對外的資料形狀。時間一律用 epoch ms（number），不用 ISO 字串 ——
 * 前端要排序、比較、丟進 Date 都不必再 parse。
 * 這層存在的意義是不讓 Drizzle 的資料列形狀外洩成公開契約。
 */
export type ItemDTO = {
  id: string;
  category: ItemCategory;
  brand: string;
  name: string;
  scentNotes: string | null;
  notes: string | null;
  quantity: number;
  unit: string;
  status: ItemStatus;
  productUrl: string | null;
  imageUrl: string | null;
  imageSource: ImageSource | null;
  /** 累計使用次數，由刮鬍日誌推導。 */
  usesCount: number;
  /** 目前這一片／這一塊的使用次數（刀片才有意義）。 */
  currentUnitUses: number;
  bladeInstalledAt: number | null;
  /** 僅刀架有意義，見 CATEGORY_ITEM_ATTRIBUTES。 */
  aggressiveness: number | null;
  /** 僅鬚刷有意義，見 CATEGORY_ITEM_ATTRIBUTES。 */
  waterRetention: number | null;
  acquiredAt: number | null;
  createdAt: number;
};

export type ShaveDTO = {
  id: string;
  shavedAt: number;
  /** 感受評分，1–5 且越高越好；未填為 null。對應 SHAVE_RATINGS。 */
  rating: number | null;
  closeness: number | null;
  smoothness: number | null;
  comfort: number | null;
  /** 依用到的品項分類加碼的評分，見 CATEGORY_SHAVE_RATINGS。 */
  latherQuality: number | null;
  moisturizing: number | null;
  scentLongevity: number | null;
  edgeDulling: number | null;
  notes: string | null;
  items: Array<Pick<ItemDTO, "id" | "category" | "brand" | "name" | "imageUrl">>;
  /** 這篇日誌的分享連結 id；未分享過為 null。 */
  shareId: string | null;
};

export type ImageCandidate = {
  url: string;
  thumbnailUrl: string;
  title: string | null;
  sourcePage: string | null;
};

export type BladeLife = {
  itemId: string;
  brand: string;
  name: string;
  /** 已經用完並換掉的刀片數。0 代表還沒換過，算不出平均。 */
  completedRuns: number;
  /** 每片平均能刮幾次，只計算已經換掉的刀片。 */
  averageShaves: number | null;
  /** 目前這一片已經用了幾次。 */
  currentRunShaves: number;
  quantityLeft: number;
};

export type TopItem = {
  itemId: string;
  category: ItemCategory;
  brand: string;
  name: string;
  usesCount: number;
};

export type LowStockItem = {
  itemId: string;
  category: ItemCategory;
  brand: string;
  name: string;
  quantity: number;
  unit: string;
};

export type Stats = {
  totalShaves: number;
  shavesLast30Days: number;
  itemCount: number;
  bladeLife: BladeLife[];
  topItems: TopItem[];
  lowStock: LowStockItem[];
};

export type ShareDTO = {
  id: string;
  createdAt: number;
  itemCount: number;
};

/** 公開分享頁看得到的品項細節，刻意不含 userId 等內部欄位。 */
export type PublicShareItemDTO = Pick<
  ItemDTO,
  | "id"
  | "category"
  | "brand"
  | "name"
  | "scentNotes"
  | "notes"
  | "quantity"
  | "unit"
  | "status"
  | "productUrl"
  | "imageUrl"
  | "usesCount"
  | "currentUnitUses"
  | "acquiredAt"
  | "aggressiveness"
  | "waterRetention"
>;

export type PublicShareDTO = {
  id: string;
  ownerName: string;
  createdAt: number;
  items: PublicShareItemDTO[];
};

/** 公開日誌分享頁看得到的細節。 */
export type PublicShaveDTO = {
  id: string;
  ownerName: string;
  shavedAt: number;
  rating: number | null;
  closeness: number | null;
  smoothness: number | null;
  comfort: number | null;
  latherQuality: number | null;
  moisturizing: number | null;
  scentLongevity: number | null;
  edgeDulling: number | null;
  notes: string | null;
  items: Array<Pick<ItemDTO, "id" | "category" | "brand" | "name" | "imageUrl">>;
};
