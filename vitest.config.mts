import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real package throws outside React Server Components; tests run server code directly.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    hookTimeout: 60_000,
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
