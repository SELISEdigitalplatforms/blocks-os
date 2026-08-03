import { describe, expect, it } from "vitest";
import { modules, translation } from "./language";

describe("localization model constants", () => {
  it("lists the selectable modules with matching value/label pairs", () => {
    expect(modules).toHaveLength(4);
    expect(modules.map((m) => m.value)).toContain("UILM Tool");
    modules.forEach((m) => expect(m.value).toBe(m.label));
  });

  it("lists the translation status options", () => {
    expect(translation.map((t) => t.value)).toEqual(["No_translation", "Complete"]);
    expect(translation[0].label).toBe("No translation");
  });
});
