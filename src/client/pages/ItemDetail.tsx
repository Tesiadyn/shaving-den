import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { ImagePicker } from "../components/ImagePicker";
import { Spinner } from "../components/Spinner";
import { ShaveEntry } from "../components/ShaveEntry";
import { Button, Card, ErrorNote } from "../components/ui";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  tracksIndividualUnits,
} from "@/shared/domain";
import type { ItemDTO } from "@/shared/dto";
import { fromDateInputValue, toDateInputValue } from "../lib/format";

export function ItemDetail() {
  const params = useParams();
  const itemId = params.itemId as string;

  const query = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => api.getItem(itemId),
  });

  if (query.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-4">
        <ErrorNote>找不到這項用品，可能已經被刪除。</ErrorNote>
        <Link to="/den">
          <Button>回到收藏</Button>
        </Link>
      </div>
    );
  }

  return <Detail item={query.data.item} />;
}

function Detail({ item }: { item: ItemDTO }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isBlade = tracksIndividualUnits(item.category);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["item", item.id] });
  }

  const installBlade = useMutation({
    mutationFn: () =>
      api.installBlade(item.id, fromDateInputValue(toDateInputValue(Date.now()))),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError && err.message === "out_of_stock"
          ? "庫存已經是 0，先補貨再換新的一片。"
          : "換刀片失敗，請再試一次。",
      );
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      navigate("/den");
    },
    onError: () => setError("刪除失敗，請再試一次。"),
  });

  return (
    <div>
      <Link
        to="/den"
        className="mb-5 inline-block text-sm text-(--color-ink-soft) transition hover:text-(--color-ink)"
      >
        ← 收藏
      </Link>

      <div className="grid gap-8 sm:grid-cols-[minmax(0,260px)_1fr]">
        <div>
          <Card className="overflow-hidden">
            <div className="aspect-square bg-(--color-paper)">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-(--color-ink-faint)">
                  <CategoryIcon category={item.category} className="size-20" />
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0">
          <p className="text-xs tracking-wide text-(--color-ink-faint)">
            {CATEGORY_LABELS[item.category]}
            {item.status !== "active" && ` · ${STATUS_LABELS[item.status]}`}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {item.name}
          </h1>
          <p className="mt-0.5 text-sm text-(--color-ink-soft)">{item.brand}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="庫存"
              value={String(item.quantity)}
              suffix={item.unit}
            />
            <Stat label="總使用次數" value={String(item.usesCount)} suffix="次" />
            {isBlade && (
              <Stat
                label="目前這一片"
                value={String(item.currentUnitUses)}
                suffix="次"
                emphasis
              />
            )}
          </div>

          {isBlade && (
            <div className="mt-4">
              <Button
                onClick={() => installBlade.mutate()}
                disabled={installBlade.isPending || item.quantity === 0}
              >
                {installBlade.isPending ? "更換中…" : "換上新的一片"}
              </Button>
              <p className="mt-1.5 text-xs text-(--color-ink-faint)">
                庫存 −1，使用次數從今天起重新算。
              </p>
            </div>
          )}

          {item.scentNotes && (
            <Section title="氣味">{item.scentNotes}</Section>
          )}
          {item.notes && <Section title="備註">{item.notes}</Section>}

          {item.productUrl && (
            <Section title="商品頁">
              <a
                href={item.productUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all text-(--color-brass) underline-offset-2 hover:underline"
              >
                {item.productUrl}
              </a>
            </Section>
          )}

          {error && (
            <div className="mt-6">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-2 border-t border-(--color-line) pt-6">
            <Link to={`/den/${item.id}/edit`}>
              <Button>編輯</Button>
            </Link>
            {confirmingDelete ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? "刪除中…" : "確定刪除"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  取消
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
                刪除
              </Button>
            )}
          </div>
        </div>
      </div>

      <ImagePicker item={item} />
      <ItemShaveHistory itemId={item.id} />
    </div>
  );
}

function ItemShaveHistory({ itemId }: { itemId: string }) {
  const query = useQuery({
    queryKey: ["item-shaves", itemId],
    queryFn: () => api.itemShaves(itemId),
  });

  if (query.isPending || query.isError) return null;
  if (query.data.shaves.length === 0) return null;

  return (
    <div className="mt-8 border-t border-(--color-line) pt-6">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-(--color-ink-soft)">
        用過它的刮鬍紀錄
      </h2>
      <div className="space-y-3">
        {query.data.shaves.map((shave) => (
          <ShaveEntry key={shave.id} shave={shave} />
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  emphasis,
}: {
  label: string;
  value: string;
  suffix?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border px-3 py-2.5 " +
        (emphasis
          ? "border-(--color-brass) bg-(--color-brass-soft)"
          : "border-(--color-line)")
      }
    >
      <p className="text-[11px] tracking-wide text-(--color-ink-soft)">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-(--color-ink-soft)">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-xs font-medium tracking-wide text-(--color-ink-soft)">
        {title}
      </h2>
      <div className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-(--color-ink)">
        {children}
      </div>
    </div>
  );
}
