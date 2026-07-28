#!/usr/bin/env node
const { discoverAppSurface } = require("./lib/discover-app-surface");
const {
  flowGraphPath,
  uncoveredBaselinePath,
  protectedLegacyPaths,
  graphHash,
  isProtectedLegacyPath,
  pathExistsFromRepo,
  printVerdict,
  readJson,
  runGit,
} = require("./lib/common");

const allowedBaselineStatuses = new Set(["backlog", "needs-e2e", "needs-flow", "no-e2e-needed", "covered-by-parent"]);
const navigationActionTypes = new Set(["navigate", "open", "redirect", "smoke", "login"]);

function isStepsFile(file) {
  return file.startsWith("e2e/support/steps/") && file.endsWith(".steps.ts");
}

function isJourneyFile(file) {
  return file.startsWith("e2e/tests/journeys/") && file.endsWith(".spec.ts");
}

function isJourneyOnlyEdge(edge) {
  return Array.isArray(edge.coveredBy) && edge.coveredBy.length > 0 && edge.coveredBy.every(isJourneyFile);
}

function validateGraphShape(graph, failures) {
  if (!graph || typeof graph !== "object") failures.push("flow-graph.json must be an object");
  if (!graph.metadata) failures.push("flow-graph.json missing metadata");
  if (!Array.isArray(graph.nodes)) failures.push("flow-graph.json nodes must be an array");
  if (!Array.isArray(graph.edges)) failures.push("flow-graph.json edges must be an array");
  if (graph.metadata?.contentHash !== graphHash(graph)) failures.push("flow-graph metadata.contentHash mismatch");
}

function primaryCoveredNodeIds(graph) {
  const covered = new Set();
  for (const edge of graph.edges || []) {
    if (Array.isArray(edge.coveredBy) && edge.coveredBy.length > 0 && !isJourneyOnlyEdge(edge)) {
      covered.add(edge.from);
      covered.add(edge.to);
    }
  }
  return covered;
}

function smokeCoveredNodeIds(graph) {
  const covered = new Set();
  for (const edge of graph.edges || []) {
    if (isJourneyOnlyEdge(edge)) {
      covered.add(edge.from);
      covered.add(edge.to);
    }
  }
  return covered;
}

function hasDynamicRouteSegment(route) {
  return typeof route === "string" && route.split("/").some((segment) => segment.startsWith(":"));
}

function hasRouteEvidence(edge) {
  const evidence = edge.evidence;
  return (
    evidence &&
    typeof evidence.urlPattern === "string" &&
    evidence.urlPattern.trim().length > 0 &&
    Array.isArray(evidence.assertions) &&
    evidence.assertions.some((assertion) => typeof assertion === "string" && assertion.trim().length > 0)
  );
}

function hasResultEvidence(edge) {
  const resultEvidence = edge.evidence?.result;
  return (
    typeof resultEvidence === "string" && resultEvidence.trim().length > 0
  );
}

function isNavigationOnlyEdge(edge) {
  if (typeof edge.actionType === "string") {
    return navigationActionTypes.has(edge.actionType);
  }

  return /^(nav|navigate|open|login)\b/i.test(edge.id || "") || /^(navigate|open|login)\b/i.test(edge.action || "");
}

function checkDirtyLegacyPaths(warnings) {
  const diff = runGit(["diff", "--name-only", "HEAD"]);
  const status = runGit(["status", "--porcelain"]);
  if (!diff.ok || !status.ok) {
    warnings.push("could not inspect protected legacy path dirty state because git status/diff failed");
    return;
  }

  const paths = new Set();
  for (const line of diff.stdout.split(/\r?\n/).filter(Boolean)) paths.add(line.trim());
  for (const line of status.stdout.split(/\r?\n/).filter(Boolean)) {
    const file = line.slice(3).trim();
    if (file) paths.add(file);
  }
  const touched = [...paths].filter(isProtectedLegacyPath);
  if (touched.length > 0) warnings.push(`protected legacy E2E paths have working-tree changes: ${touched.join(", ")}`);
}

