/// <reference types="vitest/config" />
// Multi-environment test config (mirrors blocks-idp): DOM-free suites run on
// `node`, everything else on `jsdom`. Building a jsdom window per test file is
// the single largest cost in the run, so suites that only exercise request
// building, mapping and formatting logic skip it — 92 of 429 files, which cuts
// the reported `environment` time by ~20% (~1.2ks -> ~1.0ks of worker time).
// Wall clock moves less than that: 274 of the 429 files are .tsx component
// tests that must keep jsdom, and they dominate.
//
// Adding a test? The default is jsdom — nothing to do. A new test only lands on
// `node` if it matches NODE_TEST_PATTERNS below; if it does and it turns out to
// need the DOM, add it to NEEDS_DOM.
import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname, "./app"),
  "@blocks-idp": path.resolve(__dirname, "./app/cross-modules/idp"),
  "@blocks-lmt": path.resolve(__dirname, "./app/cross-modules/lmt"),
  "@blocks-storage": path.resolve(__dirname, "./app/cross-modules/storage"),
  "@blocks-communication": path.resolve(__dirname, "./app/cross-modules/communication"),
  "@blocks-identifier": path.resolve(__dirname, "./app/cross-modules/identifier"),
  "@blocks-localization": path.resolve(__dirname, "./app/cross-modules/localization"),
  "@blocks-utilities": path.resolve(__dirname, "./app/cross-modules/utilities"),
  "@blocks-ai": path.resolve(__dirname, "./app/cross-modules/ai"),
};

// DOM-free areas: pure request/mapping/format logic.
// .ts only — a .tsx test renders JSX and therefore needs jsdom.
const NODE_TEST_PATTERNS = [
  /(^|\/)(services|utils|mappers|models|constants|store)\/.*\.test\.ts$/,
  /(^|\/|\.|-)utils?\.test\.ts$/,
  /\.(service|model)\.test\.ts$/,
  /^app\/lib\//,
];

// These sit in DOM-free folders but they (or the module under test) touch
// `window`/`document` directly, so they stay on jsdom.
const NEEDS_DOM = [
  "app/cross-modules/ai/services/aimodel.service.test.ts",
  "app/cross-modules/devops/services/providers.service.test.ts",
  "app/cross-modules/idp/api-settings/utils/service-swagger.test.ts",
  "app/cross-modules/utilities/utils/url.util.test.ts",
  "app/lib/get-api-path.test.ts",
  "app/lib/resolve-env.test.ts",
  "app/lib/runtime-env.test.ts",
  "app/lib/utils.test.ts",
];

// Resolve the node set once, so the jsdom project can exclude exactly those
// files. Glob `exclude` beats `include`, so NEEDS_DOM entries must be removed
// from the node list rather than re-added to jsdom's include.
function collectNodeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.resolve(__dirname, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectNodeFiles(rel, acc);
    } else if (
      rel.endsWith(".test.ts") &&
      NODE_TEST_PATTERNS.some((pattern) => pattern.test(rel)) &&
      !NEEDS_DOM.includes(rel)
    ) {
      acc.push(rel);
    }
  }
  return acc;
}

const NODE_FILES = collectNodeFiles("app");

const shared = {
  globals: true,
  setupFiles: ["./app/test-utils/vitest.setup.ts"],
  alias,
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          ...shared,
          name: "node",
          environment: "node",
          include: NODE_FILES,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          ...shared,
          name: "jsdom",
          environment: "jsdom",
          include: ["app/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", ...NODE_FILES],
        },
      },
    ],
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
