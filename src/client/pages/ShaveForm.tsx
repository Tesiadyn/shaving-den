import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { ItemThumb } from "../components/ItemThumb";
import { Spinner } from "../components/Spinner";
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  RatingInput,
  Textarea,
  cx,
} from "../components/ui";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  shaveRatingsFor,
  type AnyShaveRatingKey,
  type ItemCategory,
} from "@/shared/domain";
import type { ItemDTO } from "@/shared/dto";
import { fromDateInputValue, toDateInputValue } from "../lib/format";

/** 與 shaveInputSchema 的 itemIds 上限一致。 */
const MAX_ITEMS = 12;

export function ShaveForm() {
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

  return <Form items={items.data.items} />;
}

type Ratings = Partial<Record<AnyShaveRatingKey, number | null>>;

const NO_RATINGS: Ratings = {};

function Form({ items }: { items: ItemDTO[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(() => toDateInputValue(Date.now()));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [ratings, setRatings] = useState<Ratings>(NO_RATINGS);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** 只顯示手上真的有東西的分類，表單才不會出現一整排空區塊。 */
  const byCategory = useMemo(() => {
    const map = new Map<ItemCategory, ItemDTO[]>();
    for (const it of items) {
      const bucket = map.get(it.category) ?? [];
      bucket.push(it);
      map.set(it.category, bucket);
    }
    return ITEM_CATEGORIES.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c) as ItemDTO[]] as const,
    );
  }, [items]);

  const selectedIds = [...selected];

  const visibleRatings = useMemo(() => {
    const selectedCategories = items
      .filter((it) => selected.has(it.id))
      .map((it) => it.category);
    return shaveRatingsFor(selectedCategories);
  }, [items, selected]);

  /** 沒被選到的分類就算表單裡還留著舊值，也一律當作沒填送出。 */
  function ratingsPayload() {
    const visibleKeys = new Set<AnyShaveRatingKey>(
      visibleRatings.map((r) => r.key),
    );
    const entries = shaveRatingsFor(ITEM_CATEGORIES).map(
      (r) => [r.key, visibleKeys.has(r.key) ? (ratings[r.key] ?? null) : null] as const,
    );
    return Object.fromEntries(entries) as Record<AnyShaveRatingKey, number | null>;
  }

  function toggle(itemId: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(itemId)) next.add(itemId);
      return next;
    });
  }

  const save = useMutation({
    mutationFn: () =>
      api.createShave({
        shavedAt: fromDateInputValue(date),
        ...ratingsPayload(),
        notes: notes.trim() || null,
        itemIds: selectedIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shaves"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["item"] });
      queryClient.invalidateQueries({ queryKey: ["item-shaves"] });
      navigate("/shaves");
    },
    onError: () => setError("儲存失敗，請再試一次。"),
  });

  if (items.length === 0) {
    return (
      <EmptyState
        title="收藏是空的"
        description="先把手上的刀片與皂加進收藏，才能記錄刮鬍。"
        action={
          <Button variant="primary" onClick={() => navigate("/den/new")}>
            新增用品
          </Button>
        }
      />
    );
  }

  function handleSubmit() {
    setError(null);
    if (selectedIds.length === 0) {
      setError("至少要選一項用品。");
      return;
    }
    if (selectedIds.length > MAX_ITEMS) {
      setError(`一次最多記 ${MAX_ITEMS} 項用品。`);
      return;
    }
    save.mutate();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="max-w-3xl"
    >
      <h1 className="mb-6 font-serif text-2xl font-semibold tracking-tight">
        記一次刮鬍
      </h1>

      <div className="space-y-8">
        <Field label="日期">
          <input
            type="date"
            value={date}
            max={toDateInputValue(Date.now())}
            onChange={(e) => setDate(e.target.value)}
            className="w-full max-w-48 rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm focus:border-(--color-brass) focus:outline-none"
          />
        </Field>

        <fieldset>
          <legend className="text-xs font-medium tracking-wide text-(--color-ink-soft)">
            這次用了什麼
          </legend>
          <p className="mt-1 text-xs text-(--color-ink-faint)">
            點一下選取，再點一下取消。沒用到的分類留空就好；同一個分類要選兩項也可以。
          </p>

          <div className="mt-4 space-y-5">
            {byCategory.map(([category, options]) => {
              const pickedHere = options.filter((it) => selected.has(it.id));
              return (
                <div key={category}>
                  <div className="mb-2 flex items-center gap-2">
                    <CategoryIcon
                      category={category}
                      className="size-4 text-(--color-ink-faint)"
                    />
                    <span className="text-xs font-medium text-(--color-ink-soft)">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-(--color-ink-faint)">
                      {pickedHere.length > 0
                        ? `已選 ${pickedHere.length}`
                        : "未使用"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                            <span className="block truncate text-sm">
                              {it.name}
                            </span>
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
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium tracking-wide text-(--color-ink-soft)">
            這次的感受
          </legend>
          <p className="mt-1 text-xs text-(--color-ink-faint)">
            每一項都是越高越好，不想評的留空就好。
          </p>

          <div className="mt-4 space-y-3">
            {visibleRatings.map((scale) => (
              <RatingInput
                key={scale.key}
                label={scale.label}
                low={scale.low}
                high={scale.high}
                value={ratings[scale.key] ?? null}
                onChange={(value) =>
                  setRatings((prev) => ({ ...prev, [scale.key]: value }))
                }
              />
            ))}
          </div>
        </fieldset>

        <Field label="心得">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="泡沫狀況、刀角度、和上次比起來如何…"
            maxLength={2000}
          />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "儲存中…" : "記下來"}
          </Button>
          <Button onClick={() => navigate(-1)}>取消</Button>
        </div>
      </div>
    </form>
  );
}
