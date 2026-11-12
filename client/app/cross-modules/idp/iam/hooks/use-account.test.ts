import { createElement, ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import {
  mockUserServiceFactory,
  mockAccountActivationPayload,
  mockResendActivationPayload,
  mockAccountRecoverPayload,
  mockAccountResetPasswordPayload,
  mockActivationCodeValidationPayload,
  mockActivationCodeExpirationResponse,
} from "../../test-utils/__mocks__";
import { userService } from "@blocks-idp/iam/services/user.service";
import {
  useAccountActivation,
  useAccountResendActivation,
  useAccountDeactivate,
  useAccountActivateByAdmin,
  useAccountRecover,
  useAccountResetPassword,
  useAccountActivationCodeExpiration,
} from "./use-account";

vi.mock("@blocks-idp/iam/services/user.service", () => mockUserServiceFactory());

describe("use-account hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("useAccountActivation", () => {
    it("should activate account successfully", async () => {
      vi.mocked(userService.account.accountActivation).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useAccountActivation(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockAccountActivationPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.account.accountActivation).toHaveBeenCalledWith(
        mockAccountActivationPayload,
        expect.anything(),
      );
    });
  });

  describe("useAccountResendActivation", () => {
    it("should resend activation successfully", async () => {
      vi.mocked(userService.account.accountResendActivation).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useAccountResendActivation(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockResendActivationPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.account.accountResendActivation).toHaveBeenCalledWith(
        mockResendActivationPayload,
        expect.anything(),
      );
    });
  });

  // Both status changes re-read only the user acted on (and mark the Users list stale), on success
  // and on failure alike; the operator's own ["user"] record is never refetched (spec P3).
  const seedQueries = (client: QueryClient) => {
    const keys = [
      ["user-by-id", { id: "user-123", projectKey: "tenant-1" }],
      ["user-by-id", { id: "other-user", projectKey: "tenant-1" }],
      ["users", "tenant-1", {}],
      ["user"],
    ];
    keys.forEach((key) => client.setQueryData(key, { data: {} }));
    return (key: unknown[]) => client.getQueryState(key)?.isInvalidated;
  };

  const renderWithClient = <T>(hook: () => T) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const isInvalidated = seedQueries(client);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    return { ...renderHook(hook, { wrapper }), isInvalidated };
  };

  const expectOnlyChangedUserRefreshed = (
    isInvalidated: (key: unknown[]) => boolean | undefined,
  ) => {
    expect(isInvalidated(["user-by-id", { id: "user-123", projectKey: "tenant-1" }])).toBe(true);
    expect(isInvalidated(["users", "tenant-1", {}])).toBe(true);
    expect(isInvalidated(["user-by-id", { id: "other-user", projectKey: "tenant-1" }])).toBe(false);
    expect(isInvalidated(["user"])).toBe(false);
  };

  describe("useAccountDeactivate", () => {
    it("sends the user id and refreshes only that user after success", async () => {
      vi.mocked(userService.accountDeactivate).mockResolvedValue({ isSuccess: true });
      const { result, isInvalidated } = renderWithClient(() => useAccountDeactivate());

      result.current.mutate({ userId: "user-123" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.accountDeactivate).toHaveBeenCalledWith(
        { userId: "user-123" },
        expect.anything(),
      );
      expectOnlyChangedUserRefreshed(isInvalidated);
    });

    it("refreshes only that user after a failure too", async () => {
      vi.mocked(userService.accountDeactivate).mockRejectedValue({ status: 403, errors: {} });
      const { result, isInvalidated } = renderWithClient(() => useAccountDeactivate());

      result.current.mutate({ userId: "user-123" });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expectOnlyChangedUserRefreshed(isInvalidated);
    });
  });

  describe("useAccountActivateByAdmin", () => {
    it("sends the user id and reason and refreshes only that user after success", async () => {
      vi.mocked(userService.accountActivateByAdmin).mockResolvedValue({
        isSuccess: true,
        itemId: "user-123",
      });
      const { result, isInvalidated } = renderWithClient(() => useAccountActivateByAdmin());

      result.current.mutate({ userId: "user-123", reason: "Rejoined the team" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.accountActivateByAdmin).toHaveBeenCalledWith(
        { userId: "user-123", reason: "Rejoined the team" },
        expect.anything(),
      );
      expectOnlyChangedUserRefreshed(isInvalidated);
    });

    it("refreshes only that user after a failure too", async () => {
      vi.mocked(userService.accountActivateByAdmin).mockRejectedValue({
        status: 400,
        errors: { UserId: "User is already active" },
      });
      const { result, isInvalidated } = renderWithClient(() => useAccountActivateByAdmin());

      result.current.mutate({ userId: "user-123", reason: "Back from leave" });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expectOnlyChangedUserRefreshed(isInvalidated);
    });
  });

  describe("useAccountRecover", () => {
    it("should recover account successfully", async () => {
      vi.mocked(userService.account.accountRecover).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useAccountRecover(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockAccountRecoverPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.account.accountRecover).toHaveBeenCalledWith(
        mockAccountRecoverPayload,
        expect.anything(),
      );
    });
  });

  describe("useAccountResetPassword", () => {
    it("should reset password successfully", async () => {
      vi.mocked(userService.account.accountResetPassword).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useAccountResetPassword(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockAccountResetPasswordPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.account.accountResetPassword).toHaveBeenCalledWith(
        mockAccountResetPasswordPayload,
        expect.anything(),
      );
    });
  });

  describe("useAccountActivationCodeExpiration", () => {
    it("should check activation code expiration successfully", async () => {
      vi.mocked(userService.account.checkActivationCodeExpiration).mockResolvedValue(
        mockActivationCodeExpirationResponse,
      );

      const { result } = renderHook(() => useAccountActivationCodeExpiration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockActivationCodeValidationPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.account.checkActivationCodeExpiration).toHaveBeenCalledWith(
        mockActivationCodeValidationPayload,
        expect.anything(),
      );
    });
  });
});
