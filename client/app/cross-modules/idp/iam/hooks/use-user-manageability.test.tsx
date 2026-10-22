import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDelegationScope } from "@blocks-idp/iam/models/delegation-scope";

const h = vi.hoisted(() => ({
  scope: undefined as unknown,
  isRestricted: true,
  authUser: { sub: "me", org_id: "org-1" } as { sub: string; org_id?: string } | undefined,
}));

vi.mock("@blocks-idp/iam/hooks/use-delegation-scope", () => ({
  useDelegationScope: () => ({ scope: h.scope, isRestricted: h.isRestricted }),
}));
vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ user: h.authUser }),
}));

import { useUserManageability } from "./use-user-manageability";

const scope: IDelegationScope = {
  isSystemUser: false,
  mode: "Enforce",
  heldRoles: ["lead"],
  managedRoles: ["member"],
  assignableRoles: ["member"],
  heldPermissions: ["read"],
};

const target = (roles: string[], permissions: string[] = [], organizationId = "org-1") =>
  ({ roles: { [organizationId]: roles }, permissions: { [organizationId]: permissions } }) as never;

describe("useUserManageability", () => {
  beforeEach(() => {
    h.scope = scope;
    h.isRestricted = true;
    h.authUser = { sub: "me", org_id: "org-1" };
  });

  it("lets the system user manage anyone and flags nobody as self", () => {
    h.isRestricted = false;
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.canManage(target(["admin"]))).toBe(true);
    expect(result.current.isSelf("me")).toBe(false);
  });

  it("allows a user whose roles in the token organization are assignable", () => {
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.canManage(target(["member"], ["read"]))).toBe(true);
  });

  it("refuses a user with a role or direct permission the caller cannot grant", () => {
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.canManage(target(["admin"]))).toBe(false);
    expect(result.current.canManage(target(["member"], ["write"]))).toBe(false);
  });

  it("looks only at the token's organization", () => {
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.canManage(target(["admin"], [], "org-2"))).toBe(true);
  });

  it("reads the default organization when the token names none", () => {
    h.authUser = { sub: "me" };
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.canManage(target(["admin"], [], "default"))).toBe(false);
  });

  it("does not block while the user is still loading", () => {
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.canManage(undefined)).toBe(true);
  });

  it("recognises the caller's own row", () => {
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.isSelf("me")).toBe(true);
    expect(result.current.isSelf("someone-else")).toBe(false);
  });

  it("recognises nobody as self when the caller is unknown", () => {
    h.authUser = undefined;
    const { result } = renderHook(() => useUserManageability());
    expect(result.current.isSelf("me")).toBe(false);
  });
});
