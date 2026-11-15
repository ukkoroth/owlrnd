import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" throws outside the React server build; it is a no-op in tests.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup-env.ts"],
    // Integration tests share the dev database; run files one at a time.
    fileParallelism: false,
  },
});
