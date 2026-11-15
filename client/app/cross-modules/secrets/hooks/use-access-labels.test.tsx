import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory, mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { USER_ENDPOINTS } from "@/cross-modules/idp/iam/constants/endpoint.constant";
import { userDisplayName, useResolvedUserNames } from "./use-access-labels";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  ...mockProjectStoreFactory(),
}));

const KNOWN_ID = "user-known";
const MISSING_ID = "user-missing";

// The real UserService runs against a mocked HTTP client, so these tests cover the whole path
// from the IAM response to the label. The cache's onError stands in for the error reporter,
// which sees the same query errors.
const renderUserNames = (userIds: string[]) => {
  const onError = vi.fn();
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useResolvedUserNames(userIds), { wrapper });
  return { ...view, onError, queryClient };
};

const respondByUserId = (responses: Record<string, unknown>) => {
  vi.mocked(http.get).mockImplementation((url: string) => {
    const id = url.slice(`${USER_ENDPOINTS.GET_USERS}/`.length);
    return Promise.resolve(responses[id]);
  });
};

describe("userDisplayName", () => {
  it("prefers the full name, then the email, then the id", () => {
    expect(userDisplayName({ itemId: "u1", firstName: "Ana", lastName: "Lee" })).toBe("Ana Lee");
    expect(userDisplayName({ itemId: "u1", email: "ana@example.test" })).toBe("ana@example.test");
    expect(userDisplayName({ itemId: "u1" })).toBe("u1");
  });
});

describe("useResolvedUserNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("labels a resolved user by name and a missing user (data null) by the raw id", async () => {
    respondByUserId({
      [KNOWN_ID]: { data: { itemId: KNOWN_ID, firstName: "Ana", lastName: "Lee" }, errors: null },
      [MISSING_ID]: { data: null, errors: null },
    });

    const { result, onError, queryClient } = renderUserNames([KNOWN_ID, MISSING_ID]);

    // The missing user's label is the raw id while loading too, so wait for both to settle.
    await waitFor(() => {
      const queries = queryClient.getQueryCache().findAll({ queryKey: ["user-by-id"] });
      expect(queries.map((query) => query.state.status)).toEqual(["success", "success"]);
    });
    expect(result.current[KNOWN_ID]).toBe("Ana Lee");
    expect(result.current[MISSING_ID]).toBe(MISSING_ID);
    expect(onError).not.toHaveBeenCalled();
  });

  it("labels a user by the raw id when IAM returns no data field, without a query error", async () => {
    respondByUserId({ [MISSING_ID]: {} });

    const { result, onError, queryClient } = renderUserNames([MISSING_ID]);

    await waitFor(() =>
      expect(
        queryClient.getQueryCache().find({ queryKey: ["user-by-id"], exact: false })?.state.status,
      ).toBe("success"),
    );
    expect(result.current[MISSING_ID]).toBe(MISSING_ID);
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps the raw id when the lookup fails", async () => {
    vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

    const { result, onError } = renderUserNames([MISSING_ID]);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(result.current[MISSING_ID]).toBe(MISSING_ID);
  });
});
