import fs from "fs";
import path from "path";

const OUTCOME_PATH = path.resolve(__dirname, "../fixtures/run-outcome.json");

let sharedTestsFailed = false;

/** Record that some test in the shared-project run failed. */
export function markSharedTestFailed() {
  sharedTestsFailed = true;
  fs.mkdirSync(path.dirname(OUTCOME_PATH), { recursive: true });
  fs.writeFileSync(OUTCOME_PATH, JSON.stringify({ failed: true }));
}

/** Delete the shared project only when every test using it passed. */
export function shouldDeleteSharedProject(): boolean {
  if (process.env.E2E_KEEP_PROJECT === "1") return false;
  if (fs.existsSync(OUTCOME_PATH)) return false;
  return !sharedTestsFailed;
}

export function resetRunOutcome() {
  sharedTestsFailed = false;
  if (fs.existsSync(OUTCOME_PATH)) fs.unlinkSync(OUTCOME_PATH);
}
