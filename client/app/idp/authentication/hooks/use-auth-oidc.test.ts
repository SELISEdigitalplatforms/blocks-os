import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import {
  mockAuthOidcServiceFactory,
  mockOidcCredentialsResponse,
  mockOidcCredentialResponse,
  mockSaveOidcPayload,
  mockDeleteClientPayload,
  mockRotateOidcSecretPayload,
  MOCK_OIDC_ITEM_ID,
} from "../../test-utils/__mocks__";
import { TEST_PROJECT_KEY, mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { authOidc } from "@blocks-idp/authentication/services/auth-clients-oidc.service";
import { getBlocksOidcWellKnownUrl } from "@/lib/get-api-path";
import {
  useGetAuthOidcCredentials,
  useGetAuthOidcCredential,
  useSaveAuthOidc,
  useDeleteAuthOidc,
  useRotateAuthOidcSecret,
} from "./use-auth-oidc";

vi.mock("@blocks-idp/authentication/services/auth-clients-oidc.service", () =>
  mockAuthOidcServiceFactory(),
);

vi.mock("@seliseblocks/blocks-kit", () => mockProjectStoreFactory());

type BlocksWindow = Window & {
  __BLOCKS_ENV__?: Record<string, string | undefined>;
};

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const wrapperWith = (client: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
};

describe("use-auth-oidc hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_IAM_BASE_URL: "https://dev-iam.blocksdevelopers.com",
    };
  });

  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  describe("useGetAuthOidcCredentials", () => {
    it("should fetch OIDC credentials list successfully", async () => {
      vi.mocked(authOidc.clients.getOidcCredentials).mockResolvedValue(mockOidcCredentialsResponse);

      const { result } = renderHook(
        () => useGetAuthOidcCredentials({ projectKey: TEST_PROJECT_KEY }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockOidcCredentialsResponse);
      expect(authOidc.clients.getOidcCredentials).toHaveBeenCalledWith();
    });
  });

  describe("useGetAuthOidcCredential", () => {
    it("should fetch a single OIDC credential successfully", async () => {
      vi.mocked(authOidc.clients.getOidcCredential).mockResolvedValue(mockOidcCredentialResponse);

      const options = { projectKey: TEST_PROJECT_KEY, clientId: MOCK_OIDC_ITEM_ID };
      const { result } = renderHook(() => useGetAuthOidcCredential(options), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockOidcCredentialResponse);
      expect(authOidc.clients.getOidcCredential).toHaveBeenCalledWith(options);
    });
  });

  describe("useSaveAuthOidc", () => {
    it("should save OIDC credential successfully", async () => {
      vi.mocked(authOidc.clients.saveOidcCredential).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useSaveAuthOidc(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveOidcPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authOidc.clients.saveOidcCredential).toHaveBeenCalledWith(mockSaveOidcPayload);
    });

    it("should add externalDiscoveryEndpoint when registerAsIdentityProvider is true", async () => {
      vi.mocked(authOidc.clients.saveOidcCredential).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useSaveAuthOidc(), {
        wrapper: createWrapper(),
      });

      const payload = { ...mockSaveOidcPayload, registerAsIdentityProvider: true };
      result.current.mutate(payload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authOidc.clients.saveOidcCredential).toHaveBeenCalledWith({
        ...payload,
        externalDiscoveryEndpoint: getBlocksOidcWellKnownUrl("test-tenant-id-123"),
      });
    });

    it("should not add externalDiscoveryEndpoint when registerAsIdentityProvider is false", async () => {
      vi.mocked(authOidc.clients.saveOidcCredential).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useSaveAuthOidc(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveOidcPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authOidc.clients.saveOidcCredential).toHaveBeenCalledWith(mockSaveOidcPayload);
      expect(authOidc.clients.saveOidcCredential).not.toHaveBeenCalledWith(
        expect.objectContaining({ externalDiscoveryEndpoint: expect.any(String) }),
      );
    });

    it("should invalidate identity-providers when registerAsIdentityProvider is true", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(authOidc.clients.saveOidcCredential).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useSaveAuthOidc(), {
        wrapper: wrapperWith(client),
      });

      const payload = { ...mockSaveOidcPayload, registerAsIdentityProvider: true };
      result.current.mutate(payload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({ queryKey: ["identity-providers"] });
    });

    it("should invalidate identity-providers when registerAsIdentityProvider is false", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(authOidc.clients.saveOidcCredential).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useSaveAuthOidc(), {
        wrapper: wrapperWith(client),
      });

      result.current.mutate(mockSaveOidcPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({ queryKey: ["identity-providers"] });
    });
  });

  describe("useDeleteAuthOidc", () => {
    it("should delete OIDC credential successfully", async () => {
      vi.mocked(authOidc.clients.deleteOidcCredential).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useDeleteAuthOidc({ projectKey: TEST_PROJECT_KEY }), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockDeleteClientPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authOidc.clients.deleteOidcCredential).toHaveBeenCalledWith(mockDeleteClientPayload, expect.anything());
    });
  });

  describe("useRotateAuthOidcSecret", () => {
    it("should rotate OIDC client secret successfully", async () => {
      vi.mocked(authOidc.clients.rotateOidcClientSecret).mockResolvedValue(undefined as never);

      const { result } = renderHook(
        () => useRotateAuthOidcSecret({ projectKey: TEST_PROJECT_KEY }),
        { wrapper: createWrapper() },
      );

      result.current.mutate(mockRotateOidcSecretPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authOidc.clients.rotateOidcClientSecret).toHaveBeenCalledWith(
        mockRotateOidcSecretPayload,
        expect.anything(),
      );
    });
  });
});
