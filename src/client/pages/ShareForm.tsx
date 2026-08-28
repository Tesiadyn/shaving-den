import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryIcon } from "../components/CategoryIcon";
import { ItemThumb } from "../components/ItemThumb";
import { Spinner } from "../components/Spinner";
import { Button, Card, EmptyState, ErrorNote, cx } from "../components/ui";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  type ItemCategory,
} from "@/shared/domain";
import type { ItemDTO, ShareDTO } from "@/shared/dto";
import { formatDate } from "../lib/format";

export function ShareForm() {
  const items = useQuery({ queryKey: ["items"], queryFn: () => api.listItems() });

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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** 只顯示手上真的有東西的分類，跟記一次刮鬍的表單同一套規則。 */
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

  function toggle(itemId: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(itemId)) next.add(itemId);
      return next;
    });
  }

  const create = useMutation({
    mutationFn: () => api.createShare(selectedIds),
    onSuccess: ({ id }) => {
      setCreatedId(id);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ["shares"] });
    },
    onError: () => setError("建立分享連結失敗，請再試一次。"),
  });

  function startOver() {
    setCreatedId(null);
    setSelected(new Set());
    setError(null);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="收藏是空的"
        description="先把用品加進收藏，才有東西可以分享。"
        action={
          <Link to="/den/new">
            <Button variant="primary">新增用品</Button>
          </Link>
        }
      />
    );
  }

  const shareUrl = createdId
    ? `${window.location.origin}/share/${createdId}`
    : null;
  const canShare = "share" in navigator;

  async function shareOrCopy() {
    if (!shareUrl) return;
    if (canShare) {
      try {
        await navigator.share({ title: "Shaving Den · 分享收藏", url: shareUrl });
        return;
      } catch {
        // 使用者取消系統分享面板，退回複製連結。
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">分享收藏</h1>

      {createdId && shareUrl ? (
        <Card className="animate-rise-fade p-5">
          <p className="text-sm font-medium text-(--color-ink)">連結已經生成</p>
          <p className="mt-1 text-xs text-(--color-ink-soft)">
            拿到這段網址的人不用登入就能看到你選的品項與細節，但沒有任何修改權限。
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-(--color-line) bg-(--color-paper) px-3 py-2 text-sm text-(--color-ink-soft) transition focus:border-(--color-brass) focus:outline-none"
            />
            <Button variant="primary" onClick={shareOrCopy}>
              {copied ? "已複製 ✓" : canShare ? "分享連結" : "複製連結"}
            </Button>
          </div>

          <div className="mt-4 flex gap-2">
            <a href={shareUrl} target="_blank" rel="noreferrer noopener">
              <Button variant="ghost">查看分享頁 →</Button>
            </a>
            <Button variant="ghost" onClick={startOver}>
              再建立一個
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-(--color-ink-soft)">
            挑選要分享的品項，生成一段連結。看到的人不用登入，也不能修改。
          </p>

          <div className="space-y-5">
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
                        : "未選取"}
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

          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          <div className="mt-6">
            <Button
              variant="primary"
              disabled={create.isPending}
              onClick={() => {
                if (selectedIds.length === 0) {
                  setError("至少要選一項用品。");
                  return;
                }
                create.mutate();
              }}
            >
              {create.isPending
                ? "生成中…"
                : selectedIds.length > 0
                  ? `生成分享連結（${selectedIds.length}）`
                  : "生成分享連結"}
            </Button>
          </div>
        </>
      )}

      <SharedLinks />
    </div>
  );
}

function SharedLinks() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["shares"],
    queryFn: () => api.listShares(),
  });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: (id: string) => api.deleteShare(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shares"] });
      setConfirmingId(null);
    },
  });

  if (query.isPending || query.isError) return null;
  if (query.data.shares.length === 0) return null;

  return (
    <div className="mt-10 border-t border-(--color-line) pt-6">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-(--color-ink-soft)">
        你分享過的連結
      </h2>
      <div className="space-y-2">
        {query.data.shares.map((s) => (
          <ShareRow
            key={s.id}
            share={s}
            confirming={confirmingId === s.id}
            revoking={revoke.isPending && revoke.variables === s.id}
            onConfirm={() => setConfirmingId(s.id)}
            onCancelConfirm={() => setConfirmingId(null)}
            onRevoke={() => revoke.mutate(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ShareRow({
  share,
  confirming,
  revoking,
  onConfirm,
  onCancelConfirm,
  onRevoke,
}: {
  share: ShareDTO;
  confirming: boolean;
  revoking: boolean;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/share/${share.id}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{url}</p>
        <p className="text-xs text-(--color-ink-faint)">
          {formatDate(share.createdAt)} · {share.itemCount} 項品項
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={copy}>
          {copied ? "已複製 ✓" : "複製"}
        </Button>
        {confirming ? (
          <>
            <Button variant="danger" onClick={onRevoke} disabled={revoking}>
              {revoking ? "撤銷中…" : "確定撤銷"}
            </Button>
            <Button variant="ghost" onClick={onCancelConfirm}>
              取消
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onConfirm}>
            撤銷
          </Button>
        )}
      </div>
    </Card>
  );
}
