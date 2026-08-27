/**
 * 開發用：在本機 D1 造一個測試使用者與 session，印出可直接帶進 curl 的 Cookie。
 * 只操作 .wrangler 的本機狀態，不會碰到正式資料庫。
 *
 *   node scripts/dev-session.mjs            # 造 session 並印出 cookie
 *   node scripts/dev-session.mjs bob        # 造第二個使用者，用來驗證資料隔離
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID, webcrypto } from "node:crypto";

const who = process.argv[2] ?? "tester";

const secret = readFileSync(".dev.vars", "utf8")
  .split("\n")
  .find((l) => l.startsWith("BETTER_AUTH_SECRET="))
  ?.slice("BETTER_AUTH_SECRET=".length)
  .trim();

if (!secret) throw new Error("BETTER_AUTH_SECRET not found in .dev.vars");

const now = Date.now();
const userId = `dev-user-${who}`;
const sessionId = randomUUID();
const token = randomUUID().replaceAll("-", "");
const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

const sql = `
INSERT OR REPLACE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
VALUES ('${userId}', '${who}', '${who}@dev.local', 1, NULL, ${now}, ${now});
INSERT INTO session (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
VALUES ('${sessionId}', '${userId}', '${token}', ${expiresAt}, NULL, 'dev-script', ${now}, ${now});
`.trim();

// 直接跑 wrangler 的 JS 入口，避開 Windows 上 spawn .cmd 的限制。
execFileSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "shaving-den",
    "--local",
    "--command",
    sql,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

// 與 better-call 的 signCookieValue 相同：value + "." + base64(HMAC-SHA256(secret, value))
const key = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const sig = await webcrypto.subtle.sign(
  "HMAC",
  key,
  new TextEncoder().encode(token),
);
const signature = Buffer.from(sig).toString("base64");
const cookieValue = encodeURIComponent(`${token}.${signature}`);

process.stdout.write(`better-auth.session_token=${cookieValue}`);
