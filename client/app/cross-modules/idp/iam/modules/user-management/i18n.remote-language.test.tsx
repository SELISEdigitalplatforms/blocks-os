import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

import { buildInviteUserFormSchema } from "./invite-user/utils";
import { getEventMeta } from "./user-histories/event-meta";
import { UserOrganizationsList } from "./user-access/user-organizations-list";

const REMOTE = {
  "USER_ORGANIZATIONS_LIST.TITLE": "[xx] USER_ORGANIZATIONS_LIST.TITLE",
  "USER_ORGANIZATIONS_LIST.ROLE_COUNT_one": "{{count}} xx-role",
  "USER_ORGANIZATIONS_LIST.ROLE_COUNT_other": "{{count}} xx-roles",
  "USER_ORGANIZATIONS_LIST.PERMISSION_COUNT_one": "{{count}} xx-permission",
  "USER_ORGANIZATIONS_LIST.PERMISSION_COUNT_other": "{{count}} xx-permissions",
  "USER_ORGANIZATIONS_LIST.SUMMARY":
    "[xx] USER_ORGANIZATIONS_LIST.SUMMARY {{roles}} {{permissions}}",
  "INVITE_USER_UTILS.EMAIL_REQUIRED": "[xx] INVITE_USER_UTILS.EMAIL_REQUIRED",
  "EVENT_META.LABEL_SIGN_OUT": "[xx] EVENT_META.LABEL_SIGN_OUT",
  "EVENT_META.DESCRIPTION_SIGNED_OUT": "[xx] EVENT_META.DESCRIPTION_SIGNED_OUT",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.users non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows non-default language in a component, a zod message and an event label", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.users", REMOTE);
    setLanguage("xx");

    render(
      <UserOrganizationsList
        organizations={[
          { organizationId: "o1", name: "Acme", isEnabled: true, roleCount: 1, permissionCount: 2 },
        ]}
        selectedOrgId="o1"
        onSelect={() => undefined}
        onManageClick={() => undefined}
        isLoading={false}
        userId="u1"
        projectKey="p1"
        revokeTarget={null}
        onRevokeRequest={() => undefined}
        onRevokeDialogChange={() => undefined}
        onRevokeSuccess={() => undefined}
      />,
    );
    expect(screen.getByText("[xx] USER_ORGANIZATIONS_LIST.TITLE")).toBeTruthy();
    expect(
      screen.getByText("[xx] USER_ORGANIZATIONS_LIST.SUMMARY 1 xx-role 2 xx-permissions"),
    ).toBeTruthy();

    const result = buildInviteUserFormSchema(false).safeParse({
      email: "",
      roles: [],
      permissions: [],
    });
    const emailIssue = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === "email");
    expect(emailIssue?.message).toBe("[xx] INVITE_USER_UTILS.EMAIL_REQUIRED");

    expect(getEventMeta("session_revoked").label).toBe("[xx] EVENT_META.LABEL_SIGN_OUT");
    expect(getEventMeta("revoke_access_by_logout").description).toBe(
      "[xx] EVENT_META.DESCRIPTION_SIGNED_OUT",
    );
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    expect(getEventMeta("session_revoked").label).toBe("Sign out");
  });
});
