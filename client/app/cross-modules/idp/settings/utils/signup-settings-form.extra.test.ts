import { describe, expect, it } from "vitest";
import type { IPermission } from "@blocks-idp/iam/models/permission";
import { createRoleStub } from "@blocks-idp/iam/utils/role-stub";
import type { ISettingsSignupConfig } from "@blocks-idp/settings/models/settings.model";
import {
  resolveSignupRoles,
  resolveSignupPermissions,
  toSignupSettingsFormValues,
  applySignupDisabledOverrides,
  buildSignupSettingsSavePayload,
} from "./signup-settings-form";

const enabledConfig: ISettingsSignupConfig = {
  isSignUpEnable: true,
  isEmailPasswordSignUpEnabled: true,
  isSSoSignUpEnabled: true,
  defaultRolesForNewUser: ["backend-role"],
  defaultPermissionsForNewUser: ["backend-perm"],
};

describe("signup-settings-form", () => {
  describe("resolveSignupRoles", () => {
    it("returns the matching role and a stub for unknown slugs", () => {
      const admin = createRoleStub({ slug: "admin", name: "Administrator" });
      const result = resolveSignupRoles(["admin", "ghost"], [admin]);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(admin);
      expect(result[1].slug).toBe("ghost");
      expect(result[1].name).toBe("ghost");
      expect(result[1].itemId).toBe("ghost");
    });

    it("returns an empty array for no slugs", () => {
      expect(resolveSignupRoles([], [])).toEqual([]);
    });
  });

  describe("resolveSignupPermissions", () => {
    it("returns the matching permission and a stub for unknown names", () => {
      const known = { name: "read-users", resource: "/api/users" } as IPermission;
      const result = resolveSignupPermissions(["read-users", "unknown-perm"], [known]);
      expect(result[0]).toBe(known);
      const stub = result[1];
      expect(stub.itemId).toBe("unknown-perm");
      expect(stub.name).toBe("unknown-perm");
      expect(stub.resource).toBe("");
      expect(stub.type).toBe(0);
      expect(stub.permissionSeverity).toBe(1);
      expect(stub.isBuiltIn).toBe(false);
    });
  });

  describe("toSignupSettingsFormValues", () => {
    it("projects the three form fields from the config", () => {
      expect(toSignupSettingsFormValues(enabledConfig)).toEqual({
        isEmailPasswordSignUpEnabled: true,
        defaultRolesForNewUser: ["backend-role"],
        defaultPermissionsForNewUser: ["backend-perm"],
      });
    });
  });

  describe("applySignupDisabledOverrides", () => {
    it("passes values through unchanged when signup is enabled", () => {
      const values = {
        isEmailPasswordSignUpEnabled: true,
        defaultRolesForNewUser: ["edited-role"],
        defaultPermissionsForNewUser: ["edited-perm"],
      };
      expect(applySignupDisabledOverrides(values, enabledConfig)).toBe(values);
    });

    it("restores backend roles/permissions when signup is disabled", () => {
      const values = {
        isEmailPasswordSignUpEnabled: false,
        defaultRolesForNewUser: ["edited-role"],
        defaultPermissionsForNewUser: ["edited-perm"],
      };
      const result = applySignupDisabledOverrides(values, enabledConfig);
      expect(result.defaultRolesForNewUser).toEqual(["backend-role"]);
      expect(result.defaultPermissionsForNewUser).toEqual(["backend-perm"]);
      expect(result.isEmailPasswordSignUpEnabled).toBe(false);
    });
  });

  describe("buildSignupSettingsSavePayload", () => {
    it("mirrors the enabled flag across all signup toggles when enabled", () => {
      const values = {
        isEmailPasswordSignUpEnabled: true,
        defaultRolesForNewUser: ["r1"],
        defaultPermissionsForNewUser: ["p1"],
      };
      expect(buildSignupSettingsSavePayload(values, enabledConfig)).toEqual({
        isSignUpEnable: true,
        isEmailPasswordSignUpEnabled: true,
        isSSoSignUpEnabled: true,
        defaultRolesForNewUserOnSignUp: ["r1"],
        defaultPermissionsForNewUserOnSignUp: ["p1"],
      });
    });

    it("disables every toggle and keeps backend roles/permissions when disabled", () => {
      const values = {
        isEmailPasswordSignUpEnabled: false,
        defaultRolesForNewUser: ["edited-role"],
        defaultPermissionsForNewUser: ["edited-perm"],
      };
      expect(buildSignupSettingsSavePayload(values, enabledConfig)).toEqual({
        isSignUpEnable: false,
        isEmailPasswordSignUpEnabled: false,
        isSSoSignUpEnabled: false,
        defaultRolesForNewUserOnSignUp: ["backend-role"],
        defaultPermissionsForNewUserOnSignUp: ["backend-perm"],
      });
    });
  });
});
