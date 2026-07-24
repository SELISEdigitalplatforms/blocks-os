import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useGetRoleById, getPermissions } = vi.hoisted(() => ({
  useGetRoleById: vi.fn(),
  getPermissions: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({ useGetRoleById }));
vi.mock("@blocks-idp/iam/services/permission.service", () => ({
  permissionService: { getPermissions },
}));

import {
  RoleDetailsProvider,
  useRoleDetailsStore,
  type RoleDetailsState,
} from "./role-details-state";

const permissions = [
  {
    itemId: "p1",
    resource: "users:manage",
    resourceGroup: "Users",
    type: 2,
    dependentPermissions: ["users:view"],
    roles: ["admin"],
  },
  {
    itemId: "p2",
    resource: "users:view",
    resourceGroup: "Users",
    type: 1,
    dependentPermissions: [],
    roles: [],
  },
] as any[];

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <RoleDetailsProvider id="r1" projectKey="t1">
        {children}
      </RoleDetailsProvider>
    </QueryClientProvider>
  );
};

const renderStore = () =>
  renderHook(() => useRoleDetailsStore((s: RoleDetailsState) => s), { wrapper: makeWrapper() });

describe("role-details-state store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGetRoleById.mockReturnValue({ data: { data: { slug: "admin" } } });
    getPermissions.mockResolvedValue({ data: permissions });
  });

  it("throws when used outside its provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useRoleDetailsStore((s) => s))).toThrow(
      /Missing RoleDetailsProvider/,
    );
    spy.mockRestore();
  });

  it("initializes the permission map and records parent relationships", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    expect(result.current.permissionMap.get("users:manage")?.isInitiallyAssigned).toBe(true);
    expect(result.current.permissionMap.get("users:view")?.isInitiallyAssigned).toBe(false);
    expect(result.current.permissionMap.get("users:view")?.parents).toContain("users:manage");
  });

  it("ignores selection changes outside edit mode", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    act(() =>
      result.current.changePermissionSelection([
        { permissionResource: "users:view", isChecked: true },
      ]),
    );
    expect(result.current.permissionMap.get("users:view")?.modified).toBe(false);
  });

  it("marks a newly checked permission as added in edit mode", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    act(() => result.current.changeEditMode(true));
    act(() =>
      result.current.changePermissionSelection([
        { permissionResource: "users:view", isChecked: true },
      ]),
    );
    const perm = result.current.permissionMap.get("users:view");
    expect(perm?.modified).toBe(true);
    expect(perm?.changeState).toBe("added");
  });

  it("marks an unchecked initially-assigned permission as removed", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    act(() => result.current.changeEditMode(true));
    act(() =>
      result.current.changePermissionSelection([
        { permissionResource: "users:manage", isChecked: false },
      ]),
    );
    expect(result.current.permissionMap.get("users:manage")?.changeState).toBe("removed");
  });

  it("changes a whole group selection", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    act(() => result.current.changeEditMode(true));
    const groupPerms = Array.from(result.current.permissionMap.values());
    act(() => result.current.changePermissionGroupSelection(groupPerms, true));
    expect(result.current.permissionMap.get("users:view")?.changeState).toBe("added");
  });

  it("discards changes and leaves edit mode", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    act(() => result.current.changeEditMode(true));
    act(() =>
      result.current.changePermissionSelection([
        { permissionResource: "users:view", isChecked: true },
      ]),
    );
    act(() => result.current.discardChanges());
    expect(result.current.isEditMode).toBe(false);
    expect(result.current.permissionMap.get("users:view")?.modified).toBe(false);
  });

  it("commits changes, updating the initially-assigned baseline", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    act(() => result.current.changeEditMode(true));
    act(() =>
      result.current.changePermissionSelection([
        { permissionResource: "users:view", isChecked: true },
      ]),
    );
    act(() => result.current.commitChanges());
    expect(result.current.isEditMode).toBe(false);
    expect(result.current.permissionMap.get("users:view")?.isInitiallyAssigned).toBe(true);
    expect(result.current.permissionMap.get("users:view")?.modified).toBe(false);
  });
});
