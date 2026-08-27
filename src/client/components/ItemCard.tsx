import { Link } from "react-router";
import {
  CATEGORY_LABELS,
  tracksIndividualUnits,
} from "@/shared/domain";
import type { ItemDTO } from "@/shared/dto";
import { CategoryIcon } from "./CategoryIcon";

export function ItemCard({ item }: { item: ItemDTO }) {
  const showBladeCounter = tracksIndividualUnits(item.category);

  return (
    <Link
      to={`/den/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-(--color-line) bg-(--color-surface) transition hover:border-(--color-brass)"
    >
      <div className="relative aspect-square overflow-hidden bg-(--color-paper)">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-(--color-ink-faint)">
            <CategoryIcon category={item.category} className="size-14" />
          </div>
        )}

        {item.status !== "active" && (
          <span className="absolute top-2 left-2 rounded-md bg-(--color-ink)/80 px-1.5 py-0.5 text-[11px] font-medium text-(--color-paper)">
            {item.status === "finished" ? "已用完" : "want list"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="text-[11px] tracking-wide text-(--color-ink-faint)">
          {CATEGORY_LABELS[item.category]}
        </span>
        <span className="text-sm leading-snug font-medium text-(--color-ink)">
          {item.name}
        </span>
        <span className="text-xs text-(--color-ink-soft)">{item.brand}</span>

        {item.scentNotes && (
          <span className="line-clamp-1 text-xs text-(--color-ink-faint)">
            {item.scentNotes}
          </span>
        )}

        <div className="mt-auto flex items-baseline gap-2 pt-2 text-xs text-(--color-ink-soft)">
          <span className="tabular-nums">
            庫存 {item.quantity} {item.unit}
          </span>
          <span className="text-(--color-line)">·</span>
          <span className="tabular-nums">
            {showBladeCounter
              ? `這片用了 ${item.currentUnitUses} 次`
              : `用過 ${item.usesCount} 次`}
          </span>
        </div>
      </div>
    </Link>
  );
}
