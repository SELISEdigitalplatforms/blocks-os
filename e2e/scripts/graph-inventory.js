#!/usr/bin/env node
const { discoverAppSurface } = require("./lib/discover-app-surface");
const { printVerdict } = require("./lib/common");

try {
  const inventory = discoverAppSurface();
  printVerdict("pass", `discovered ${inventory.nodes.length} app surface nodes`, "none");
  console.log(JSON.stringify(inventory, null, 2));
} catch (error) {
  printVerdict("fail", `discovery failed: ${error.message}`, "fix discovery error");
  process.exitCode = 1;
}
