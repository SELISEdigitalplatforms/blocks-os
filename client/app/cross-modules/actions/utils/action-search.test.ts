import { describe, expect, it } from "vitest";
import { makeAction, sampleActions } from "../test-utils/__mocks__";
import { actionMatchesSearch, filterActionGroups } from "./action-search";
import { groupActions } from "./action-groups";

describe("actionMatchesSearch", () => {
  const action = makeAction();

  it("matches everything for an empty or blank search", () => {
    expect(actionMatchesSearch(action, "")).toBe(true);
    expect(actionMatchesSearch(action, "   ")).toBe(true);
  });

  it.each([
    ["name", "USER.CREATED"],
    ["label", "user created"],
    ["service", "iam"],
    ["payload field", "MFAENABLED"],
  ])("matches by %s, ignoring case", (_part, text) => {
    expect(actionMatchesSearch(action, text)).toBe(true);
  });

  it("does not match unrelated text or payload types", () => {
    expect(actionMatchesSearch(action, "invoice")).toBe(false);
    expect(actionMatchesSearch(action, "bool")).toBe(false);
  });
});

describe("filterActionGroups", () => {
  const groups = groupActions(sampleActions);

  it("returns all groups for an empty search", () => {
    expect(filterActionGroups(groups, "")).toEqual(groups);
  });

  it("keeps only matching actions and hides empty groups", () => {
    const result = filterActionGroups(groups, "generation");
    expect(result.map((group) => group.id)).toEqual(["Localization"]);
    expect(result[0].actions.map((item) => item.name)).toEqual(["localization.files.generated"]);
  });

  it("returns no groups when nothing matches", () => {
    expect(filterActionGroups(groups, "zzz")).toEqual([]);
  });
});
