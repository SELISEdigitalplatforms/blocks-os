import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  preview: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@blocks-idp/iam/services/user.service", () => ({
  userService: {
    previewBulkRoleChange: (payload: unknown) => h.preview(payload),
    submitBulkRoleChange: (payload: unknown) => h.submit(payload),
  },
}));

import {
  BULK_ROLE_INVALIDATED_QUERY_KEYS,
  usePreviewBulkRoleChange,
  useSubmitBulkRoleChange,
} from "./use-bulk-user-roles";

const idTargetPayload = {
  organizationId: "org-1",
  addRoles: ["viewer"],
  removeRoles: [],
  target: { userIds: ["u1", "u2"] },
};

const filterTargetPayload = {
  organizationId: "org-1",
  addRoles: [],
  removeRoles: ["editor"],
  target: { filter: { email: "", name: "", organizationIds: ["org-1"], roles: ["member"] } },
};

let queryClient: QueryClient;
let invalidated: unknown[][];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  invalidated = [];
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filters) => {
    invalidated.push((filters as { queryKey: unknown[] }).queryKey);
    return Promise.resolve();
  });
  h.preview.mockResolvedValue({
    isSuccess: true,
    errors: null,
    matchedCount: 312,
    affectedCount: 309,
    unchangedCount: 3,
  });
  h.submit.mockResolvedValue({ isSuccess: true, errors: null, batchId: "b_1", matchedCount: 312 });
});

describe("usePreviewBulkRoleChange", () => {
  it("passes an id target through to the service unchanged", async () => {
    const { result } = renderHook(() => usePreviewBulkRoleChange(), { wrapper });

    await result.current.mutateAsync(idTargetPayload);

    expect(h.preview).toHaveBeenCalledWith(idTargetPayload);
  });

  it("passes a filter target through to the service unchanged", async () => {
    const { result } = renderHook(() => usePreviewBulkRoleChange(), { wrapper });

    await result.current.mutateAsync(filterTargetPayload);

    expect(h.preview).toHaveBeenCalledWith(filterTargetPayload);
  });

  it("invalidates nothing, because a preview writes nothing", async () => {
    const { result } = renderHook(() => usePreviewBulkRoleChange(), { wrapper });

    await result.current.mutateAsync(idTargetPayload);

    expect(invalidated).toEqual([]);
  });

  it("surfaces a rejection to the caller instead of swallowing it", async () => {
    h.preview.mockRejectedValue({ errors: { Matched: "too broad" } });
    const { result } = renderHook(() => usePreviewBulkRoleChange(), { wrapper });

    await expect(result.current.mutateAsync(idTargetPayload)).rejects.toMatchObject({
      errors: { Matched: "too broad" },
    });
  });

  it("reports pending while the request is in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    h.preview.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => usePreviewBulkRoleChange(), { wrapper });

    result.current.mutate(idTargetPayload);
    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolve({ isSuccess: true, matchedCount: 0, affectedCount: 0, unchangedCount: 0 });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});

describe("useSubmitBulkRoleChange", () => {
  it("invalidates exactly the four user-shaped prefixes on success", async () => {
    // Nothing here proves the roles are already written -- IAM answers 202 before
    // its worker runs. The invalidation is so the list is correct once it does.
    const { result } = renderHook(() => useSubmitBulkRoleChange(), { wrapper });

    await result.current.mutateAsync(idTargetPayload);

    expect(invalidated).toEqual([["users"], ["user-by-id"], ["user"], ["user-roles"]]);
    expect(invalidated).toEqual(BULK_ROLE_INVALIDATED_QUERY_KEYS.map((key) => [...key]));
  });

  it("invalidates nothing when the submit fails", async () => {
    h.submit.mockRejectedValue({ errors: { Queue: "broker down" } });
    const { result } = renderHook(() => useSubmitBulkRoleChange(), { wrapper });

    await expect(result.current.mutateAsync(idTargetPayload)).rejects.toBeTruthy();

    expect(invalidated).toEqual([]);
  });

  it("reports pending while the request is in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    h.submit.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useSubmitBulkRoleChange(), { wrapper });

    result.current.mutate(idTargetPayload);
    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolve({ isSuccess: true, batchId: "b_1", matchedCount: 1 });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
