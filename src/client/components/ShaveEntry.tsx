import { Link } from "react-router";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  SHAVE_RATINGS,
} from "@/shared/domain";
import type { ShaveDTO } from "@/shared/dto";
import { formatDate, relativeDays } from "../lib/format";
import { ItemThumb } from "./ItemThumb";
import { Card, RatingDots } from "./ui";

export function ShaveEntry({
  shave,
  onDelete,
  deleting,
}: {
  shave: ShaveDTO;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  // 依固定的分類順序排列，讓每一筆日誌讀起來都是同一個順序。
  const ordered = [...shave.items].sort(
    (a, b) =>
      ITEM_CATEGORIES.indexOf(a.category) - ITEM_CATEGORIES.indexOf(b.category),
  );

  const scored = SHAVE_RATINGS.flatMap((scale) => {
    const value = shave[scale.key];
    return value === null ? [] : [{ ...scale, value }];
  });

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{formatDate(shave.shavedAt)}</span>
        <span className="text-xs text-(--color-ink-faint)">
          {relativeDays(shave.shavedAt)}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="ml-auto text-xs text-(--color-ink-faint) transition hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
          >
            {deleting ? "刪除中…" : "刪除"}
          </button>
        )}
      </div>

      {scored.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {scored.map((scale) => (
            <RatingDots
              key={scale.key}
              label={scale.label}
              value={scale.value}
            />
          ))}
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {ordered.map((it) => (
          <li key={it.id} className="flex items-center gap-2.5">
            <ItemThumb category={it.category} imageUrl={it.imageUrl} />
            <span className="w-14 shrink-0 text-[11px] text-(--color-ink-faint)">
              {CATEGORY_LABELS[it.category]}
            </span>
            <Link
              to={`/den/${it.id}`}
              className="min-w-0 truncate text-sm transition hover:text-(--color-brass)"
            >
              <span className="text-(--color-ink-soft)">{it.brand}</span>{" "}
              {it.name}
            </Link>
          </li>
        ))}
      </ul>

      {shave.notes && (
        <p className="mt-3 border-t border-(--color-line) pt-3 text-sm leading-relaxed whitespace-pre-wrap text-(--color-ink-soft)">
          {shave.notes}
        </p>
      )}
    </Card>
  );
}
