import { defineConfig } from "vitest/config";

/** Only `.spec.ts` files are suites; `.test.ts` files are standalone scripts. */
export default defineConfig({
  test: { include: ["tests/**/*.spec.ts"] },
});
