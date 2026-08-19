import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({
  deleteRole: vi.fn(),
  deletePermission: vi.fn(),
}));

vi.mock("@blocks-idp/iam/services/role.service", () => ({
  roleService: { deleteRole: h.deleteRole },
}));
vi.mock("@blocks-idp/iam/services/iam.service", () => ({
  iamService: { permission: { deletePermission: h.deletePermission } },
}));

import { useDeleteRole } from "./use-roles";
import { useDeletePermission } from "./use-permission";

describe("archive mutation hooks", () => {
  let client: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  });

  const cases = [
    {
      name: "role",
      hook: useDeleteRole,
      service: h.deleteRole,
      key: "roles",
      id: "role-1",
    },
    {
      name: "permission",
      hook: useDeletePermission,
      service: h.deletePermission,
      key: "permissions",
      id: "perm-1",
    },
  ];

  it.each(cases)("$name: invalidates the list after a successful archive", async (c) => {
    c.service.mockResolvedValue({ isSuccess: true, itemId: c.id });
    const { result } = renderHook(() => c.hook(), { wrapper });

    await result.current.mutateAsync(c.id);

    expect(c.service).toHaveBeenCalledWith(c.id);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [c.key] }),
    );
  });

  it.each(cases)("$name: a thrown rejection does not invalidate", async (c) => {
    c.service.mockRejectedValue(
      Object.assign(new Error("bad request"), {
        errors: { dependency: "Role_Has_Child_Roles" },
      }),
    );
    const { result } = renderHook(() => c.hook(), { wrapper });

    await expect(result.current.mutateAsync(c.id)).rejects.toBeDefined();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each(cases)("$name: a resolved isSuccess:false rejects and does not invalidate", async (c) => {
    // The guard lives in mutationFn, not in the component. `mutateAsync` only resolves after
    // react-query has already classified the result and run onSuccess, so a component-level
    // check would show the right toast while the list had already refetched. The
    // no-invalidation half of this assertion is what fails if the guard moves.
    c.service.mockResolvedValue({
      isSuccess: false,
      errors: { archived: "Role_Already_Archived" },
    });
    const { result } = renderHook(() => c.hook(), { wrapper });

    const error = await result.current.mutateAsync(c.id).catch((e) => e);

    expect((error as { errors: unknown }).errors).toEqual({
      archived: "Role_Already_Archived",
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
