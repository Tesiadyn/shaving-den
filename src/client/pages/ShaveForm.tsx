import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Spinner } from "../components/Spinner";
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Select,
  Textarea,
  cx,
} from "../components/ui";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  type ItemCategory,
} from "@/shared/domain";
import type { ItemDTO } from "@/shared/dto";
import { fromDateInputValue, toDateInputValue } from "../lib/format";

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

function Form({ items }: { items: ItemDTO[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(() => toDateInputValue(Date.now()));
  const [picked, setPicked] = useState<Partial<Record<ItemCategory, string>>>(
    {},
  );
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** 只顯示手上真的有東西的分類，表單才不會一整排空下拉。 */
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

  const selectedIds = Object.values(picked).filter(Boolean) as string[];

  const save = useMutation({
    mutationFn: () =>
      api.createShave({
        shavedAt: fromDateInputValue(date),
        rating,
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
    save.mutate();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="max-w-2xl"
    >
      <h1 className="mb-6 text-xl font-semibold tracking-tight">記一次刮鬍</h1>

      <div className="space-y-5">
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
          <legend className="mb-3 text-xs font-medium tracking-wide text-(--color-ink-soft)">
            這次用了什麼
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {byCategory.map(([category, options]) => (
              <Field key={category} label={CATEGORY_LABELS[category]}>
                <Select
                  value={picked[category] ?? ""}
                  onChange={(e) =>
                    setPicked((p) => ({
                      ...p,
                      [category]: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">— 不用 —</option>
                  {options.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.brand} {it.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </fieldset>

        <Field label="評分">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} 分`}
                aria-pressed={rating === n}
                onClick={() => setRating(rating === n ? null : n)}
                className={cx(
                  "size-7 rounded-full border transition",
                  rating !== null && n <= rating
                    ? "border-(--color-brass) bg-(--color-brass)"
                    : "border-(--color-line) hover:border-(--color-brass)",
                )}
              />
            ))}
            {rating !== null && (
              <button
                type="button"
                onClick={() => setRating(null)}
                className="ml-2 text-xs text-(--color-ink-faint) hover:text-(--color-ink)"
              >
                清除
              </button>
            )}
          </div>
        </Field>

        <Field label="心得">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="順不順、有沒有刮傷、泡沫狀況…"
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
