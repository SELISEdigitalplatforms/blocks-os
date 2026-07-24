import fs from "fs";
import path from "path";
import { randomInt } from "crypto";

// Shared state for the sequential flow specs (tests/flow/*). Each numbered file
// runs in order (workers: 1) and reads/writes this file so later steps know the
// project + person created by earlier steps. Gitignored via fixtures/*.json.
const FILE = path.resolve(__dirname, "../fixtures/flow-state.json");

export type FlowState = {
  projectName?: string;
  tenantGroupId?: string;
  personEmail?: string;
};

/**
 * The one project every flow step operates on.
 *
 * Set `E2E_PROJECT_NAME` in e2e/.env.e2e to pin a name (useful when you want to
 * inspect the project afterwards, or re-point the suite at an existing one).
 * Left blank it generates `e2e-<random>` per run, so parallel machines and
 * repeated runs never collide.
 *
 * Step 01 writes the resolved name into flow-state.json; every later step reads
 * it from there, so they all target the same project rather than "whatever
 * e2e-* card renders first".
 */
export function resolveProjectName(): string {
  const configured = process.env.E2E_PROJECT_NAME?.trim();
  return configured && configured.length > 0 ? configured : `e2e-${randomToken(6)}`;
}

/** Project + tenantGroupId recorded by step 01, or a clear failure message. */
export function requireProject(): Required<Pick<FlowState, "projectName" | "tenantGroupId">> {
  const { projectName, tenantGroupId } = readFlowState();

  if (!projectName || !tenantGroupId) {
    throw new Error(
      "No project in fixtures/flow-state.json — run 01-create-project first (the flow steps are sequential).",
    );
  }

  return { projectName, tenantGroupId };
}

export function readFlowState(): FlowState {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as FlowState;
  } catch {
    return {};
  }
}

export function writeFlowState(patch: FlowState): FlowState {
  const next = { ...readFlowState(), ...patch };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

/** Wipe the shared state so a run never inherits a previous run's project. */
export function resetFlowState(): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({}, null, 2));
}

/** Lowercase alphanumeric token, e.g. randomToken(6) -> "k3d9za". */
export function randomToken(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[randomInt(chars.length)];
  }
  return out;
}

/** Lowercase letters only (safe for domain labels), e.g. "abcde". */
export function randomLetters(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[randomInt(chars.length)];
  }
  return out;
}
