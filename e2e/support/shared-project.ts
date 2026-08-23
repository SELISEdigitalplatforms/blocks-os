import fs from "fs";
import path from "path";

export type SharedProjectFixture = {
  projectName: string;
  tenantGroupId: string;
  itemId: string;
  dashboardUrl: string;
};

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/shared-project.json");

export function readSharedProject(): SharedProjectFixture | null {
  if (!fs.existsSync(FIXTURE_PATH)) return null;
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as SharedProjectFixture;
}

export function writeSharedProject(fixture: SharedProjectFixture) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
}

export function clearSharedProject() {
  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH);
}
