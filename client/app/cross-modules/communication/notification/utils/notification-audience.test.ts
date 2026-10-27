import { describe, expect, it } from "vitest";
import {
  audienceSummary,
  audienceToFormValues,
  buildAudiencePayload,
  emptyAudienceForm,
  formValuesToAudience,
} from "./notification-audience";

const rules = { ...emptyAudienceForm, audienceMode: "rules" as const, audienceRoles: [" admin "] };

describe("notification audience helpers", () => {
  it("reads a row without an audience, or with an empty one, as 'sender decides'", () => {
    expect(audienceToFormValues().audienceMode).toBe("sender");
    expect(audienceToFormValues(null).audienceMode).toBe("sender");
    expect(
      audienceToFormValues({
        everyoneInTenant: false,
        match: 0,
        userIds: [],
        organizationIds: [],
        roles: [],
        permissions: [],
        filters: [],
      }).audienceMode,
    ).toBe("sender");
  });

  it("drops the rules when the mode is not 'rules', so a hidden rule is never sent", () => {
    const audience = formValuesToAudience({ ...rules, audienceMode: "everyone" });
    expect(audience).toMatchObject({ everyoneInTenant: true, roles: [], match: 0 });
  });

  it("trims rule items and always sends every list", () => {
    expect(formValuesToAudience(rules)).toEqual({
      everyoneInTenant: false,
      match: 0,
      userIds: [],
      organizationIds: [],
      roles: ["admin"],
      permissions: [],
      filters: [],
    });
  });

  it("sends an audience only when it changed", () => {
    expect(buildAudiencePayload(emptyAudienceForm, emptyAudienceForm)).toBeUndefined();
    expect(buildAudiencePayload(rules, rules)).toBeUndefined();
    expect(buildAudiencePayload(emptyAudienceForm, rules)?.everyoneInTenant).toBe(false);
    expect(buildAudiencePayload(rules, emptyAudienceForm)?.roles).toEqual(["admin"]);
  });

  it("summarises the audience for the list", () => {
    expect(audienceSummary()).toBe("Code decides");
    expect(audienceSummary({ ...formValuesToAudience(rules) })).toBe("Rules (1)");
    expect(audienceSummary(formValuesToAudience({ ...rules, audienceMode: "everyone" }))).toBe(
      "Everyone",
    );
  });
});
