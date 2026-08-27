/**
 * 「貼商品網址自動抓圖」是全站唯一會依使用者輸入對外發請求的地方，
 * 也就是唯一的 SSRF 風險面。這裡集中處理所有防護。
 *
 * Workers 的 fetch 走 Cloudflare 網路出去，本身就到不了主機的私有網段，
 * 但本機開發（workerd）可以，而且重導向可以把一個合法的公開網址帶去
 * 內網位址 —— 所以每一跳都要重新檢查。
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".onion"];

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;

  const nums = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) return NaN;
    return Number(p);
  });
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return false;

  const [a, b] = nums as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + 雲端 metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  // IPv4-mapped（::ffff:127.0.0.1）要用 IPv4 規則再看一次
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  return false;
}

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: "bad_scheme" | "blocked_host" | "invalid_url" };

export function checkPublicUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "bad_scheme" };
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host)) return { ok: false, reason: "blocked_host" };
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "blocked_host" };
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return { ok: false, reason: "blocked_host" };
  }
  // 沒有點的主機名一定是內網簡稱（單標籤網域），公開網站不會長這樣
  if (!host.includes(".") && !host.includes(":")) {
    return { ok: false, reason: "blocked_host" };
  }

  return { ok: true, url };
}

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;

export type SafeFetchResult =
  | { ok: true; response: Response; finalUrl: URL }
  | { ok: false; reason: "blocked" | "too_many_redirects" | "fetch_failed" };

/**
 * 逐跳自己處理重導向，每一跳都重新過 checkPublicUrl。
 * 用 redirect: "manual" 而不是交給 runtime 自動跟隨，正是為了能檢查中間站。
 */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
): Promise<SafeFetchResult> {
  let current = raw;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = checkPublicUrl(current);
    if (!check.ok) return { ok: false, reason: "blocked" };

    let response: Response;
    try {
      response = await fetch(check.url.toString(), {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // 有些商店會依 UA 擋掉沒帶身分的請求
          "User-Agent":
            "Mozilla/5.0 (compatible; ShavingDen/1.0; +https://github.com)",
          Accept: "text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.8",
          ...init.headers,
        },
      });
    } catch {
      return { ok: false, reason: "fetch_failed" };
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, check.url).toString();
      continue;
    }

    return { ok: true, response, finalUrl: check.url };
  }

  return { ok: false, reason: "too_many_redirects" };
}
