import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { ItemCard } from "../components/ItemCard";
import { Spinner } from "../components/Spinner";
import { Button, EmptyState, ErrorNote, Input, cx } from "../components/ui";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  type ItemCategory,
} from "@/shared/domain";
import type { ItemDTO } from "@/shared/dto";

export function Den() {
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [q, setQ] = useState("");

  // 一次抓齊，篩選與搜尋都在前端做。個人收藏是數十項的量級，
  // 換來的是按鈕上直接有數量、切換分類零延遲、也不會每點一次就打一次 API。
  const items = useQuery({ queryKey: ["items"], queryFn: () => api.listItems() });

  const all = items.data?.items;

  const counts = useMemo(() => {
    const map = new Map<ItemCategory, number>();
    for (const it of all ?? []) {
      map.set(it.category, (map.get(it.category) ?? 0) + 1);
    }
    return map;
  }, [all]);

  const visible = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLowerCase();
    return all.filter((it) => {
      if (category && it.category !== category) return false;
      if (!needle) return true;
      return matches(it, needle);
    });
  }, [all, category, q]);

  const filtering = q.trim() !== "" || category !== null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">收藏</h1>
        <div className="ml-auto flex gap-2">
          <Link to="/den/wheel">
            <Button>轉盤抽籤</Button>
          </Link>
          <Link to="/den/share">
            <Button>分享</Button>
          </Link>
          <Link to="/den/new">
            <Button variant="primary">新增用品</Button>
          </Link>
        </div>
      </div>

      {items.isPending && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {items.isError && <ErrorNote>讀取收藏失敗，請重新整理。</ErrorNote>}

      {all && (
        <>
          {all.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={category === null}
                  count={all.length}
                  onClick={() => setCategory(null)}
                >
                  全部
                </FilterButton>
                {ITEM_CATEGORIES.filter((c) => counts.has(c)).map((c) => (
                  <FilterButton
                    key={c}
                    active={category === c}
                    count={counts.get(c) ?? 0}
                    icon={<CategoryIcon category={c} className="size-4" />}
                    onClick={() => setCategory(category === c ? null : c)}
                  >
                    {CATEGORY_LABELS[c]}
                  </FilterButton>
                ))}
              </div>

              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜尋品牌、品名或氣味…"
                className="max-w-sm"
              />
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState
              title={filtering ? "沒有符合的用品" : "收藏還是空的"}
              description={
                filtering
                  ? "換個關鍵字或分類再找找。"
                  : "把手上的刀片、皂與鬚後水加進來，之後就能開始記錄每次刮鬍。"
              }
              action={
                filtering ? (
                  <Button
                    onClick={() => {
                      setCategory(null);
                      setQ("");
                    }}
                  >
                    清除篩選
                  </Button>
                ) : (
                  <Link to="/den/new">
                    <Button variant="primary">新增第一項</Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function matches(item: ItemDTO, needle: string): boolean {
  return (
    item.brand.toLowerCase().includes(needle) ||
    item.name.toLowerCase().includes(needle) ||
    (item.scentNotes?.toLowerCase().includes(needle) ?? false)
  );
}

function FilterButton({
  active,
  count,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  icon?: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm whitespace-nowrap transition",
        active
          ? "border-(--color-ink) bg-(--color-ink) text-(--color-paper)"
          : "border-(--color-line) bg-(--color-surface) text-(--color-ink) hover:border-(--color-brass)",
      )}
    >
      {icon && (
        <span className={active ? "opacity-70" : "text-(--color-ink-faint)"}>
          {icon}
        </span>
      )}
      {children}
      <span className={cx("tabular-nums", active ? "opacity-60" : "text-(--color-ink-faint)")}>
        {count}
      </span>
    </button>
  );
}
