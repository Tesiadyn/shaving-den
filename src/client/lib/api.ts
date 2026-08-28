import type {
  ImageCandidate,
  ItemDTO,
  PublicShareDTO,
  ShareDTO,
  ShaveDTO,
  Stats,
} from "@/shared/dto";
import type { ItemInput, ItemPatch, ShaveInput } from "@/shared/schemas";
import type { ItemStatus } from "@/shared/domain";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? String(body.error)
        : null) ?? `request_failed_${res.status}`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

export type ItemFilters = {
  status?: ItemStatus;
};

export const api = {
  listItems(filters: ItemFilters = {}): Promise<{ items: ItemDTO[] }> {
    const qs = filters.status ? `?status=${filters.status}` : "";
    return request(`/api/items${qs}`);
  },

  getItem(id: string): Promise<{ item: ItemDTO }> {
    return request(`/api/items/${id}`);
  },

  createItem(input: ItemInput): Promise<{ item: ItemDTO }> {
    return request("/api/items", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateItem(id: string, patch: ItemPatch): Promise<{ item: ItemDTO }> {
    return request(`/api/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteItem(id: string): Promise<void> {
    return request(`/api/items/${id}`, { method: "DELETE" });
  },

  installBlade(id: string, installedAt: number): Promise<{ item: ItemDTO }> {
    return request(`/api/items/${id}/install-blade`, {
      method: "POST",
      body: JSON.stringify({ installedAt }),
    });
  },

  stats(): Promise<Stats> {
    return request("/api/stats");
  },

  listShaves(): Promise<{ shaves: ShaveDTO[] }> {
    return request("/api/shaves");
  },

  itemShaves(id: string): Promise<{ shaves: ShaveDTO[] }> {
    return request(`/api/items/${id}/shaves`);
  },

  createShave(input: ShaveInput): Promise<{ shave: ShaveDTO }> {
    return request("/api/shaves", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteShave(id: string): Promise<void> {
    return request(`/api/shaves/${id}`, { method: "DELETE" });
  },

  imageFromUrl(productUrl: string): Promise<{ candidates: ImageCandidate[] }> {
    return request("/api/images/from-url", {
      method: "POST",
      body: JSON.stringify({ productUrl }),
    });
  },

  imageSearch(
    q: string,
  ): Promise<{ candidates: ImageCandidate[]; cached: boolean }> {
    return request(`/api/images/search?q=${encodeURIComponent(q)}`);
  },

  attachImage(
    itemId: string,
    imageUrl: string,
    source: "og" | "search",
  ): Promise<{ item: ItemDTO }> {
    return request(`/api/items/${itemId}/image`, {
      method: "POST",
      body: JSON.stringify({ imageUrl, source }),
    });
  },

  uploadImage(itemId: string, file: File): Promise<{ item: ItemDTO }> {
    const form = new FormData();
    form.append("file", file);
    return request(`/api/items/${itemId}/image/upload`, {
      method: "POST",
      body: form,
    });
  },

  removeImage(itemId: string): Promise<{ item: ItemDTO }> {
    return request(`/api/items/${itemId}/image`, { method: "DELETE" });
  },

  listShares(): Promise<{ shares: ShareDTO[] }> {
    return request("/api/shares");
  },

  createShare(itemIds: string[]): Promise<{ id: string }> {
    return request("/api/shares", {
      method: "POST",
      body: JSON.stringify({ itemIds }),
    });
  },

  deleteShare(id: string): Promise<void> {
    return request(`/api/shares/${id}`, { method: "DELETE" });
  },

  getPublicShare(id: string): Promise<{ share: PublicShareDTO }> {
    return request(`/api/public/shares/${id}`);
  },
};
