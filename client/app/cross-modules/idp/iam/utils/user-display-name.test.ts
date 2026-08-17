import { describe, expect, it } from "vitest";
import {
  USER_DISPLAY_NAME_FALLBACK,
  USER_INITIALS_FALLBACK,
  getUserDisplayName,
  getUserInitials,
} from "./user-display-name";

describe("getUserDisplayName", () => {
  it("joins the first and last name", () => {
    expect(getUserDisplayName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
  });

  it("uses whichever name half is present", () => {
    expect(getUserDisplayName({ firstName: "Ada", lastName: null })).toBe("Ada");
    expect(getUserDisplayName({ firstName: "", lastName: "Lovelace" })).toBe("Lovelace");
  });

  it("collapses padding around each name part", () => {
    expect(getUserDisplayName({ firstName: "  Ada ", lastName: " Lovelace  " })).toBe(
      "Ada Lovelace",
    );
  });

  it("treats a whitespace-only name as absent and falls back to the email", () => {
    expect(
      getUserDisplayName({ firstName: "   ", lastName: "\t", email: "john.doe@yopmail.com" }),
    ).toBe("john.doe");
  });

  it("shows the email local part when there is no name", () => {
    expect(getUserDisplayName({ email: "john.doe@yopmail.com" })).toBe("john.doe");
  });

  it("falls back when there is neither a name nor an email", () => {
    expect(getUserDisplayName({ firstName: null, lastName: null, email: null })).toBe(
      USER_DISPLAY_NAME_FALLBACK,
    );
  });

  it("falls back when the email has no local part", () => {
    expect(getUserDisplayName({ email: "@yopmail.com" })).toBe(USER_DISPLAY_NAME_FALLBACK);
  });

  it("falls back for a missing user", () => {
    expect(getUserDisplayName(undefined)).toBe(USER_DISPLAY_NAME_FALLBACK);
    expect(getUserDisplayName(null)).toBe(USER_DISPLAY_NAME_FALLBACK);
  });
});

describe("getUserInitials", () => {
  it("uses the first letter of each name, uppercased", () => {
    expect(getUserInitials({ firstName: "ada", lastName: "lovelace" })).toBe("AL");
  });

  it("uses whichever name half is present", () => {
    expect(getUserInitials({ firstName: "Ada", lastName: "  " })).toBe("A");
    expect(getUserInitials({ firstName: null, lastName: "Lovelace" })).toBe("L");
  });

  it("ignores the email when a name exists", () => {
    expect(getUserInitials({ firstName: "Ada", email: "zoe@yopmail.com" })).toBe("A");
  });

  it("uses the first letter of the email local part, uppercased", () => {
    expect(getUserInitials({ email: "john.doe@yopmail.com" })).toBe("J");
  });

  it("falls back when there is neither a name nor an email", () => {
    expect(getUserInitials({ firstName: "", lastName: "", email: "" })).toBe(
      USER_INITIALS_FALLBACK,
    );
  });

  it("falls back when the email has no local part", () => {
    expect(getUserInitials({ email: "@yopmail.com" })).toBe(USER_INITIALS_FALLBACK);
  });

  it("falls back for a missing user", () => {
    expect(getUserInitials(undefined)).toBe(USER_INITIALS_FALLBACK);
    expect(getUserInitials(null)).toBe(USER_INITIALS_FALLBACK);
  });
});
