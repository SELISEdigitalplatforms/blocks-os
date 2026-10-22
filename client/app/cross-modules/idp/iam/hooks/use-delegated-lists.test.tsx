import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { iamService } from "@blocks-idp/iam/services/iam.service";
import { useGetAssignableRoles } from "./use-roles";
import { useGetGrantablePermissions } from "./use-permission";

const h = vi.hoisted(() => ({
  scope: {
    isLoading: false,
    isRestricted: true,
    assignableRoles: ["member", "guest"] as string[],
    heldPermissions: ["read", "list"] as string[],
  },
}));

vi.mock("@blocks-idp/iam/hooks/use-delegation-scope", () => ({
  useDelegationScope: () => h.scope,
}));
vi.mock("@blocks-idp/iam/services/role.service", () => ({
  roleService: { getRoles: vi.fn() },
}));
vi.mock("@blocks-idp/iam/services/iam.service", () => ({
  iamService: { permission: { getPermissions: vi.fn() } },
}));

const rolesPayload = {
  page: 0,
  pageSize: 10,
  projectKey: "pk",
  filter: { search: "mem" },
};
const permissionsPayload = {
  page: 0,
  pageSize: 10,
  projectKey: "pk",
  search: "",
  isBuiltIn: "",
  roles: [],
};

describe("useGetAssignableRoles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.scope = {
      isLoading: false,
      isRestricted: true,
      assignableRoles: ["member", "guest"],
      heldPermissions: ["read", "list"],
    };
    vi.mocked(roleService.getRoles).mockResolvedValue({ data: [], errors: null, totalCount: 0 });
  });

  it("narrows the query to the assignable slugs and keeps the search", async () => {
    const { result } = renderHook(() => useGetAssignableRoles(rolesPayload), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(roleService.getRoles).toHaveBeenCalledWith({
      ...rolesPayload,
      filter: { search: "mem", slugs: ["member", "guest"] },
    });
  });

  it("keeps only the assignable ones of a slug list the caller asked for", async () => {
    const { result } = renderHook(
      () =>
        useGetAssignableRoles({ ...rolesPayload, filter: { slugs: ["guest", "admin"] } }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(roleService.getRoles).toHaveBeenCalledWith({
      ...rolesPayload,
      filter: { slugs: ["guest"] },
    });
  });

  it("returns an empty list without asking when nothing is assignable", async () => {
    h.scope.assignableRoles = [];
    const { result } = renderHook(() => useGetAssignableRoles(rolesPayload), {
      wrapper: createWrapper(),
    });
    expect(result.current.data).toEqual({ data: [], errors: null, totalCount: 0 });
    expect(result.current.isLoading).toBe(false);
    expect(roleService.getRoles).not.toHaveBeenCalled();
  });

  it("waits for the scope before asking, and reports loading", () => {
    h.scope.isLoading = true;
    const { result } = renderHook(() => useGetAssignableRoles(rolesPayload), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(roleService.getRoles).not.toHaveBeenCalled();
  });

  it("sends today's query for an unrestricted caller", async () => {
    h.scope.isRestricted = false;
    h.scope.assignableRoles = [];
    const { result } = renderHook(() => useGetAssignableRoles(rolesPayload), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(roleService.getRoles).toHaveBeenCalledWith(rolesPayload);
  });

  it("does not ask while disabled", () => {
    renderHook(() => useGetAssignableRoles(rolesPayload, { enabled: false }), {
      wrapper: createWrapper(),
    });
    expect(roleService.getRoles).not.toHaveBeenCalled();
  });
});

describe("useGetGrantablePermissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.scope = {
      isLoading: false,
      isRestricted: true,
      assignableRoles: [],
      heldPermissions: ["read", "list"],
    };
    vi.mocked(iamService.permission.getPermissions).mockResolvedValue({
      data: [],
      errors: null,
      totalCount: 0,
    } as never);
  });

  it("narrows the query to the held resources", async () => {
    const { result } = renderHook(() => useGetGrantablePermissions(permissionsPayload), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(iamService.permission.getPermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ resources: ["read", "list"] }),
      }),
    );
  });

  it("returns an empty list without asking when the caller holds nothing", () => {
    h.scope.heldPermissions = [];
    const { result } = renderHook(() => useGetGrantablePermissions(permissionsPayload), {
      wrapper: createWrapper(),
    });
    expect(result.current.data).toEqual({ data: [], errors: null, totalCount: 0 });
    expect(iamService.permission.getPermissions).not.toHaveBeenCalled();
  });

  it("waits for the scope, then sends today's query for an unrestricted caller", async () => {
    h.scope.isLoading = true;
    const { result, rerender } = renderHook(() => useGetGrantablePermissions(permissionsPayload), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(iamService.permission.getPermissions).not.toHaveBeenCalled();

    h.scope.isLoading = false;
    h.scope.isRestricted = false;
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(iamService.permission.getPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.not.objectContaining({ resources: expect.anything() }) }),
    );
  });
});
