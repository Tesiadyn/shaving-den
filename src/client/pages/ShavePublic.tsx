import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { ItemThumb } from "../components/ItemThumb";
import { Spinner } from "../components/Spinner";
import { Card, cx, EmptyState, RatingDots } from "../components/ui";
import { CATEGORY_LABELS, ITEM_CATEGORIES, SHAVE_RATINGS } from "@/shared/domain";
import type { PublicShaveDTO } from "@/shared/dto";
import { formatDate, relativeDays } from "../lib/format";

/** 公開日誌分享頁：不套用 AuthGate／Layout，任何人拿著連結都能開。 */
export function ShavePublic() {
  const params = useParams();
  const shareId = params.shareId as string;

  const query = useQuery({
    queryKey: ["public-shave-share", shareId],
    queryFn: () => api.getPublicShaveShare(shareId),
    retry: false,
  });

  return (
    <div className="min-h-full">
      <header className="border-b border-(--color-line)">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-(--color-ink)"
          >
            Shaving Den
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {query.isPending && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {query.isError && (
          <EmptyState
            title="這個分享連結已經失效"
            description="可能已經被撤銷，或者網址打錯了。"
          />
        )}

        {query.data && <Content shave={query.data.shave} />}
      </div>
    </div>
  );
}

function Content({ shave }: { shave: PublicShaveDTO }) {
  const ordered = [...shave.items].sort(
    (a, b) =>
      ITEM_CATEGORIES.indexOf(a.category) - ITEM_CATEGORIES.indexOf(b.category),
  );

  const scored = SHAVE_RATINGS.flatMap((scale) => {
    const value = shave[scale.key];
    return value === null ? [] : [{ ...scale, value }];
  });

  return (
    <div>
      <div className="animate-rise-fade mb-10 text-center">
        <p className="text-[11px] tracking-[0.2em] text-(--color-ink-faint) uppercase">
          Shave of the Day
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-(--color-ink)">
          {shave.ownerName} 的刮鬍紀錄
        </h1>
        <div className="mx-auto mt-4 h-px w-16 bg-(--color-brass)" />
        <p className="mt-3 text-xs text-(--color-ink-faint)">
          {formatDate(shave.shavedAt)} · {relativeDays(shave.shavedAt)}
        </p>
      </div>

      <Card className="animate-rise-fade p-5">
        {scored.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {scored.map((scale) => (
              <RatingDots key={scale.key} label={scale.label} value={scale.value} />
            ))}
          </div>
        )}

        <ul className={cx(scored.length > 0 && "mt-4")}>
          {ordered.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-1.5">
              <ItemThumb category={it.category} imageUrl={it.imageUrl} className="size-9" />
              <span className="w-14 shrink-0 text-[11px] text-(--color-ink-faint)">
                {CATEGORY_LABELS[it.category]}
              </span>
              <span className="min-w-0 truncate text-sm">
                <span className="text-(--color-ink-soft)">{it.brand}</span>{" "}
                {it.name}
              </span>
            </li>
          ))}
        </ul>

        {shave.notes && (
          <p className="mt-4 border-t border-(--color-line) pt-4 text-sm leading-relaxed whitespace-pre-wrap text-(--color-ink-soft)">
            {shave.notes}
          </p>
        )}

        {ordered.length === 0 && scored.length === 0 && !shave.notes && (
          <div className="flex items-center justify-center gap-2 py-6 text-(--color-ink-faint)">
            <CategoryIcon category="other" className="size-5" />
            <span className="text-sm">這篇日誌沒有更多細節</span>
          </div>
        )}
      </Card>
    </div>
  );
}
