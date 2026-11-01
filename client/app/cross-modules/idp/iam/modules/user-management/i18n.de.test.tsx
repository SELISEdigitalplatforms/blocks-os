import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

import { buildInviteUserFormSchema } from "./invite-user/utils";
import { getEventMeta } from "./user-histories/event-meta";
import { UserOrganizationsList } from "./user-access/user-organizations-list";

const GERMAN = {
  "USER_ORGANIZATIONS_LIST.TITLE": "Organisationen",
  "USER_ORGANIZATIONS_LIST.ROLE_COUNT_one": "{{count}} Rolle",
  "USER_ORGANIZATIONS_LIST.ROLE_COUNT_other": "{{count}} Rollen",
  "USER_ORGANIZATIONS_LIST.PERMISSION_COUNT_one": "{{count}} Berechtigung",
  "USER_ORGANIZATIONS_LIST.PERMISSION_COUNT_other": "{{count}} Berechtigungen",
  "USER_ORGANIZATIONS_LIST.SUMMARY": "{{roles}} • {{permissions}}",
  "INVITE_USER_UTILS.EMAIL_REQUIRED": "E-Mail ist erforderlich",
  "EVENT_META.LABEL_SIGN_OUT": "Abmelden",
  "EVENT_META.DESCRIPTION_SIGNED_OUT": "Abgemeldet",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.users German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German in a component, a zod message and an event label", () => {
    useI18nStore.getState().setRemote("de", "os.idp.users", GERMAN);
    setLanguage("de");

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
    expect(screen.getByText("Organisationen")).toBeTruthy();
    expect(screen.getByText("1 Rolle • 2 Berechtigungen")).toBeTruthy();

    const result = buildInviteUserFormSchema(false).safeParse({
      email: "",
      roles: [],
      permissions: [],
    });
    const emailIssue = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === "email");
    expect(emailIssue?.message).toBe("E-Mail ist erforderlich");

    expect(getEventMeta("session_revoked").label).toBe("Abmelden");
    expect(getEventMeta("revoke_access_by_logout").description).toBe("Abgemeldet");
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    expect(getEventMeta("session_revoked").label).toBe("Sign out");
  });
});
