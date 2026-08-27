import { Link } from "react-router";
import { CATEGORY_LABELS, ITEM_CATEGORIES } from "@/shared/domain";
import type { ShaveDTO } from "@/shared/dto";
import { formatDate, relativeDays } from "../lib/format";
import { CategoryIcon } from "./CategoryIcon";
import { Card } from "./ui";

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

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{formatDate(shave.shavedAt)}</span>
        <span className="text-xs text-(--color-ink-faint)">
          {relativeDays(shave.shavedAt)}
        </span>
        {shave.rating !== null && (
          <span
            className="text-xs text-(--color-brass)"
            aria-label={`評分 ${shave.rating} 分，滿分 5 分`}
          >
            {"●".repeat(shave.rating)}
            <span className="text-(--color-line)">
              {"●".repeat(5 - shave.rating)}
            </span>
          </span>
        )}
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

      <ul className="mt-3 space-y-1.5">
        {ordered.map((it) => (
          <li key={it.id} className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-(--color-line) bg-(--color-paper) text-(--color-ink-faint)">
              {it.imageUrl ? (
                <img
                  src={it.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <CategoryIcon category={it.category} className="size-4.5" />
              )}
            </span>
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
