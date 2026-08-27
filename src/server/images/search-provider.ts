import type { ImageCandidate } from "@/shared/dto";

/**
 * 搜圖供應商的唯一介面。
 *
 * 為什麼要抽這一層：免費的圖片搜尋 API 這幾年換得很勤 ——
 * Bing Image Search 已下架，Google Custom Search JSON API 不收新客戶且
 * 2027-01-01 停止服務。把供應商隔離在這個檔，換家只要動這裡。
 */
export type ImageSearchProvider = {
  readonly name: string;
  search(query: string, limit: number): Promise<ImageCandidate[]>;
};

type SerpApiImage = {
  original?: string;
  thumbnail?: string;
  title?: string;
  link?: string;
};

/** SerpAPI 的 google_images engine，免費方案 250 次/月。 */
function serpApiProvider(apiKey: string): ImageSearchProvider {
  return {
    name: "serpapi",
    async search(query, limit) {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_images");
      url.searchParams.set("q", query);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("num", String(Math.min(limit * 2, 20)));

      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`serpapi_${res.status}`);

      const body = (await res.json()) as { images_results?: SerpApiImage[] };

      return (body.images_results ?? [])
        .filter((r): r is SerpApiImage & { original: string } =>
          Boolean(r.original),
        )
        .slice(0, limit)
        .map((r) => ({
          url: r.original,
          thumbnailUrl: r.thumbnail ?? r.original,
          title: r.title ?? null,
          sourcePage: r.link ?? null,
        }));
    },
  };
}

/**
 * 沒設定 API key 時回 null，呼叫端據此讓「打品名搜圖」這一層優雅停用 ——
 * 貼網址與手動上傳兩層完全不受影響。
 */
export function resolveSearchProvider(env: Env): ImageSearchProvider | null {
  if (env.SERPAPI_KEY) return serpApiProvider(env.SERPAPI_KEY);
  return null;
}
