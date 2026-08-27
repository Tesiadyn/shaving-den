import type { ItemWithUses } from "@/db/queries";
import type { ShaveRow } from "@/db/shave-queries";
import { keyVersion } from "@/server/images/store";
import type { ItemDTO, ShaveDTO } from "@/shared/dto";

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
