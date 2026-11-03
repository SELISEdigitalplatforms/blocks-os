import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { addOrganizationFormSchema } from "../organization-management/add-organization/utils";
import { createAddRoleFormSchema } from "../role-management/add-role/utils";
vi.mock("./dependent-permissions/add-dependent-permission", () => ({
  AddDependentPermission: () => null,
}));

import { DependentPermissions } from "./dependent-permissions/dependent-permissions";

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp roles, permissions and organizations in German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German in a permissions component", () => {
    useI18nStore.getState().setRemote("de", "os.idp.permissions", {
      "DEPENDENT_PERMISSIONS.LABEL": "Abhängige Berechtigungen (max. {{max}})",
      "DEPENDENT_PERMISSIONS.EMPTY": "Keine abhängigen Berechtigungen ausgewählt",
    });
    setLanguage("de");

    render(<DependentPermissions permissionsResource={[]} onChange={() => undefined} disabled />);

    expect(screen.getByText("Abhängige Berechtigungen (max. 5)")).toBeTruthy();
    expect(screen.getByText("Keine abhängigen Berechtigungen ausgewählt")).toBeTruthy();
  });

  it("shows German in role and organization form messages", () => {
    useI18nStore.getState().setRemote("de", "os.idp.roles", {
      "ADD_ROLE.NAME_REQUIRED": "Ein Rollenname ist erforderlich.",
    });
    useI18nStore.getState().setRemote("de", "os.idp.organizations", {
      "ADD_ORGANIZATION_SCHEMA.NAME_REQUIRED": "Der Name ist erforderlich",
    });
    setLanguage("de");

    const role = createAddRoleFormSchema().safeParse({ name: "", slug: "x" });
    const organization = addOrganizationFormSchema.safeParse({ name: "" });

    expect(role.error?.issues[0].message).toBe("Ein Rollenname ist erforderlich.");
    expect(organization.error?.issues[0].message).toBe("Der Name ist erforderlich");
  });
});
