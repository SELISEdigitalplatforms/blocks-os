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
    // jsdom test files accumulate memory within a worker as more files run in
    // it; recycle the worker once it grows past this instead of running it
    // until it hits Node's default heap ceiling and crashes mid-suite.
    vmMemoryLimit: "1GB",
    coverage: {
      provider: "v8",
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
