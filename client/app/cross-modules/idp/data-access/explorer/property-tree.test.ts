import { describe, expect, it } from "vitest";
import type { PlatformSchemaField } from "../data-access.service";
import { EVERYTHING_EXPANDED, NOTHING_EXPANDED, isPathExpanded, nestedRows, togglePath } from "./property-tree";

const f = (name: string, fields?: PlatformSchemaField[]): PlatformSchemaField => ({ name, type: fields ? "Object" : "String", isArray: false, fields });

const owner = f("Owner", [f("Address", [f("City"), f("Zip")]), f("Email")]);

describe("property tree", () => {
  it("lists only the direct children while nothing below is open", () => {
    expect(nestedRows({ path: "Owner", field: owner }, NOTHING_EXPANDED).map((r) => [r.path, r.depth, r.guides])).toEqual([
      ["Owner.Address", 1, ["tee"]],
      ["Owner.Email", 1, ["end"]],
    ]);
  });

  it("puts an open child's rows right after it, with a line passing them while siblings follow", () => {
    const rows = nestedRows({ path: "Owner", field: owner }, togglePath(NOTHING_EXPANDED, "Owner.Address"));
    expect(rows.map((r) => [r.path, r.guides])).toEqual([
      ["Owner.Address", ["tee"]],
      ["Owner.Address.City", ["through", "tee"]],
      ["Owner.Address.Zip", ["through", "end"]],
      ["Owner.Email", ["end"]],
    ]);
    expect(rows[0].isExpanded).toBe(true);
  });

  it("Expand all opens everything except what was closed since", () => {
    const closed = togglePath(EVERYTHING_EXPANDED, "Owner.Address");
    expect(isPathExpanded(EVERYTHING_EXPANDED, "Owner.Address")).toBe(true);
    expect(isPathExpanded(closed, "Owner.Address")).toBe(false);
    expect(isPathExpanded(closed, "Owner")).toBe(true);
  });
});
