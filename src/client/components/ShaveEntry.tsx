import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  shaveRatingsFor,
} from "@/shared/domain";
import type { ShaveDTO } from "@/shared/dto";
import { formatDate, relativeDays } from "../lib/format";
import { ItemThumb } from "./ItemThumb";
import { Button, Card, RatingDots } from "./ui";

export function ShaveEntry({
  shave,
  onDelete,
  deleting,
}: {
  shave: ShaveDTO;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const [shareOpen, setShareOpen] = useState(false);

  // 依固定的分類順序排列，讓每一筆日誌讀起來都是同一個順序。
  const ordered = [...shave.items].sort(
    (a, b) =>
      ITEM_CATEGORIES.indexOf(a.category) - ITEM_CATEGORIES.indexOf(b.category),
  );

  const scored = shaveRatingsFor(shave.items.map((it) => it.category)).flatMap(
    (scale) => {
      const value = shave[scale.key];
      return value === null ? [] : [{ ...scale, value }];
    },
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{formatDate(shave.shavedAt)}</span>
        <span className="text-xs text-(--color-ink-faint)">
          {relativeDays(shave.shavedAt)}
        </span>
        <div className="ml-auto flex items-baseline gap-3">
          <button
            type="button"
            onClick={() => setShareOpen((v) => !v)}
            className="text-xs text-(--color-ink-faint) transition hover:text-(--color-brass)"
          >
            {shave.shareId ? "已分享" : "分享"}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="text-xs text-(--color-ink-faint) transition hover:text-red-400 disabled:opacity-50"
            >
              {deleting ? "刪除中…" : "刪除"}
            </button>
          )}
        </div>
      </div>

      {shareOpen && <SharePanel shave={shave} />}

      {scored.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {scored.map((scale) => (
            <RatingDots
              key={scale.key}
              label={scale.label}
              value={scale.value}
            />
          ))}
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {ordered.map((it) => (
          <li key={it.id} className="flex items-center gap-2.5">
            <ItemThumb category={it.category} imageUrl={it.imageUrl} />
            <span className="w-14 shrink-0 text-[11px] text-(--color-ink-faint)">
              {CATEGORY_LABELS[it.category]}
            </span>
            <Link
              to={`/den/${it.id}`}
              className="min-w-0 truncate text-sm transition hover:text-(--color-brass)"
            >
              <span className="text-(--color-ink-soft)">{it.brand}</span>{" "}
              {it.name}
            </Link>
          </li>
        ))}
      </ul>

      {shave.notes && (
        <p className="mt-3 border-t border-(--color-line) pt-3 text-sm leading-relaxed whitespace-pre-wrap text-(--color-ink-soft)">
          {shave.notes}
        </p>
      )}
    </Card>
  );
}

/** 這篇日誌的分享面板：未分享過就先產生連結，已分享過就顯示連結／可撤銷。 */
function SharePanel({ shave }: { shave: ShaveDTO }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["shaves"] });
    queryClient.invalidateQueries({ queryKey: ["item-shaves"] });
  }

  const create = useMutation({
    mutationFn: () => api.shareShave(shave.id),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: () => api.unshareShave(shave.id),
    onSuccess: invalidate,
  });

  const url = shave.shareId
    ? `${window.location.origin}/shave/${shave.shareId}`
    : null;

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 rounded-lg border border-(--color-line) bg-(--color-paper) p-3">
      {url ? (
        <>
          <p className="text-xs text-(--color-ink-soft)">
            拿到這段網址的人不用登入就能看到這篇日誌，但沒有任何修改權限。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-xs text-(--color-ink-soft) transition focus:border-(--color-brass) focus:outline-none"
            />
            <Button variant="secondary" onClick={copy}>
              {copied ? "已複製 ✓" : "複製"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
            >
              {revoke.isPending ? "撤銷中…" : "撤銷"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-(--color-ink-soft)">
            產生一段連結，不用登入就能看到這篇日誌。
          </p>
          <Button
            variant="secondary"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            {create.isPending ? "產生中…" : "產生連結"}
          </Button>
        </div>
      )}
    </div>
  );
}
