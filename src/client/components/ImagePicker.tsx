import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Button, ErrorNote, Input, cx } from "./ui";
import { Spinner } from "./Spinner";
import type { ImageCandidate, ItemDTO } from "@/shared/dto";

const ERROR_TEXT: Record<string, string> = {
  blocked_url: "這個網址不允許存取。",
  not_html: "那個網址不是網頁，如果它本身就是圖片，請改用「上傳檔案」。",
  fetch_failed: "連不上那個網址，可能是對方擋住了或暫時無法連線。",
  not_an_image: "抓到的不是圖片檔。",
  too_large: "圖片超過 2 MB。",
  search_not_configured: "還沒設定 SERPAPI_KEY，這一層暫時無法使用。",
  search_failed: "搜尋服務暫時無法使用，可能是額度用完了。",
};

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (ERROR_TEXT[err.message]) return ERROR_TEXT[err.message] as string;
    if (err.message.startsWith("http_")) {
      return `對方網站回了 ${err.message.slice(5)}，抓不到內容。`;
    }
  }
  return fallback;
}

type Mode = "url" | "search" | "upload";

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: "url", label: "從商品網址", hint: "最準，而且沒有次數限制" },
  { id: "search", label: "搜尋品名", hint: "免打網址，但有每月額度" },
  { id: "upload", label: "上傳檔案", hint: "自己拍或存好的圖" },
];

export function ImagePicker({ item }: { item: ItemDTO }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(item.productUrl ? "url" : "search");
  const [urlInput, setUrlInput] = useState(item.productUrl ?? "");
  const [queryInput, setQueryInput] = useState(`${item.brand} ${item.name}`);
  const [candidates, setCandidates] = useState<ImageCandidate[] | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["item", item.id] });
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["shaves"] });
    queryClient.invalidateQueries({ queryKey: ["item-shaves"] });
  }

  function reset() {
    setCandidates(null);
    setError(null);
  }

  const findFromUrl = useMutation({
    mutationFn: () => api.imageFromUrl(urlInput.trim()),
    onMutate: reset,
    onSuccess: ({ candidates }) => {
      setCandidates(candidates);
      if (candidates.length === 0) {
        setError("這個頁面沒有標示商品圖，換一個商品頁或改用上傳。");
      }
    },
    onError: (err) => setError(messageFor(err, "抓圖失敗，請再試一次。")),
  });

  const findFromSearch = useMutation({
    mutationFn: () => api.imageSearch(queryInput.trim()),
    onMutate: reset,
    onSuccess: (res) => {
      setCandidates(res.candidates);
      setCached(res.cached);
      if (res.candidates.length === 0) setError("找不到圖片，換個關鍵字試試。");
    },
    onError: (err) => setError(messageFor(err, "搜尋失敗，請再試一次。")),
  });

  const attach = useMutation({
    mutationFn: (url: string) =>
      api.attachImage(item.id, url, mode === "url" ? "og" : "search"),
    onSuccess: () => {
      setOpen(false);
      setCandidates(null);
      setError(null);
      refresh();
    },
    onError: (err) => setError(messageFor(err, "存圖失敗，換一張試試。")),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadImage(item.id, file),
    onSuccess: () => {
      setOpen(false);
      setError(null);
      refresh();
    },
    onError: (err) => setError(messageFor(err, "上傳失敗，請再試一次。")),
  });

  const removeImage = useMutation({
    mutationFn: () => api.removeImage(item.id),
    onSuccess: refresh,
  });

  const busy =
    findFromUrl.isPending ||
    findFromSearch.isPending ||
    attach.isPending ||
    upload.isPending;

  if (!open) {
    return (
      <div className="mt-8 flex flex-wrap gap-2 border-t border-(--color-line) pt-6">
        <Button onClick={() => setOpen(true)}>
          {item.imageUrl ? "更換圖片" : "加上圖片"}
        </Button>
        {item.imageUrl && (
          <Button
            variant="ghost"
            onClick={() => removeImage.mutate()}
            disabled={removeImage.isPending}
          >
            {removeImage.isPending ? "移除中…" : "移除圖片"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-(--color-line) bg-(--color-surface) p-4">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              reset();
            }}
            className={cx(
              "rounded-full px-3 py-1 text-xs transition",
              mode === m.id
                ? "bg-(--color-brass) text-(--color-paper)"
                : "border border-(--color-line) text-(--color-ink-soft) hover:border-(--color-brass)",
            )}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="ml-auto text-xs text-(--color-ink-faint) hover:text-(--color-ink)"
        >
          收起
        </button>
      </div>

      <p className="mt-2 text-xs text-(--color-ink-faint)">
        {MODES.find((m) => m.id === mode)?.hint}
      </p>

      <div className="mt-3">
        {mode === "url" && (
          <div className="flex gap-2">
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://商品頁網址"
            />
            <Button
              variant="primary"
              onClick={() => findFromUrl.mutate()}
              disabled={busy || urlInput.trim().length < 8}
            >
              抓圖
            </Button>
          </div>
        )}

        {mode === "search" && (
          <div className="flex gap-2">
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Feather Hi-Stainless DE"
            />
            <Button
              variant="primary"
              onClick={() => findFromSearch.mutate()}
              disabled={busy || queryInput.trim().length < 2}
            >
              搜尋
            </Button>
          </div>
        )}

        {mode === "upload" && (
          <div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="block w-full text-sm text-(--color-ink-soft) file:mr-3 file:rounded-lg file:border file:border-(--color-line) file:bg-(--color-paper) file:px-3 file:py-1.5 file:text-sm file:text-(--color-ink)"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setError(null);
                  upload.mutate(file);
                }
              }}
            />
            <p className="mt-1.5 text-xs text-(--color-ink-faint)">
              上限 2 MB，支援 JPEG／PNG／WebP／GIF／AVIF。
            </p>
          </div>
        )}
      </div>

      {busy && (
        <div className="mt-4 flex items-center gap-2 text-sm text-(--color-ink-soft)">
          <Spinner />
          {attach.isPending || upload.isPending ? "存進收藏…" : "尋找中…"}
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-(--color-ink-soft)">
            點一張存進收藏
            {cached && " · 這次用的是快取結果，沒有消耗搜尋額度"}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {candidates.map((candidate) => (
              <button
                key={candidate.url}
                type="button"
                title={candidate.title ?? undefined}
                onClick={() => attach.mutate(candidate.url)}
                disabled={busy}
                className="aspect-square overflow-hidden rounded-lg border border-(--color-line) bg-(--color-paper) transition hover:border-(--color-brass) disabled:opacity-50"
              >
                <img
                  src={candidate.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
