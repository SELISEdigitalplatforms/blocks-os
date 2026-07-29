#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const {
  repoRoot,
  e2eRoot,
  selectorIndexPath,
  printVerdict,
  readJson,
  runGit,
  toPosix,
} = require("./lib/common");

const actionKeywords = [
  "delete",
  "cancel",
  "invite",
  "grant",
  "revoke",
  "approve",
  "reject",
  "submit",
  "confirm",
  "upload",
  "sync",
  "save",
  "create",
  "update",
  "remove",
];

function changedFiles(baseRef) {
  const args = baseRef ? ["diff", "--name-only", baseRef] : ["diff", "--name-only", "HEAD"];
  const result = runGit(args);
  if (!result.ok) return { ok: false, reason: result.stderr || "git diff unavailable" };
  return {
    ok: true,
    files: result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(toPosix),
  };
}

function fileDiff(relativePath, baseRef) {
  const args = baseRef ? ["diff", "--unified=0", baseRef, "--", relativePath] : ["diff", "--unified=0", "HEAD", "--", relativePath];
  const result = runGit(args);
  return result.ok ? result.stdout : "";
}

function lineHasSelectorChange(diffText, selectors) {
  const changed = diffText
    .split(/\r?\n/)
    .filter((line) => /^[+-](?![+-])/.test(line))
    .map((line) => line.slice(1));
  return changed.find((line) => selectors.some((selector) => selector.value && line.includes(selector.value)));
}

function listTsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(toPosix(path.relative(repoRoot, fullPath)));
  }
  return out;
}

function selectorIndexFresh(index) {
  if (!index?.metadata?.sourceFiles || !Array.isArray(index.metadata.sourceFiles)) {
    return { fresh: false, reason: "selector-index missing source file metadata" };
  }

  const known = new Map(index.metadata.sourceFiles.map((source) => [toPosix(source.path), source]));
  for (const source of index.metadata.sourceFiles) {
    const abs = path.join(repoRoot, source.path);
    if (!fs.existsSync(abs)) return { fresh: false, reason: `selector source missing: ${source.path}` };
    const stat = fs.statSync(abs);
    if (stat.size !== source.size || stat.mtimeMs !== source.mtimeMs) {
      return { fresh: false, reason: `selector source changed: ${source.path}` };
    }
  }

  const current = [
    ...listTsFiles(path.join(e2eRoot, "tests")),
    ...listTsFiles(path.join(e2eRoot, "support")),
  ];
  const unindexed = current.filter((file) => !known.has(file));
  if (unindexed.length > 0) return { fresh: false, reason: `new selector source files: ${unindexed.join(", ")}` };

  return { fresh: true };
}

function keywordRegex() {
  return new RegExp(`\\b(${actionKeywords.join("|")})\\b`, "i");
}

function containsKeyword(value) {
  return typeof value === "string" && keywordRegex().test(value);
}

function attrValue(node) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression)) {
    return node.expression.text;
  }
  return undefined;
}

function hasActionSurfaceKeyword(relativePath) {
  const abs = path.join(repoRoot, relativePath);
  if (!fs.existsSync(abs) || !/\.(tsx|ts)$/.test(abs)) return false;
  const source = fs.readFileSync(abs, "utf8");
  const scriptKind = abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true, scriptKind);
  let found = false;

  function inspectJsxText(text) {
    if (containsKeyword(text)) found = true;
  }

  function walk(node) {
    if (found) return;

    if (ts.isJsxText(node)) inspectJsxText(node.text);

    if (ts.isJsxAttribute(node)) {
      const name = node.name.text;
      if (["aria-label", "title", "placeholder", "label", "name"].includes(name) && containsKeyword(attrValue(node.initializer))) {
        found = true;
        return;
      }
      if (/^(on[A-Z].*|handle[A-Z].*)/.test(name) && containsKeyword(name)) {
        found = true;
        return;
      }
    }

    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
      const name = node.name.getText(sf);
      if (/^(on[A-Z].*|handle[A-Z].*)/.test(name) && containsKeyword(name)) {
        found = true;
        return;
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sf).replace(/^["']|["']$/g, "");
      if (["label", "name", "title", "action"].includes(name) && ts.isStringLiteralLike(node.initializer) && containsKeyword(node.initializer.text)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, walk);
  }

  walk(sf);
  return found;
}

try {
  const baseIndex = process.argv.indexOf("--base");
  const baseRef = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined;
  const diff = changedFiles(baseRef);
  if (!diff.ok) {
    printVerdict("unknown", "git diff unavailable", "manually inspect changed client/app files or fix git safe.directory");
    process.exit(0);
  }

  const clientFiles = diff.files.filter((file) => file.startsWith("client/app/"));
  if (clientFiles.length === 0) {
    printVerdict("none", "no client/app files changed", "none");
    process.exit(0);
  }

  if (clientFiles.some((file) => file === "client/app/router.tsx" || file === "client/app/constants/navigation-menus.ts")) {
    printVerdict("definite", "router.tsx or navigation-menus.ts changed", "update flow E2E and graph if behavior is user-reachable");
    process.exit(0);
  }

  const actionFile = clientFiles.find(hasActionSurfaceKeyword);
  if (actionFile) {
    printVerdict("likely", `action keyword found in user-action surface: ${actionFile}`, "inspect graph coverage and update E2E if behavior changed");
    process.exit(0);
  }

  let selectorIndex;
  try {
    selectorIndex = readJson(selectorIndexPath);
  } catch {
    printVerdict("unknown", "selector-index missing or stale", "run npm run graph:render");
    process.exit(0);
  }

  const freshness = selectorIndexFresh(selectorIndex);
  if (!freshness.fresh) {
    printVerdict("unknown", `selector-index missing or stale: ${freshness.reason}`, "run npm run graph:render");
    process.exit(0);
  }

  for (const file of clientFiles) {
    const changedSelectorLine = lineHasSelectorChange(fileDiff(file, baseRef), selectorIndex.selectors || []);
    if (changedSelectorLine) {
      printVerdict("definite", `diff removes/alters selector-index string in ${file}`, "update flow E2E and graph if behavior is user-reachable");
      process.exit(0);
    }
  }

  printVerdict("possible", "client/app files changed without definite or likely E2E impact signal", "inspect changed frontend files and decide");
} catch (error) {
  printVerdict("unknown", `impact check failed: ${error.message}`, "manually inspect changed client/app files");
}
