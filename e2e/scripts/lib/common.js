const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const e2eRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(e2eRoot, "..");

const graphDir = path.join(e2eRoot, "graph");
const flowGraphPath = path.join(graphDir, "flow-graph.json");
const flowGraphMdPath = path.join(graphDir, "flow-graph.md");
const selectorIndexPath = path.join(graphDir, "selector-index.json");
const uncoveredBaselinePath = path.join(graphDir, "uncovered-baseline.json");
const patchPath = path.join(graphDir, "patch.json");

const protectedLegacyPaths = [
  "e2e/tests/flow/",
  "e2e/tests/auth/",
  "e2e/tests/secrets-and-configs/",
  "e2e/support/navigation.ts",
  "e2e/support/console.ts",
  "e2e/support/flow-state.ts",
];

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function repoRelative(absPath) {
  return toPosix(path.relative(repoRoot, absPath));
}

function e2eRelative(absPath) {
  return toPosix(path.relative(e2eRoot, absPath));
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (fallback !== undefined && error.code === "ENOENT") return fallback;
    throw error;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((next, key) => {
      next[key] = sortKeys(value[key]);
      return next;
    }, {});
}

function graphHash(graph) {
  const clone = JSON.parse(JSON.stringify(graph));
  if (clone.metadata) delete clone.metadata.contentHash;
  const canonical = JSON.stringify(sortKeys(clone));
  return `sha256:${crypto.createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

function stampGraph(graph) {
  const next = {
    metadata: {
      schemaVersion: graph.metadata?.schemaVersion ?? 1,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: "graph-update.js",
      contentHash: "",
    },
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
  };
  next.metadata.contentHash = graphHash(next);
  return next;
}

function slugRoute(route) {
  return route
    .replace(/^\//, "")
    .replace(/:/g, "")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-")
    .replace(/--+/g, "-") || "root";
}

function nodeIdForRoute(route) {
  return slugRoute(route);
}

function printVerdict(verdict, reason, next, details = []) {
  console.log(`verdict: ${verdict}`);
  console.log(`reason: ${reason}`);
  console.log(`next: ${next || "none"}`);
  for (const detail of details) console.log(detail);
}

function runGit(args, options = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync("git", args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        ...options,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error,
      stdout: error.stdout?.toString?.() ?? "",
      stderr: error.stderr?.toString?.() ?? error.message,
    };
  }
}

function pathExistsFromRepo(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function isProtectedLegacyPath(relativePath) {
  const normalized = toPosix(relativePath);
  return protectedLegacyPaths.some((protectedPath) =>
    protectedPath.endsWith("/") ? normalized.startsWith(protectedPath) : normalized === protectedPath,
  );
}

module.exports = {
  e2eRoot,
  repoRoot,
  graphDir,
  flowGraphPath,
  flowGraphMdPath,
  selectorIndexPath,
  uncoveredBaselinePath,
  patchPath,
  protectedLegacyPaths,
  toPosix,
  repoRelative,
  e2eRelative,
  readJson,
  writeJson,
  graphHash,
  stampGraph,
  nodeIdForRoute,
  printVerdict,
  runGit,
  pathExistsFromRepo,
  isProtectedLegacyPath,
};
