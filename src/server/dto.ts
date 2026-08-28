import type { ItemWithUses } from "@/db/queries";
import type { ShaveRow } from "@/db/shave-queries";
import type { PublicShare, ShareWithCount } from "@/db/share-queries";
import { keyVersion } from "@/server/images/store";
import type {
  ItemDTO,
  PublicShareDTO,
  ShareDTO,
  ShaveDTO,
} from "@/shared/dto";

/**
 * 圖片一律經由 Worker 供應（要驗身分），不外連原始網址。
 * ?v= 是 R2 key 的版本片段：換圖時網址跟著變，瀏覽器快取自然失效。
 */
function imageUrlFor(itemId: string, imageKey: string | null): string | null {
  return imageKey ? `/api/images/${itemId}?v=${keyVersion(imageKey)}` : null;
}

export function toItemDTO(row: ItemWithUses): ItemDTO {
  return {
    id: row.id,
    category: row.category,
    brand: row.brand,
    name: row.name,
    scentNotes: row.scentNotes,
    notes: row.notes,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status,
    productUrl: row.productUrl,
    imageUrl: imageUrlFor(row.id, row.imageKey),
    imageSource: row.imageSource,
    usesCount: row.usesCount,
    currentUnitUses: row.currentUnitUses,
    bladeInstalledAt: row.bladeInstalledAt?.getTime() ?? null,
    acquiredAt: row.acquiredAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
  };
}

export function toShaveDTO(row: ShaveRow): ShaveDTO {
  return {
    id: row.id,
    shavedAt: row.shavedAt.getTime(),
    rating: row.rating,
    closeness: row.closeness,
    smoothness: row.smoothness,
    comfort: row.comfort,
    notes: row.notes,
    items: row.items.map((i) => ({
      id: i.id,
      category: i.category,
      brand: i.brand,
      name: i.name,
      imageUrl: imageUrlFor(i.id, i.imageKey),
    })),
  };
}

export function toShareDTO(row: ShareWithCount): ShareDTO {
  return {
    id: row.id,
    createdAt: row.createdAt.getTime(),
    itemCount: row.itemCount,
  };
}

/** 公開分享頁的圖片一律走 share 授權邊界，不是 items.ts 那條需要登入的路由。 */
function publicImageUrlFor(
  shareId: string,
  itemId: string,
  imageKey: string | null,
): string | null {
  return imageKey
    ? `/api/public/shares/${shareId}/items/${itemId}/image?v=${keyVersion(imageKey)}`
    : null;
}

export function toPublicShareDTO(row: PublicShare): PublicShareDTO {
  return {
    id: row.id,
    ownerName: row.ownerName,
    createdAt: row.createdAt.getTime(),
    items: row.items.map((it) => ({
      id: it.id,
      category: it.category,
      brand: it.brand,
      name: it.name,
      scentNotes: it.scentNotes,
      notes: it.notes,
      quantity: it.quantity,
      unit: it.unit,
      status: it.status,
      productUrl: it.productUrl,
      imageUrl: publicImageUrlFor(row.id, it.id, it.imageKey),
      usesCount: it.usesCount,
      currentUnitUses: it.currentUnitUses,
      acquiredAt: it.acquiredAt?.getTime() ?? null,
    })),
  };
}
