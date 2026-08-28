import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  ImageSource,
  ItemCategory,
  ItemStatus,
} from "@/shared/domain";

/* -------------------------------------------------------------------------
 * Better Auth 核心表
 * 對應 @better-auth/core 的 getAuthTables()。欄位名稱與型別必須完全吻合，
 * 升級 better-auth 時請比對 node_modules/@better-auth/core/dist/db/get-tables.mjs。
 * ---------------------------------------------------------------------- */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("account_issuer_accountId_idx").on(t.issuer, t.accountId),
    index("account_userId_idx").on(t.userId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* -------------------------------------------------------------------------
 * 應用表
 * ---------------------------------------------------------------------- */

/** 使用者收藏的一項用品。 */
export const item = sqliteTable(
  "item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    category: text("category").$type<ItemCategory>().notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),

    /** 氣味描述，自由文字（例："薰衣草、廣藿香、皮革尾韻"）。 */
    scentNotes: text("scent_notes"),
    notes: text("notes"),

    /** 庫存數量。刀片是「還剩幾片」，皂是「還有幾塊」。 */
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit").notNull(),

    status: text("status").$type<ItemStatus>().notNull().default("active"),

    /** 來源商品頁；也是 og:image 取圖的依據。 */
    productUrl: text("product_url"),
    /** R2 object key。null = 尚未有圖。 */
    imageKey: text("image_key"),
    imageSource: text("image_source").$type<ImageSource>(),

    /**
     * 僅 DE 刀片使用：目前這一片裝上刀架的時間，只在「換新刀片」時才寫入。
     * 「這片用了幾次」= 這個時間點之後的刮鬍次數，故不需要另存計數器。
     * null = 還沒換過刀片，也就是還在用第一片，從頭算。
     */
    bladeInstalledAt: integer("blade_installed_at", { mode: "timestamp_ms" }),

    acquiredAt: integer("acquired_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("item_user_idx").on(t.userId),
    index("item_user_category_idx").on(t.userId, t.category),
  ],
);

/** 一次刮鬍（Shave of the Day）。 */
export const shave = sqliteTable(
  "shave",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    shavedAt: integer("shaved_at", { mode: "timestamp_ms" }).notNull(),
    // 感受評分，全部 1–5 且越高越好，未填為 null。定義見 shared/domain 的 SHAVE_RATINGS。
    rating: integer("rating"),
    closeness: integer("closeness"),
    smoothness: integer("smoothness"),
    comfort: integer("comfort"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("shave_user_date_idx").on(t.userId, t.shavedAt)],
);

/** 這次刮鬍用到了哪些品項。使用次數完全由這張表推導。 */
export const shaveItem = sqliteTable(
  "shave_item",
  {
    shaveId: text("shave_id")
      .notNull()
      .references(() => shave.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.shaveId, t.itemId] }),
    index("shave_item_item_idx").on(t.itemId),
  ],
);

/**
 * 換刀紀錄（append-only）。存在的理由只有一個：算「這款刀平均能用幾次」。
 *
 * item.blade_installed_at 仍是「目前這片何時裝上」的權威來源（熱路徑查詢用），
 * 這張表則是完整歷史。兩者一律在同一個 db.batch() 裡寫入，不會分歧。
 */
export const bladeSwap = sqliteTable(
  "blade_swap",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    installedAt: integer("installed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("blade_swap_item_idx").on(t.itemId, t.installedAt)],
);

/** 搜圖結果快取，用來省下有限的搜尋 API 額度。 */
export const imageSearchCache = sqliteTable("image_search_cache", {
  queryHash: text("query_hash").primaryKey(),
  resultsJson: text("results_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** 一次「分享收藏」動作。id 直接當作公開網址的 token。 */
export const share = sqliteTable(
  "share",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("share_user_idx").on(t.userId)],
);

/** 這次分享挑了哪些品項。 */
export const shareItem = sqliteTable(
  "share_item",
  {
    shareId: text("share_id")
      .notNull()
      .references(() => share.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.shareId, t.itemId] }),
    index("share_item_item_idx").on(t.itemId),
  ],
);

/* ------------------------------------------------------------------------- */

export const itemRelations = relations(item, ({ many }) => ({
  shaveItems: many(shaveItem),
}));

export const shaveRelations = relations(shave, ({ many }) => ({
  shaveItems: many(shaveItem),
}));

export const shaveItemRelations = relations(shaveItem, ({ one }) => ({
  shave: one(shave, { fields: [shaveItem.shaveId], references: [shave.id] }),
  item: one(item, { fields: [shaveItem.itemId], references: [item.id] }),
}));

export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
export type Shave = typeof shave.$inferSelect;
export type User = typeof user.$inferSelect;
