import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { addOrganizationFormSchema } from "../organization-management/add-organization/utils";
import { createAddRoleFormSchema } from "../role-management/add-role/utils";
vi.mock("./dependent-permissions/add-dependent-permission", () => ({
  AddDependentPermission: () => null,
}));

import { DependentPermissions } from "./dependent-permissions/dependent-permissions";

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp roles, permissions and organizations in a non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows non-default language in a permissions component", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.permissions", {
      "DEPENDENT_PERMISSIONS.LABEL": "[xx] DEPENDENT_PERMISSIONS.LABEL {{max}}",
      "DEPENDENT_PERMISSIONS.EMPTY": "[xx] DEPENDENT_PERMISSIONS.EMPTY",
    });
    setLanguage("xx");

    render(<DependentPermissions permissionsResource={[]} onChange={() => undefined} disabled />);

    expect(screen.getByText("[xx] DEPENDENT_PERMISSIONS.LABEL 5")).toBeTruthy();
    expect(screen.getByText("[xx] DEPENDENT_PERMISSIONS.EMPTY")).toBeTruthy();
  });

  it("shows non-default language in role and organization form messages", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.roles", {
      "ADD_ROLE.NAME_REQUIRED": "[xx] ADD_ROLE.NAME_REQUIRED",
    });
    useI18nStore.getState().setRemote("xx", "os.idp.organizations", {
      "ADD_ORGANIZATION_SCHEMA.NAME_REQUIRED": "[xx] ADD_ORGANIZATION_SCHEMA.NAME_REQUIRED",
    });
    setLanguage("xx");

    const role = createAddRoleFormSchema().safeParse({ name: "", slug: "x" });
    const organization = addOrganizationFormSchema.safeParse({ name: "" });

    expect(role.error?.issues[0].message).toBe("[xx] ADD_ROLE.NAME_REQUIRED");
    expect(organization.error?.issues[0].message).toBe(
      "[xx] ADD_ORGANIZATION_SCHEMA.NAME_REQUIRED",
    );
  });
});
