import { safeFetch } from "./url-guard";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export type StoreResult =
  | { ok: true; key: string }
  | {
      ok: false;
      reason: "blocked" | "fetch_failed" | "not_an_image" | "too_large";
    };

/**
 * R2 key 一律由伺服器決定，絕不採用使用者給的路徑。
 * 結尾的隨機片段當作版本號：換圖時圖片網址跟著變，瀏覽器快取自然失效。
 */
function makeKey(userId: string, itemId: string): string {
  return `u/${userId}/i/${itemId}/${crypto.randomUUID().slice(0, 8)}`;
}

/** 從 key 取出版本片段，用來組出會隨換圖而改變的圖片網址。 */
export function keyVersion(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

function normalizeType(contentType: string | null): string | null {
  const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "image/jpg") return "image/jpeg";
  return ALLOWED_TYPES.has(type) ? type : null;
}

/**
 * 把外部圖片下載進 R2。
 *
 * 一律落地而不是存原始網址：外站圖片會失效、會擋 hotlink、會換 CDN 路徑，
 * 而 R2 免費 10 GB 且出站不計費，個人收藏數百張圖用不到 1%。
 */
export async function storeFromUrl(
  bucket: R2Bucket,
  userId: string,
  itemId: string,
  imageUrl: string,
): Promise<StoreResult> {
  const result = await safeFetch(imageUrl, { headers: { Accept: "image/*" } });
  if (!result.ok) {
    return { ok: false, reason: result.reason === "blocked" ? "blocked" : "fetch_failed" };
  }

  const { response } = result;
  if (!response.ok || !response.body) {
    return { ok: false, reason: "fetch_failed" };
  }

  const contentType = normalizeType(response.headers.get("content-type"));
  if (!contentType) return { ok: false, reason: "not_an_image" };

  // 先看宣告的長度快速擋掉大檔，但不信任它 —— 下面還會實際量。
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };

  const bytes = await readCapped(response.body, MAX_IMAGE_BYTES);
  if (!bytes) return { ok: false, reason: "too_large" };
  if (bytes.byteLength === 0) return { ok: false, reason: "not_an_image" };

  return put(bucket, userId, itemId, bytes, contentType);
}

/** 手動上傳。這裡驗的是實際的 MIME 與大小，不看副檔名。 */
export async function storeFromUpload(
  bucket: R2Bucket,
  userId: string,
  itemId: string,
  file: File,
): Promise<StoreResult> {
  const contentType = normalizeType(file.type);
  if (!contentType) return { ok: false, reason: "not_an_image" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) return { ok: false, reason: "not_an_image" };

  return put(bucket, userId, itemId, bytes, contentType);
}

async function put(
  bucket: R2Bucket,
  userId: string,
  itemId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<StoreResult> {
  const key = makeKey(userId, itemId);
  await bucket.put(key, bytes, {
    httpMetadata: { contentType },
  });
  return { ok: true, key };
}

/** 邊讀邊累計，超過上限就中止 —— 不信任 Content-Length。 */
async function readCapped(
  body: ReadableStream<Uint8Array>,
  max: number,
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > max) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
