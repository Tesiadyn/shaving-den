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

/** 轉盤兩色交替上色，扇形邊界一律走 SVG path，轉再快也不會糊。 */
const SLICE_COLORS = ["var(--color-brass)", "var(--color-brass-soft)"];
const SLICE_LABEL_COLORS = ["var(--color-paper)", "var(--color-ink)"];

const WHEEL_CENTER = 100;
const WHEEL_RADIUS = 98;

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
  const [spinDurationMs, setSpinDurationMs] = useState(4400);
  const [landKey, setLandKey] = useState(0);

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
    // 圈數與時長都帶一點隨機，每次轉起來的手感才不會一模一樣。
    const sliceDeg = 360 / selectedItems.length;
    const targetCenter = winnerIndex * sliceDeg + sliceDeg / 2;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const desiredMod = (360 - targetCenter) % 360;
    const delta = (desiredMod - currentMod + 360) % 360;
    const spins = 5 + Math.floor(Math.random() * 3);
    const next = rotationRef.current + spins * 360 + delta;

    pendingWinnerRef.current = winner;
    rotationRef.current = next;
    setResult(null);
    setSpinDurationMs(4200 + Math.round(Math.random() * 900));
    setSpinning(true);
    setRotation(next);
  }

  function handleTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    setSpinning(false);
    setResult(pendingWinnerRef.current);
    pendingWinnerRef.current = null;
    setLandKey((k) => k + 1);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 font-serif text-2xl font-semibold tracking-tight">
        轉盤抽籤
      </h1>
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
                ? "border-(--color-brass) bg-(--color-brass) text-(--color-paper)"
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
        <div className="relative mx-auto aspect-square w-full max-w-[21rem]">
          <div
            key={landKey}
            aria-hidden
            className={cx(
              "absolute left-1/2 z-10 -translate-x-1/2",
              landKey > 0 && "animate-wheel-pointer-bounce",
            )}
            style={{
              top: -8,
              width: 0,
              height: 0,
              transformOrigin: "50% 0%",
              borderLeft: "11px solid transparent",
              borderRight: "11px solid transparent",
              borderTop: "18px solid var(--color-ink)",
              filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.25))",
            }}
          />

          <div
            onTransitionEnd={handleTransitionEnd}
            className={cx(
              "size-full rounded-full shadow-lg ring-4 ring-(--color-surface)",
              spinning && "animate-wheel-glow",
            )}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${spinDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              willChange: "transform",
            }}
          >
            <svg
              viewBox="0 0 200 200"
              className="block size-full overflow-visible rounded-full"
            >
              {selectedItems.length >= 2 ? (
                <WheelFace items={selectedItems} />
              ) : (
                <>
                  <circle
                    cx={WHEEL_CENTER}
                    cy={WHEEL_CENTER}
                    r={WHEEL_RADIUS}
                    fill="var(--color-line)"
                  />
                  <text
                    x={WHEEL_CENTER}
                    y={WHEEL_CENTER}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fill="var(--color-ink-faint)"
                  >
                    再選一項才能轉
                  </text>
                </>
              )}
            </svg>
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="size-5 rounded-full border-2 border-(--color-surface) bg-(--color-ink) shadow" />
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
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: SLICE_COLORS[i % 2] }}
                />
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

/** 每個扇形一律用 SVG path 算，圖片與品名貼著半徑放（像實體轉盤一樣沿著扇形轉），
 * 這樣不管有幾格都不會互相疊字，也不用另外處理旋轉後文字倒著讀的問題。 */
function WheelFace({ items }: { items: ItemDTO[] }) {
  const n = items.length;
  const sliceDeg = 360 / n;
  const contentRadius = 60;
  const halfChord =
    contentRadius * Math.sin((sliceDeg * Math.PI) / 360) * 2 - 6;
  const boxWidth = Math.max(24, Math.min(56, halfChord));
  const compact = boxWidth < 34;

  return (
    <>
      {items.map((it, i) => (
        <path
          key={it.id}
          d={slicePath(i, n)}
          fill={SLICE_COLORS[i % 2]}
          stroke="var(--color-surface)"
          strokeWidth={2.5}
        />
      ))}
      <circle
        cx={WHEEL_CENTER}
        cy={WHEEL_CENTER}
        r={WHEEL_RADIUS}
        fill="none"
        stroke="var(--color-surface)"
        strokeWidth={3}
      />
      {items.map((it, i) => {
        const angle = i * sliceDeg + sliceDeg / 2;
        return (
          <g key={it.id} transform={`rotate(${angle} ${WHEEL_CENTER} ${WHEEL_CENTER})`}>
            <foreignObject
              x={WHEEL_CENTER - boxWidth / 2}
              y={14}
              width={boxWidth}
              height={70}
            >
              <div
                {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
                className="flex flex-col items-center gap-1"
              >
                <ItemThumb
                  category={it.category}
                  imageUrl={it.imageUrl}
                  className={compact ? "size-7" : "size-9"}
                />
                <span
                  className="max-w-full truncate text-center leading-tight font-semibold"
                  style={{
                    color: SLICE_LABEL_COLORS[i % 2],
                    fontSize: compact ? "6px" : "7.5px",
                  }}
                >
                  {it.name}
                </span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </>
  );
}

function slicePath(index: number, total: number): string {
  const sliceDeg = 360 / total;
  const toXY = (deg: number): readonly [number, number] => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [
      WHEEL_CENTER + WHEEL_RADIUS * Math.cos(rad),
      WHEEL_CENTER + WHEEL_RADIUS * Math.sin(rad),
    ];
  };
  const [x1, y1] = toXY(index * sliceDeg);
  const [x2, y2] = toXY((index + 1) * sliceDeg);
  const largeArc = sliceDeg > 180 ? 1 : 0;
  return `M ${WHEEL_CENTER} ${WHEEL_CENTER} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}
