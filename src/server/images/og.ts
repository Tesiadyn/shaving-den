import type { ImageCandidate } from "@/shared/dto";
import { safeFetch } from "./url-guard";

/** 只讀前 256 KB —— <head> 一定在這之內，不必把整頁商品頁拉完。 */
const MAX_HTML_BYTES = 256 * 1024;

type Found = {
  ogImage: string | null;
  twitterImage: string | null;
  imageSrc: string | null;
  title: string | null;
};

/**
 * 用 Workers 內建的 HTMLRewriter 串流解析，不需要 cheerio/jsdom。
 * 零依賴、零 bundle 成本，而且邊下載邊解析。
 */
export async function extractOgImages(
  productUrl: string,
): Promise<{ ok: true; candidates: ImageCandidate[] } | { ok: false; reason: string }> {
  const result = await safeFetch(productUrl);
  if (!result.ok) return { ok: false, reason: result.reason };

  const { response, finalUrl } = result;

  if (!response.ok) return { ok: false, reason: `http_${response.status}` };

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    return { ok: false, reason: "not_html" };
  }

  const found: Found = {
    ogImage: null,
    twitterImage: null,
    imageSrc: null,
    title: null,
  };

  let titleBuffer = "";

  const rewritten = new HTMLRewriter()
    .on("meta", {
      element(el) {
        const property = (
          el.getAttribute("property") ??
          el.getAttribute("name") ??
          ""
        ).toLowerCase();
        const content = el.getAttribute("content");
        if (!content) return;

        if (property === "og:image" || property === "og:image:secure_url") {
          found.ogImage ??= content;
        } else if (
          property === "twitter:image" ||
          property === "twitter:image:src"
        ) {
          found.twitterImage ??= content;
        }
      },
    })
    .on("link", {
      element(el) {
        if ((el.getAttribute("rel") ?? "").toLowerCase() !== "image_src") return;
        const href = el.getAttribute("href");
        if (href) found.imageSrc ??= href;
      },
    })
    .on("title", {
      text(chunk) {
        if (titleBuffer.length < 200) titleBuffer += chunk.text;
        if (chunk.lastInTextNode) found.title = titleBuffer.trim() || null;
      },
    })
    .transform(response);

  // HTMLRewriter 是串流式的：必須把 body 讀完 handler 才會全部跑到。
  await drain(rewritten.body);

  // 依可信度排序：og:image 是商品頁最刻意標示的主圖。
  const raw = [found.ogImage, found.twitterImage, found.imageSrc].filter(
    (v): v is string => Boolean(v),
  );

  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    let absolute: string;
    try {
      absolute = new URL(value, finalUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    candidates.push({
      url: absolute,
      thumbnailUrl: absolute,
      title: found.title,
      sourcePage: finalUrl.toString(),
    });
  }

  return { ok: true, candidates };
}

async function drain(body: ReadableStream | null): Promise<void> {
  if (!body) return;
  const reader = body.getReader();
  let read = 0;
  try {
    while (read < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value?.byteLength ?? 0;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
