import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    // Vitest cobre apenas a unidade em src/. Os testes Playwright vivem em e2e/
    // e usam .spec.ts, que o include padrão do Vitest pegaria — por isso o escopo.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
