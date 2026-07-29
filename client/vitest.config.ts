/// <reference types="vitest/config" />
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@blocks-idp": path.resolve(__dirname, "./app/cross-modules/idp"),
      "@blocks-lmt": path.resolve(__dirname, "./app/cross-modules/lmt"),
      "@blocks-storage": path.resolve(__dirname, "./app/cross-modules/storage"),
      "@blocks-communication": path.resolve(__dirname, "./app/cross-modules/communication"),
      "@blocks-identifier": path.resolve(__dirname, "./app/cross-modules/identifier"),
      "@blocks-localization": path.resolve(__dirname, "./app/cross-modules/localization"),
      "@blocks-utilities": path.resolve(__dirname, "./app/cross-modules/utilities"),
      "@blocks-ai": path.resolve(__dirname, "./app/cross-modules/ai"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./app/test-utils/vitest.setup.ts"],
    // Constructing a jsdom environment costs several seconds and a lot of RSS
    // per test file. Letting the default pool fan out to (cores - 1) workers
    // oversubscribes memory on a 16-core/16GB box: the suite gets *slower* and
    // sheds tests to load-induced timeouts. Measured on the 146-file idp
    // subtree: 15 workers -> 252s / 81 failures, 8 workers -> 149s / 17.
    maxWorkers: 8,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.test.*",
        "app/**/*.spec.*",
        "app/**/*.d.ts",
        "app/**/main.tsx",
        "app/**/vite-env.d.ts",
        "**/components/ui/**",
        "app/**/*.stories.*",
        "**/__generated__/**",
        "**/*.gen.*",
        "app/**/test-utils/**",
        "app/**/__mocks__/**",
      ],
    },
  },
});
