#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const {
  e2eRoot,
  flowGraphPath,
  patchPath,
  uncoveredBaselinePath,
  isProtectedLegacyPath,
  pathExistsFromRepo,
  printVerdict,
  readJson,
  stampGraph,
  writeJson,
} = require("./lib/common");

function parsePatchPath() {
  const index = process.argv.indexOf("--patch");
  return index >= 0 ? process.argv[index + 1] : patchPath;
}

function allowLegacyPatch() {
  return process.argv.includes("--allow-legacy");
}

function validatePatch(graph, patch) {
  const failures = [];
  const nodeIds = new Set((graph.nodes || []).map((node) => node.id));
  const edgeIds = new Set((graph.edges || []).map((edge) => edge.id));

  for (const node of patch.nodes || []) {
    if (!node.id) failures.push("patch node missing id");
    if (nodeIds.has(node.id)) failures.push(`patch node id already exists: ${node.id}`);
    nodeIds.add(node.id);
  }

  for (const edge of patch.edges || []) {
    if (!edge.id) failures.push("patch edge missing id");
    if (edgeIds.has(edge.id)) failures.push(`patch edge id already exists: ${edge.id}`);
    if (!nodeIds.has(edge.from)) failures.push(`patch edge ${edge.id} missing from node ${edge.from}`);
    if (!nodeIds.has(edge.to)) failures.push(`patch edge ${edge.id} missing to node ${edge.to}`);
    if (!edge.via?.file || !pathExistsFromRepo(edge.via.file)) failures.push(`patch edge ${edge.id} via.file missing: ${edge.via?.file}`);
    if (!Array.isArray(edge.coveredBy) || edge.coveredBy.length === 0) failures.push(`patch edge ${edge.id} coveredBy must be non-empty`);
    for (const file of edge.coveredBy || []) {
      if (!pathExistsFromRepo(file)) failures.push(`patch edge ${edge.id} coveredBy file missing: ${file}`);
    }
    if (edge.convention === "legacy") {
      if (!allowLegacyPatch()) {
        failures.push(`patch edge ${edge.id} requires user-approved legacy E2E modification; rerun with --allow-legacy only after approval`);
      }
      if (!isProtectedLegacyPath(edge.via.file)) {
        failures.push(`patch edge ${edge.id} legacy via.file must stay under protected legacy paths`);
      }
      for (const file of edge.coveredBy || []) {
        if (!isProtectedLegacyPath(file)) failures.push(`patch edge ${edge.id} legacy coveredBy must stay under protected legacy paths: ${file}`);
      }
    } else if (edge.convention === "steps") {
      if (!edge.via.file.startsWith("e2e/support/steps/") || !edge.via.file.endsWith(".steps.ts")) {
        failures.push(`patch edge ${edge.id} via.file must be under e2e/support/steps/`);
      }
      for (const file of edge.coveredBy || []) {
        if (!file.startsWith("e2e/tests/journeys/") || !file.endsWith(".spec.ts")) {
          failures.push(`patch edge ${edge.id} coveredBy must be under e2e/tests/journeys/: ${file}`);
        }
      }
    } else {
      failures.push(`patch edge ${edge.id} has invalid convention ${edge.convention}`);
    }
  }

  return failures;
}

try {
  const selectedPatchPath = parsePatchPath();
  const graph = readJson(flowGraphPath);
  const patch = readJson(selectedPatchPath);
  const failures = validatePatch(graph, patch);

  if (failures.length > 0) {
    printVerdict("fail", `${failures.length} graph patch validation failure(s)`, "fix patch", failures.map((failure) => `failure: ${failure}`));
    process.exit(1);
  }

  const nextGraph = stampGraph({
    ...graph,
    nodes: [...(graph.nodes || []), ...(patch.nodes || [])].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...(graph.edges || []), ...(patch.edges || [])].sort((a, b) => a.id.localeCompare(b.id)),
  });

  const newlyCovered = new Set();
  for (const edge of patch.edges || []) {
    if (Array.isArray(edge.coveredBy) && edge.coveredBy.length > 0) {
      newlyCovered.add(edge.from);
      newlyCovered.add(edge.to);
    }
  }

  const baseline = readJson(uncoveredBaselinePath, { entries: [] });
  if (Array.isArray(baseline.entries) && newlyCovered.size > 0) {
    baseline.entries = baseline.entries.filter((entry) => !newlyCovered.has(entry.nodeId));
    writeJson(uncoveredBaselinePath, baseline);
  }

  writeJson(flowGraphPath, nextGraph);

  const render = spawnSync(process.execPath, ["scripts/graph-render.js"], {
    cwd: e2eRoot,
    encoding: "utf8",
  });

  if (render.status !== 0) {
    printVerdict("fail", "graph patch applied but render failed", "fix render error", [render.stdout, render.stderr].filter(Boolean));
    process.exit(1);
  }

  fs.unlinkSync(selectedPatchPath);
  printVerdict("pass", "graph patch applied", "none");
} catch (error) {
  printVerdict("fail", `graph update failed: ${error.message}`, "fix patch");
  process.exitCode = 1;
}
