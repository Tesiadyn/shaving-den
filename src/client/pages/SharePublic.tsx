import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { Spinner } from "../components/Spinner";
import { Card, EmptyState } from "../components/ui";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  tracksIndividualUnits,
} from "@/shared/domain";
import type { PublicShareDTO, PublicShareItemDTO } from "@/shared/dto";
import { formatDate } from "../lib/format";

/** 公開分享頁：不套用 AuthGate／Layout，任何人拿著連結都能開。 */
export function SharePublic() {
  const params = useParams();
  const shareId = params.shareId as string;

  const query = useQuery({
    queryKey: ["public-share", shareId],
    queryFn: () => api.getPublicShare(shareId),
    retry: false,
  });

  return (
    <div className="min-h-full">
      <header className="border-b border-(--color-line)">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-(--color-ink)"
          >
            Shaving Den
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
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

        {query.data && <Content share={query.data.share} />}
      </div>
    </div>
  );
}

function Content({ share }: { share: PublicShareDTO }) {
  return (
    <div>
      <div className="animate-rise-fade mb-10 text-center">
        <p className="text-[11px] tracking-[0.2em] text-(--color-ink-faint) uppercase">
          Wet Shaving Collection
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-(--color-ink)">
          {share.ownerName} 的濕刮收藏
        </h1>
        <div className="mx-auto mt-4 h-px w-16 bg-(--color-brass)" />
        <p className="mt-3 text-xs text-(--color-ink-faint)">
          分享於 {formatDate(share.createdAt)} · 共 {share.items.length} 項
        </p>
      </div>

      {share.items.length === 0 ? (
        <EmptyState title="這份分享目前是空的" />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {share.items.map((item, i) => (
            <PublicItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function PublicItemCard({
  item,
  index,
}: {
  item: PublicShareItemDTO;
  index: number;
}) {
  const isBlade = tracksIndividualUnits(item.category);

  return (
    <Card
      className="animate-rise-fade overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}
    >
      <div className="aspect-square bg-(--color-paper)">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-(--color-ink-faint)">
            <CategoryIcon category={item.category} className="size-16" />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-[11px] tracking-wide text-(--color-ink-faint)">
          {CATEGORY_LABELS[item.category]}
          {item.status !== "active" && ` · ${STATUS_LABELS[item.status]}`}
        </p>
        <h2 className="mt-1 text-base leading-snug font-semibold tracking-tight text-(--color-ink)">
          {item.name}
        </h2>
        <p className="text-sm text-(--color-ink-soft)">{item.brand}</p>

        {item.scentNotes && (
          <p className="mt-3 text-xs leading-relaxed text-(--color-ink-soft)">
            <span className="text-(--color-ink-faint)">氣味　</span>
            {item.scentNotes}
          </p>
        )}

        {item.notes && (
          <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-(--color-ink-soft)">
            {item.notes}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-(--color-line) pt-3 text-xs text-(--color-ink-faint)">
          <span className="tabular-nums">
            庫存 {item.quantity} {item.unit}
          </span>
          <span className="tabular-nums">
            {isBlade
              ? `這片用了 ${item.currentUnitUses} 次`
              : `用過 ${item.usesCount} 次`}
          </span>
        </div>
      </div>
    </Card>
  );
}
