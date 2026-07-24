import { afterEach, describe, expect, it } from "vitest";
import {
  buildInviteEnvironmentDetail,
  buildInvitePeoplePayload,
  DEFAULT_INVITE_ROLES,
} from "./invite-people-utils";

describe("invite-people-utils", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("builds invite payload with tenantId and roles objects", () => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: { user: { roles: { default: ["user"] } } },
        version: 0,
      }),
    );

    expect(
      buildInvitePeoplePayload(
        {
          "abdullah.momen.selise2037@gmail.com": ["dff08647ad46474da39aadf0088b228e"],
        },
        "dff08647ad46474da39aadf0088b228e",
      ),
    ).toEqual({
      invitations: {
        "abdullah.momen.selise2037@gmail.com": [
          { tenantId: "dff08647ad46474da39aadf0088b228e", roles: ["user"] },
        ],
      },
      groupId: "dff08647ad46474da39aadf0088b228e",
    });
  });

  it("falls back to default invite roles when auth-storage is missing", () => {
    expect(buildInviteEnvironmentDetail("tenant-1")).toEqual({
      tenantId: "tenant-1",
      roles: [...DEFAULT_INVITE_ROLES],
    });
  });

  it("deduplicates tenant ids per email", () => {
    expect(
      buildInvitePeoplePayload(
        { "user@example.com": ["tenant-1", "tenant-1", "tenant-2"] },
        "group-1",
      ),
    ).toEqual({
      invitations: {
        "user@example.com": [
          { tenantId: "tenant-1", roles: ["user"] },
          { tenantId: "tenant-2", roles: ["user"] },
        ],
      },
      groupId: "group-1",
    });
  });
});
