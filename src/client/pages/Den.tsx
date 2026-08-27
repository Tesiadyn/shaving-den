import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ItemCard } from "../components/ItemCard";
import { Spinner } from "../components/Spinner";
import { Button, EmptyState, ErrorNote, Input, cx } from "../components/ui";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  type ItemCategory,
} from "@/shared/domain";

export function Den() {
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [q, setQ] = useState("");

  const items = useQuery({
    queryKey: ["items", { category, q }],
    queryFn: () =>
      api.listItems({
        ...(category ? { category } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      }),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">收藏</h1>
        <Link to="/den/new" className="ml-auto">
          <Button variant="primary">新增用品</Button>
        </Link>
      </div>

      <div className="mb-6 space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋品牌、品名或氣味…"
          className="max-w-sm"
        />

        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={category === null}
            onClick={() => setCategory(null)}
          >
            全部
          </FilterChip>
          {ITEM_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </FilterChip>
          ))}
        </div>
      </div>

      {items.isPending && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {items.isError && <ErrorNote>讀取收藏失敗，請重新整理。</ErrorNote>}

      {items.data &&
        (items.data.items.length === 0 ? (
          <EmptyState
            title={q || category ? "沒有符合的用品" : "收藏還是空的"}
            description={
              q || category
                ? "換個關鍵字或分類再找找。"
                : "把手上的刀片、皂與鬚後水加進來，之後就能開始記錄每次刮鬍。"
            }
            action={
              !q &&
              !category && (
                <Link to="/den/new">
                  <Button variant="primary">新增第一項</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.data.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-1 text-xs transition",
        active
          ? "bg-(--color-ink) text-(--color-paper)"
          : "border border-(--color-line) text-(--color-ink-soft) hover:border-(--color-brass)",
      )}
    >
      {children}
    </button>
  );
}
