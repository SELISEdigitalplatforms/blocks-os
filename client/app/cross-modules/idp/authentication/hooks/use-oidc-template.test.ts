import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { mockAuthOidcServiceFactory } from "../../test-utils/__mocks__";
import { authOidc } from "@blocks-idp/authentication/services/auth-clients-oidc.service";
import { useGetOidcTemplate, useSaveOidcTemplate } from "./use-oidc-template";

vi.mock("@blocks-idp/authentication/services/auth-clients-oidc.service", () =>
  mockAuthOidcServiceFactory(),
);
vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());

const template = {
  branding: { brandName: "Blocks IAM", logoUrl: null },
  theme: {
    light: { primary: "#0066b2" },
    dark: { primary: "#0066b2" },
  },
  pages: { login: { heading: "Sign in" } },
};

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const wrapperFor = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return Wrapper;
};

describe("OIDC template hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the current tenant template without a client id", async () => {
    vi.mocked(authOidc.clients.getOidcTemplate).mockResolvedValue(template as never);
    const { result } = renderHook(() => useGetOidcTemplate(), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(template);
    expect(authOidc.clients.getOidcTemplate).toHaveBeenCalledWith();
  });

  it("saves a complete template and invalidates only the tenant template query", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(authOidc.clients.saveOidcTemplate).mockResolvedValue({
      isSuccess: true,
      itemId: "template-1",
    });
    const { result } = renderHook(() => useSaveOidcTemplate(), {
      wrapper: wrapperFor(client),
    });

    result.current.mutate(template as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authOidc.clients.saveOidcTemplate).toHaveBeenCalledWith(template);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["authentication", "oidc-template", "test-tenant-id-123"],
    });
  });

  it("does not refetch or replace the baseline after a rejected save response", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(authOidc.clients.saveOidcTemplate).mockResolvedValue({
      isSuccess: false,
      errors: { "Branding.BrandName": "invalid" },
    });
    const { result } = renderHook(() => useSaveOidcTemplate(), {
      wrapper: wrapperFor(client),
    });

    result.current.mutate(template as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
