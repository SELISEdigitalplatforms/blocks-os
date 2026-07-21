import fs from "fs";
import path from "path";

// Shared state for the sequential flow specs (tests/flow/*). Each numbered file
// runs in order (workers: 1) and reads/writes this file so later steps know the
// project + person created by earlier steps. Gitignored via fixtures/*.json.
const FILE = path.resolve(__dirname, "../fixtures/flow-state.json");

export type FlowState = {
  projectName?: string;
  tenantGroupId?: string;
  personEmail?: string;
};

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

/** Lowercase alphanumeric token, e.g. randomToken(6) -> "k3d9za". */
export function randomToken(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Lowercase letters only (safe for domain labels), e.g. "abcde". */
export function randomLetters(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
