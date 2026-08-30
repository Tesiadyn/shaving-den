import { useMemo, useRef, useState, type TransitionEvent } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { ItemThumb } from "../components/ItemThumb";
import { Spinner } from "../components/Spinner";
import { Button, EmptyState, ErrorNote, cx } from "../components/ui";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  type ItemCategory,
} from "@/shared/domain";
import type { ItemDTO } from "@/shared/dto";

/** 轉盤只用兩色交替上色，靠分隔線與編號辨識每一格，不在轉動中的扇形上放文字。 */
const SLICE_COLORS = ["var(--color-brass)", "var(--color-brass-soft)"];
const SLICE_TEXT_COLORS = ["var(--color-paper)", "var(--color-ink)"];

export function Wheel() {
  const items = useQuery({
    queryKey: ["items", { status: "active" }],
    queryFn: () => api.listItems({ status: "active" }),
  });

  if (items.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (items.isError) {
    return <ErrorNote>讀取收藏失敗，請重新整理。</ErrorNote>;
  }

  return <WheelGame items={items.data.items} />;
}

function WheelGame({ items }: { items: ItemDTO[] }) {
  const byCategory = useMemo(() => {
    const map = new Map<ItemCategory, ItemDTO[]>();
    for (const it of items) {
      const bucket = map.get(it.category) ?? [];
      bucket.push(it);
      map.set(it.category, bucket);
    }
    return map;
  }, [items]);

  // 至少要有兩項「使用中」的品項才玩得起來，同一分類才會混進同一個轉盤。
  const eligibleCategories = ITEM_CATEGORIES.filter(
    (c) => (byCategory.get(c)?.length ?? 0) >= 2,
  );

  const [category, setCategory] = useState<ItemCategory | null>(
    eligibleCategories.includes("soap")
      ? "soap"
      : (eligibleCategories[0] ?? null),
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<ItemDTO | null>(null);
  const [rotation, setRotation] = useState(0);

  const rotationRef = useRef(0);
  const pendingWinnerRef = useRef<ItemDTO | null>(null);

  const options = category ? (byCategory.get(category) ?? []) : [];
  const selectedItems = options.filter((it) => selected.has(it.id));
  const canSpin = selectedItems.length >= 2 && !spinning;

  if (eligibleCategories.length === 0) {
    return (
      <EmptyState
        title="還不能玩轉盤"
        description="同一個分類至少要有兩項「使用中」的用品才能抽籤，先去收藏加一些吧。"
        action={
          <Link to="/den/new">
            <Button variant="primary">新增用品</Button>
          </Link>
        }
      />
    );
  }

  function chooseCategory(c: ItemCategory) {
    setCategory(c);
    setSelected(new Set());
    setResult(null);
  }

  function toggle(id: string) {
    setResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function spin() {
    if (selectedItems.length < 2 || spinning) return;

    const winnerIndex = Math.floor(Math.random() * selectedItems.length);
    const winner = selectedItems[winnerIndex];
    if (!winner) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setResult(winner);
      return;
    }

    // 解一個「轉到第幾度，指針才會停在得獎格正中央」的角度，
    // 再疊加幾圈整轉讓動畫看起來像真的在轉，而不是瞬間跳過去。
    const sliceDeg = 360 / selectedItems.length;
    const targetCenter = winnerIndex * sliceDeg + sliceDeg / 2;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const desiredMod = (360 - targetCenter) % 360;
    const delta = (desiredMod - currentMod + 360) % 360;
    const spins = 5;
    const next = rotationRef.current + spins * 360 + delta;

    pendingWinnerRef.current = winner;
    rotationRef.current = next;
    setResult(null);
    setSpinning(true);
    setRotation(next);
  }

  function handleTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    setSpinning(false);
    setResult(pendingWinnerRef.current);
    pendingWinnerRef.current = null;
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">轉盤抽籤</h1>
      <p className="mb-6 text-sm text-(--color-ink-soft)">
        選同一分類的兩項以上，轉一下決定今天用哪個。
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {eligibleCategories.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => chooseCategory(c)}
            className={cx(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition",
              category === c
                ? "border-(--color-ink) bg-(--color-ink) text-(--color-paper)"
                : "border-(--color-line) bg-(--color-surface) text-(--color-ink) hover:border-(--color-brass)",
            )}
          >
            <CategoryIcon
              category={c}
              className={cx(
                "size-4",
                category === c ? "opacity-70" : "text-(--color-ink-faint)",
              )}
            />
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-(--color-ink-soft)">
          {selectedItems.length > 0
            ? `已選 ${selectedItems.length} 項`
            : "選要放進轉盤的品項"}
        </span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setResult(null);
            }}
            className="text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
          >
            清除選取
          </button>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((it) => {
          const on = selected.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(it.id)}
              className={cx(
                "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition",
                on
                  ? "border-(--color-brass) bg-(--color-brass-soft)"
                  : "border-(--color-line) bg-(--color-surface) hover:border-(--color-brass)",
              )}
            >
              <ItemThumb
                category={it.category}
                imageUrl={it.imageUrl}
                className="size-9"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-(--color-ink-soft)">
                  {it.brand}
                </span>
                <span className="block truncate text-sm">{it.name}</span>
              </span>
              <span
                aria-hidden
                className={cx(
                  "size-4 shrink-0 rounded-full border transition",
                  on
                    ? "border-(--color-brass) bg-(--color-brass)"
                    : "border-(--color-line)",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative size-64 shrink-0">
          <div
            aria-hidden
            className="absolute left-1/2 z-10 -translate-x-1/2"
            style={{
              top: -6,
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "16px solid var(--color-ink)",
            }}
          />

          <div
            onTransitionEnd={handleTransitionEnd}
            className="size-full rounded-full border-4 border-(--color-surface) shadow-md"
            style={{
              background: selectedItems.length
                ? wheelBackground(selectedItems.length)
                : "var(--color-line)",
              transform: `rotate(${rotation}deg)`,
              transition: "transform 4.2s cubic-bezier(0.15, 0.6, 0.1, 1)",
            }}
          >
            {selectedItems.map((it, i) => {
              const sliceDeg = 360 / selectedItems.length;
              const angle = i * sliceDeg + sliceDeg / 2;
              return (
                <div
                  key={it.id}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <span
                    className="absolute left-1/2 top-[12%] flex size-6 -translate-x-1/2 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{
                      background: SLICE_COLORS[i % 2],
                      color: SLICE_TEXT_COLORS[i % 2],
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="size-5 rounded-full border-2 border-(--color-surface) bg-(--color-ink)" />
          </div>
        </div>

        <Button variant="primary" onClick={spin} disabled={!canSpin}>
          {spinning ? "轉動中…" : "轉一下"}
        </Button>

        {selectedItems.length > 0 && (
          <ol className="w-full space-y-1.5 text-sm">
            {selectedItems.map((it, i) => (
              <li
                key={it.id}
                className="flex items-center gap-2 text-(--color-ink-soft)"
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: SLICE_COLORS[i % 2],
                    color: SLICE_TEXT_COLORS[i % 2],
                  }}
                >
                  {i + 1}
                </span>
                <span className="truncate">
                  {it.brand} · {it.name}
                </span>
              </li>
            ))}
          </ol>
        )}

        {result && (
          <div className="w-full animate-rise-fade rounded-xl border border-(--color-brass) bg-(--color-brass-soft) px-4 py-3.5 text-center">
            <p className="text-xs text-(--color-ink-soft)">今天就決定用</p>
            <p className="mt-1 text-base font-semibold text-(--color-ink)">
              {result.brand} · {result.name}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Link to={`/den/${result.id}`}>
                <Button>看這個品項</Button>
              </Link>
              <Link to="/shaves/new">
                <Button variant="primary">記一次刮鬍</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function wheelBackground(n: number): string {
  const sliceDeg = 360 / n;
  const stops = Array.from({ length: n }, (_, i) => {
    const color = SLICE_COLORS[i % 2];
    return `${color} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`;
  }).join(", ");
  const lines = `repeating-conic-gradient(from 0deg, var(--color-line) 0deg 1deg, transparent 1deg ${sliceDeg}deg)`;
  return `${lines}, conic-gradient(from 0deg, ${stops})`;
}
