import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { Spinner } from "../components/Spinner";
import { Card, EmptyState, ErrorNote } from "../components/ui";
import { CATEGORY_LABELS } from "@/shared/domain";
import type { Stats as StatsDTO } from "@/shared/dto";

export function Stats() {
  const query = useQuery({ queryKey: ["stats"], queryFn: () => api.stats() });

  if (query.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (query.isError) return <ErrorNote>讀取統計失敗，請重新整理。</ErrorNote>;

  const stats = query.data;

  if (stats.totalShaves === 0 && stats.itemCount === 0) {
    return (
      <EmptyState
        title="還沒有東西可以統計"
        description="先建立收藏、記幾次刮鬍，這裡就會長出刀片壽命與使用排行。"
      />
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-semibold tracking-tight">
        統計
      </h1>

      <div className="grid grid-cols-3 gap-3">
        <Headline label="總刮鬍次數" value={stats.totalShaves} />
        <Headline label="近 30 天" value={stats.shavesLast30Days} />
        <Headline label="使用中的用品" value={stats.itemCount} />
      </div>

      <BladeLifeSection bladeLife={stats.bladeLife} />
      <LowStockSection lowStock={stats.lowStock} />
      <TopItemsSection topItems={stats.topItems} />
    </div>
  );
}

function Headline({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] tracking-wide text-(--color-ink-soft)">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="text-sm font-medium">{title}</h2>
      {note && (
        <p className="mt-1 text-xs text-(--color-ink-faint)">{note}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BladeLifeSection({ bladeLife }: { bladeLife: StatsDTO["bladeLife"] }) {
  if (bladeLife.length === 0) return null;

  return (
    <Section
      title="刀片壽命"
      note="平均只計算已經換掉的刀片；目前這一片還沒用完，不列入平均。"
    >
      <Card className="divide-y divide-(--color-line)">
        {bladeLife.map((blade) => (
          <div
            key={blade.itemId}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3"
          >
            <Link
              to={`/den/${blade.itemId}`}
              className="min-w-0 text-sm transition hover:text-(--color-brass)"
            >
              <span className="text-(--color-ink-soft)">{blade.brand}</span>{" "}
              {blade.name}
            </Link>

            <span className="ml-auto text-sm tabular-nums">
              {blade.averageShaves === null ? (
                <span className="text-(--color-ink-faint)">
                  還沒換過刀，算不出平均
                </span>
              ) : (
                <>
                  平均{" "}
                  <strong className="text-(--color-brass)">
                    {blade.averageShaves}
                  </strong>{" "}
                  次／片
                  <span className="ml-1 text-xs text-(--color-ink-faint)">
                    （{blade.completedRuns} 片的紀錄）
                  </span>
                </>
              )}
            </span>

            <span className="w-full text-xs text-(--color-ink-soft) tabular-nums">
              目前這一片已用 {blade.currentRunShaves} 次 · 庫存還剩{" "}
              {blade.quantityLeft} 片
            </span>
          </div>
        ))}
      </Card>
    </Section>
  );
}

function LowStockSection({ lowStock }: { lowStock: StatsDTO["lowStock"] }) {
  if (lowStock.length === 0) return null;

  return (
    <Section title="庫存偏低" note="剩下 3 個單位以內的消耗品。">
      <div className="flex flex-wrap gap-2">
        {lowStock.map((it) => (
          <Link
            key={it.itemId}
            to={`/den/${it.itemId}`}
            className="flex items-center gap-2 rounded-lg border border-(--color-line) px-3 py-2 text-sm transition hover:border-(--color-brass)"
          >
            <CategoryIcon
              category={it.category}
              className="size-4 text-(--color-ink-faint)"
            />
            <span className="text-(--color-ink-soft)">{it.brand}</span>
            <span>{it.name}</span>
            <span
              className={
                "tabular-nums " +
                (it.quantity === 0
                  ? "font-semibold text-red-400"
                  : "text-(--color-brass)")
              }
            >
              {it.quantity} {it.unit}
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function TopItemsSection({ topItems }: { topItems: StatsDTO["topItems"] }) {
  if (topItems.length === 0) return null;

  const max = Math.max(...topItems.map((t) => t.usesCount), 1);

  return (
    <Section title="最常用">
      <Card className="divide-y divide-(--color-line)">
        {topItems.map((it) => (
          <div key={it.itemId} className="px-4 py-2.5">
            <div className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 text-[11px] text-(--color-ink-faint)">
                {CATEGORY_LABELS[it.category]}
              </span>
              <Link
                to={`/den/${it.itemId}`}
                className="min-w-0 truncate text-sm transition hover:text-(--color-brass)"
              >
                <span className="text-(--color-ink-soft)">{it.brand}</span>{" "}
                {it.name}
              </Link>
              <span className="ml-auto text-sm tabular-nums">
                {it.usesCount} 次
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-(--color-line)">
              <div
                className="h-full rounded-full bg-(--color-brass)"
                style={{ width: `${(it.usesCount / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </Card>
    </Section>
  );
}
