import { describe, expect, it } from "vitest";
import {
  buildInviteUserFormSchema,
  inviteUserFormDefaultValue,
  inviteUserFormSchema,
} from "./utils";

const base = { email: "ada@example.com", roles: [], permissions: [] };

describe("inviteUserFormDefaultValue", () => {
  it("starts with an empty email and no selections", () => {
    expect(inviteUserFormDefaultValue).toEqual({
      email: "",
      organizationIds: [],
      roles: [],
      permissions: [],
    });
  });
});

describe("buildInviteUserFormSchema", () => {
  it("requires an organization when multi-org is enabled", () => {
    const schema = buildInviteUserFormSchema(true);
    const result = schema.safeParse({ ...base, organizationIds: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a single selected organization when multi-org is enabled", () => {
    const schema = buildInviteUserFormSchema(true);
    expect(schema.safeParse({ ...base, organizationIds: ["default"] }).success).toBe(true);
  });

  it("allows an empty organization list when multi-org is disabled", () => {
    const schema = buildInviteUserFormSchema(false);
    expect(schema.safeParse({ ...base, organizationIds: [] }).success).toBe(true);
  });

  it("rejects a blank email", () => {
    const schema = buildInviteUserFormSchema(false);
    const result = schema.safeParse({ ...base, email: "   ", organizationIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const schema = buildInviteUserFormSchema(false);
    const result = schema.safeParse({ ...base, email: "not-an-email", organizationIds: [] });
    expect(result.success).toBe(false);
  });

  it("trims the email before validating", () => {
    const schema = buildInviteUserFormSchema(false);
    const result = schema.safeParse({ ...base, email: "  ada@example.com  ", organizationIds: [] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });
});

describe("inviteUserFormSchema", () => {
  it("defaults to the multi-org variant", () => {
    expect(inviteUserFormSchema.safeParse({ ...base, organizationIds: [] }).success).toBe(false);
  });
});
