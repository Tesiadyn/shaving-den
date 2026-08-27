import { defineConfig } from "drizzle-kit";

// 只用來產生 migration SQL；實際連線在 Worker 裡由 D1 binding 提供。
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
