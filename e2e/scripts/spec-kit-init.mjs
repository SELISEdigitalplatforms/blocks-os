#!/usr/bin/env node
/**
 * Bootstrap GitHub Spec Kit in e2e/ for Cursor (cursor-agent integration).
 * Re-run after upgrading specify-cli: npm run spec-kit:init
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(e2eDir, "..")

const specify = spawnSync(
  "specify",
  ["init", "--here", "--force", "--non-interactive", "--integration", "cursor-agent"],
  { cwd: e2eDir, stdio: "inherit" },
)

if (specify.status !== 0) {
  process.exit(specify.status ?? 1)
}

const repoRule = `---
description: Spec Kit workflow for Blocks OS e2e (spec → plan → tasks → implement)
globs: e2e/**
alwaysApply: false
---

# E2E Spec Kit (GitHub spec-kit)

Spec Kit is initialized under \`e2e/\`. Use it for spec-driven e2e work: bugs, new flows, and test gaps.

## Skills location

Cursor skills live at \`e2e/.cursor/skills/\` (local, gitignored). When working on \`e2e/**\`, read and follow the matching skill file:

| Step | Skill |
|------|-------|
| Principles (once) | \`e2e/.cursor/skills/speckit-constitution/SKILL.md\` |
| Spec | \`e2e/.cursor/skills/speckit-specify/SKILL.md\` |
| Clarify (optional) | \`e2e/.cursor/skills/speckit-clarify/SKILL.md\` |
| Plan | \`e2e/.cursor/skills/speckit-plan/SKILL.md\` |
| Tasks | \`e2e/.cursor/skills/speckit-tasks/SKILL.md\` |
| Analyze (optional) | \`e2e/.cursor/skills/speckit-analyze/SKILL.md\` |
| Implement | \`e2e/.cursor/skills/speckit-implement/SKILL.md\` |
| Converge | \`e2e/.cursor/skills/speckit-converge/SKILL.md\` |

Slash aliases (if your agent exposes them): \`/speckit-specify\`, \`/speckit-plan\`, \`/speckit-tasks\`, etc.

## Artifacts

- Constitution: \`e2e/.specify/memory/constitution.md\`
- Feature specs: \`e2e/specs/<feature>/\` (created by \`speckit-specify\`)
- Pre-captured page trees: \`e2e/snapshots/\` (run \`npm run snapshots:capture\`)

## Context for e2e specs

- Feature list: \`e2e/features.mjs\`
- Routes/helpers: \`e2e/support/os-helpers.ts\`, \`e2e/support/snapshot-routes.ts\`
- Env: \`e2e/.env.e2e\` (gitignored)

## Re-init

\`\`\`bash
cd e2e && npm run spec-kit:init
\`\`\`
`

const e2eRule = `---
description: Spec Kit commands and artifact paths for this e2e package
alwaysApply: true
---

This directory uses [GitHub Spec Kit](https://github.com/github/spec-kit) for spec-driven e2e development.

Workflow: constitution → specify → (clarify) → plan → tasks → (analyze) → implement → converge.

Skills: \`.cursor/skills/speckit-*/SKILL.md\` · Artifacts: \`specs/\`, \`.specify/\` · Snapshots: \`snapshots/\`
`

const repoRulesDir = path.join(repoRoot, ".cursor", "rules")
const e2eRulesDir = path.join(e2eDir, ".cursor", "rules")

fs.mkdirSync(repoRulesDir, { recursive: true })
fs.mkdirSync(e2eRulesDir, { recursive: true })
fs.writeFileSync(path.join(repoRulesDir, "e2e-speckit.mdc"), repoRule, "utf8")
fs.writeFileSync(path.join(e2eRulesDir, "speckit.mdc"), e2eRule, "utf8")

console.log("Wrote Cursor rules:")
console.log(`  ${path.join(repoRulesDir, "e2e-speckit.mdc")}`)
console.log(`  ${path.join(e2eRulesDir, "speckit.mdc")}`)
