import { describe, expect, it } from "vitest";
import { makeAction, sampleActions } from "../test-utils/__mocks__";
import { buildPayloadExample, groupActions } from "./action-groups";

describe("groupActions", () => {
  it("splits IAM by what the action is about and keeps other services whole", () => {
    const groups = groupActions(sampleActions);

    expect(groups.map((group) => group.id)).toEqual([
      "iam.user",
      "iam.organization",
      "Localization",
    ]);
  });

  it("keeps an IAM action with an unknown prefix under IAM instead of dropping it", () => {
    const groups = groupActions([makeAction({ name: "iam.role.created" })]);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("IAM");
  });
});

describe("buildPayloadExample", () => {
  it("shows id, action, time, organizationId and a data object with one example per field", () => {
    const example = JSON.parse(buildPayloadExample(sampleActions[1]));

    expect(example.action).toBe("iam.organization.created");
    expect(example.organizationId).toBe("org_41c");
    expect(example.data).toEqual({
      organizationId: "organization_123",
      defaultRoleForMembers: ["example"],
    });
  });

  it("sends organizationId null for localization actions, which have no organization", () => {
    const example = JSON.parse(buildPayloadExample(sampleActions[2]));

    expect(example.organizationId).toBeNull();
    expect(example.data.isSuccess).toBe(true);
  });
});