try {
  const failures = [];
  const warnings = [];
  const details = [];
  const graph = readJson(flowGraphPath);
  const baseline = readJson(uncoveredBaselinePath, { entries: [] });
  const inventory = discoverAppSurface();

  validateGraphShape(graph, failures);

  const nodeIds = new Set((graph.nodes || []).map((node) => node.id));
  const routeSet = new Set(inventory.nodes.map((node) => node.canonicalRoute));
  const graphRoutes = new Map((graph.nodes || []).filter((node) => node.canonicalRoute).map((node) => [node.id, node.canonicalRoute]));

  for (const node of graph.nodes || []) {
    if (!node.id) failures.push("graph node missing id");
    if (!node.label) failures.push(`graph node ${node.id || "<unknown>"} missing label`);
    if ((node.kind === "route" || node.kind === "redirect") && !node.canonicalRoute) {
      failures.push(`graph node ${node.id} missing canonicalRoute`);
    }
    if (node.kind === "redirect" && node.redirectsTo && !nodeIds.has(node.redirectsTo)) {
      failures.push(`redirect node ${node.id} points to missing node ${node.redirectsTo}`);
    }
    if (node.canonicalRoute && !routeSet.has(node.canonicalRoute) && node.source !== "manual") {
      failures.push(`stale graph node ${node.id} route no longer discovered: ${node.canonicalRoute}`);
    }
  }

  for (const edge of graph.edges || []) {
    if (!edge.id) failures.push("graph edge missing id");
    if (!nodeIds.has(edge.from)) failures.push(`edge ${edge.id} has missing from node ${edge.from}`);
    if (!nodeIds.has(edge.to)) failures.push(`edge ${edge.id} has missing to node ${edge.to}`);
    if (!edge.via?.file || !pathExistsFromRepo(edge.via.file)) failures.push(`edge ${edge.id} via.file missing: ${edge.via?.file}`);
    if (!Array.isArray(edge.coveredBy) || edge.coveredBy.length === 0) failures.push(`edge ${edge.id} coveredBy must be non-empty`);
    for (const file of edge.coveredBy || []) {
      if (!pathExistsFromRepo(file)) failures.push(`edge ${edge.id} coveredBy file missing: ${file}`);
    }
    if (edge.convention === "legacy") {
      if (!isProtectedLegacyPath(edge.via?.file || "")) failures.push(`legacy edge ${edge.id} via.file must be protected legacy E2E`);
      for (const file of edge.coveredBy || []) {
        if (!isProtectedLegacyPath(file)) failures.push(`legacy edge ${edge.id} coveredBy must be protected legacy E2E: ${file}`);
      }
    } else if (edge.convention === "steps") {
      if (!isStepsFile(edge.via?.file || "")) failures.push(`steps edge ${edge.id} via.file must be under e2e/support/steps/`);
      for (const file of edge.coveredBy || []) {
        if (!isJourneyFile(file)) failures.push(`steps edge ${edge.id} coveredBy must be under e2e/tests/journeys/: ${file}`);
      }
      if (edge.coverageLevel !== "smoke") warnings.push(`journey edge should be marked coverageLevel=smoke: ${edge.id}`);
    } else {
      failures.push(`edge ${edge.id} has invalid convention ${edge.convention}`);
    }

    const targetRoute = graphRoutes.get(edge.to);
    if (hasDynamicRouteSegment(targetRoute) && !hasRouteEvidence(edge)) {
      warnings.push(`dynamic route edge missing route evidence: ${edge.id}`);
    }

    if (!isNavigationOnlyEdge(edge) && !hasResultEvidence(edge)) {
      warnings.push(`action edge missing result evidence: ${edge.id}`);
    }
  }

  const covered = primaryCoveredNodeIds(graph);
  const smokeCovered = smokeCoveredNodeIds(graph);
  const baselineEntries = Array.isArray(baseline.entries) ? baseline.entries : [];
  if (!Array.isArray(baseline.entries)) failures.push("uncovered-baseline.json entries must be an array");

  for (const entry of baselineEntries) {
    if (!entry.nodeId) {
      failures.push("baseline entry missing nodeId");
      continue;
    }
    if (!allowedBaselineStatuses.has(entry.status)) failures.push(`baseline entry ${entry.nodeId} has invalid status ${entry.status}`);
    if (!nodeIds.has(entry.nodeId)) failures.push(`orphaned baseline entry ${entry.nodeId}`);
    if (covered.has(entry.nodeId)) failures.push(`baseline entry already covered: ${entry.nodeId}`);
    if (entry.status === "covered-by-parent" && hasDynamicRouteSegment(graphRoutes.get(entry.nodeId))) {
      warnings.push(`dynamic route marked covered-by-parent without direct edge: ${entry.nodeId}`);
    }
  }

  const baselineNodeIds = new Set(baselineEntries.map((entry) => entry.nodeId));
  const inventoryNodeIds = new Set(inventory.nodes.map((node) => node.id));
  const graphNodeIds = new Set((graph.nodes || []).map((node) => node.id));
  const unclassified = [...inventoryNodeIds].filter((id) => graphNodeIds.has(id) && !covered.has(id) && !baselineNodeIds.has(id));
  if (unclassified.length > 0) warnings.push(`unclassified uncovered nodes: ${unclassified.join(", ")}`);

  const needsE2e = baselineEntries.filter((entry) => entry.status === "needs-e2e").map((entry) => entry.nodeId);
  if (needsE2e.length > 0) warnings.push(`nodes marked needs-e2e: ${needsE2e.join(", ")}`);

  const needsFlow = baselineEntries.filter((entry) => entry.status === "needs-flow").map((entry) => entry.nodeId);
  if (needsFlow.length > 0) warnings.push(`nodes marked needs-flow: ${needsFlow.join(", ")}`);

  const smokeOnlyUnclassified = [...smokeCovered].filter((id) => graphNodeIds.has(id) && !covered.has(id) && !baselineNodeIds.has(id));
  if (smokeOnlyUnclassified.length > 0) {
    warnings.push(`journey/smoke-only nodes missing needs-flow baseline: ${smokeOnlyUnclassified.join(", ")}`);
  }

  const undiscovered = inventory.nodes.filter((node) => !graphNodeIds.has(node.id));
  if (undiscovered.length > 0) {
    warnings.push(`discovered app nodes missing from graph: ${undiscovered.map((node) => node.id).join(", ")}`);
  }

  checkDirtyLegacyPaths(warnings);

  details.push(`nodes: ${(graph.nodes || []).length}`);
  details.push(`edges: ${(graph.edges || []).length}`);
  details.push(`discoveredNodes: ${inventory.nodes.length}`);
  if (warnings.length > 0) details.push(...warnings.map((warning) => `warning: ${warning}`));
  if (failures.length > 0) details.push(...failures.map((failure) => `failure: ${failure}`));

  if (failures.length > 0) {
    printVerdict("fail", `${failures.length} graph integrity failure(s)`, "fix listed failures", details);
    process.exitCode = 1;
  } else if (warnings.length > 0) {
    printVerdict("warning", `${warnings.length} graph warning(s)`, "review listed warnings", details);
  } else {
    printVerdict("pass", "graph integrity check passed", "none", details);
  }
} catch (error) {
  printVerdict("fail", `graph check failed: ${error.message}`, "fix graph check error");
  process.exitCode = 1;
}
