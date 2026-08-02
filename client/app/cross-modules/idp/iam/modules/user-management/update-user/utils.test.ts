import { describe, expect, it } from "vitest";
import { inviteUserFormDefaultValue, inviteUserFormSchema } from "./utils";

describe("update-user form utils", () => {
  it("starts with empty names", () => {
    expect(inviteUserFormDefaultValue).toEqual({ firstName: "", lastName: "" });
  });

  it("accepts a first and last name", () => {
    expect(
      inviteUserFormSchema.safeParse({ firstName: "Ada", lastName: "Lovelace" }).success,
    ).toBe(true);
  });

  it("rejects a blank first name", () => {
    expect(inviteUserFormSchema.safeParse({ firstName: "  ", lastName: "Lovelace" }).success).toBe(
      false,
    );
  });

  it("rejects a blank last name", () => {
    expect(inviteUserFormSchema.safeParse({ firstName: "Ada", lastName: "" }).success).toBe(false);
  });

  it("rejects names longer than 150 characters", () => {
    const long = "a".repeat(151);
    expect(inviteUserFormSchema.safeParse({ firstName: long, lastName: "Lovelace" }).success).toBe(
      false,
    );
    expect(inviteUserFormSchema.safeParse({ firstName: "Ada", lastName: long }).success).toBe(
      false,
    );
  });

  it("trims surrounding whitespace", () => {
    const result = inviteUserFormSchema.safeParse({ firstName: " Ada ", lastName: " Lovelace " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Ada");
      expect(result.data.lastName).toBe("Lovelace");
    }
  });
});
