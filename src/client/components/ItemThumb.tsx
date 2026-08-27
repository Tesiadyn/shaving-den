import type { ItemCategory } from "@/shared/domain";
import { CategoryIcon } from "./CategoryIcon";
import { cx } from "./ui";

/** 品項的小方圖：有圖就顯示圖，沒圖退回分類圖示。 */
export function ItemThumb({
  category,
  imageUrl,
  className,
}: {
  category: ItemCategory;
  imageUrl: string | null;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-(--color-line) bg-(--color-paper) text-(--color-ink-faint)",
        className ?? "size-8",
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <CategoryIcon category={category} className="size-4.5" />
      )}
    </span>
  );
}
