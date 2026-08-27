import { HTTPException } from "hono/http-exception";

/** 找不到，或不屬於這個使用者 —— 兩者一律回 404，不洩漏存在性。 */
export function notFound(): never {
  throw new HTTPException(404, { message: "not_found" });
}

export function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}
