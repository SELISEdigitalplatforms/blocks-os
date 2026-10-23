import { describe, expect, it } from "vitest";
import { IGrantScope } from "@blocks-idp/iam/models/grant-scope";
import {
  canManageUserAccess,
  getManagedByCandidates,
  isScopeRestricted,
} from "./grant-scope";

const scope = (overrides: Partial<IGrantScope> = {}): IGrantScope => ({
  isSystemUser: false,
  heldRoles: ["lead"],
  managedRoles: ["member", "lead"],
  assignableRoles: ["member"],
  heldPermissions: ["read"],
  ...overrides,
});

describe("grant-scope utils", () => {
  describe("isScopeRestricted", () => {
    it("is false until the scope is known", () => {
      expect(isScopeRestricted(undefined)).toBe(false);
    });
    it("is false for the system user", () => {
      expect(isScopeRestricted(scope({ isSystemUser: true }))).toBe(false);
    });
    it("is true for a non-system caller", () => {
      expect(isScopeRestricted(scope())).toBe(true);
    });
  });

  describe("getManagedByCandidates", () => {
    it("joins held and managed roles without duplicates", () => {
      expect(getManagedByCandidates(scope())).toEqual(["lead", "member"]);
    });
  });

  describe("canManageUserAccess", () => {
    it("allows everyone when not restricted", () => {
      expect(canManageUserAccess(undefined, { roles: ["x"], permissions: ["y"] })).toBe(true);
    });
    it("allows a user whose roles are assignable and permissions are held", () => {
      expect(canManageUserAccess(scope(), { roles: ["member"], permissions: ["read"] })).toBe(true);
    });
    it("refuses a user holding a role the caller cannot assign", () => {
      expect(canManageUserAccess(scope(), { roles: ["admin"], permissions: [] })).toBe(false);
    });
    it("refuses a user holding a direct permission the caller does not hold", () => {
      expect(canManageUserAccess(scope(), { roles: [], permissions: ["write"] })).toBe(false);
    });
  });
});
