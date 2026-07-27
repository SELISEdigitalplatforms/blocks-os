import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import {
  mockAuthClientsServiceFactory,
  mockClientCredentialsResponse,
  mockSaveClientPayload,
  mockDeleteClientPayload,
} from "../../test-utils/__mocks__";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__";
import { authClientService } from "@blocks-idp/authentication/services/auth-clients.service";
import {
  useListAuthClientCredentials,
  useGetAuthClientCredentials,
  useSaveAuthClient,
  useDeleteAuthClient,
} from "./use-auth-clients";

vi.mock("@blocks-idp/authentication/services/auth-clients.service", () =>
  mockAuthClientsServiceFactory(),
);

describe("use-auth-clients hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("useListAuthClientCredentials", () => {
    it("should fetch client credentials successfully", async () => {
      vi.mocked(authClientService.clients.list).mockResolvedValue(mockClientCredentialsResponse);

      const { result } = renderHook(
        () => useListAuthClientCredentials({ projectKey: TEST_PROJECT_KEY }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockClientCredentialsResponse);
      expect(authClientService.clients.list).toHaveBeenCalledWith({
        projectKey: TEST_PROJECT_KEY,
      });
    });
  });

  describe("useGetAuthClientCredentials", () => {
    it("aliases useListAuthClientCredentials", async () => {
      vi.mocked(authClientService.clients.list).mockResolvedValue(mockClientCredentialsResponse);

      const { result } = renderHook(
        () => useGetAuthClientCredentials({ projectKey: TEST_PROJECT_KEY }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authClientService.clients.list).toHaveBeenCalledWith({
        projectKey: TEST_PROJECT_KEY,
      });
    });
  });

  describe("useSaveAuthClient", () => {
    it("should save client credential successfully", async () => {
      vi.mocked(authClientService.clients.save).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useSaveAuthClient({ projectKey: TEST_PROJECT_KEY }), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveClientPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authClientService.clients.save).toHaveBeenCalledWith(
        mockSaveClientPayload,
        expect.anything(),
      );
    });
  });

  describe("useDeleteAuthClient", () => {
    it("should delete client credential successfully", async () => {
      vi.mocked(authClientService.clients.delete).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useDeleteAuthClient({ projectKey: TEST_PROJECT_KEY }), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ itemId: mockDeleteClientPayload.itemId });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authClientService.clients.delete).toHaveBeenCalledWith({
        itemId: mockDeleteClientPayload.itemId,
      });
    });
  });
});
