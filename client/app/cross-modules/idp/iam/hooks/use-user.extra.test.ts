import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import {
  mockUserServiceFactory,
  mockUser,
  mockCreateUserPayload,
  mockUpdateUserPayload,
  mockSaveSignUpSettingPayload,
  mockSaveRolesAndPermissionsPayload,
  MOCK_USER_ITEM_ID,
} from "../../test-utils/__mocks__";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__";
import { userService } from "@blocks-idp/iam/services/user.service";
import {
  useGetUserInfo,
  useGetMe,
  useGetProfileUserById,
  useGetUserById,
  useAddUser,
  useUpdateUser,
  useSaveSignUpSetting,
  useAddRolesAndPermissionToUser,
  useUserRoles,
  useUserPermissions,
} from "./use-user";

// The shared factory doesn't declare getUserInfo/me, so extend it here.
vi.mock("@blocks-idp/iam/services/user.service", () => {
  const base = mockUserServiceFactory();
  return {
    userService: {
      ...base.userService,
      getUserInfo: vi.fn(),
      me: vi.fn(),
    },
  };
});

const mockSetUser = vi.fn();
vi.mock("@seliseblocks/blocks-kit/store", () => ({
  useAuthStore: vi.fn(() => ({ setUser: mockSetUser, user: undefined })),
}));

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const wrapperWith = (client: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };

describe("use-user extra hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetUserInfo", () => {
    it("fetches user info", async () => {
      vi.mocked(userService.getUserInfo).mockResolvedValue(mockUser as never);
      const { result } = renderHook(() => useGetUserInfo(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.getUserInfo).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockUser);
    });

    it("stays idle when disabled", () => {
      const { result } = renderHook(() => useGetUserInfo({ enabled: false }), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
      expect(userService.getUserInfo).not.toHaveBeenCalled();
    });
  });

  describe("useGetMe", () => {
    it("fetches me and pushes user into the auth store", async () => {
      vi.mocked(userService.me).mockResolvedValue({ data: mockUser });
      const { result } = renderHook(() => useGetMe(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.me).toHaveBeenCalled();
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });

    it("does not set the user when the response has no data", async () => {
      vi.mocked(userService.me).mockResolvedValue({ data: null } as never);
      const { result } = renderHook(() => useGetMe(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockSetUser).not.toHaveBeenCalled();
    });
  });

  describe("useGetProfileUserById", () => {
    it("fetches the profile user with id and project key", async () => {
      vi.mocked(userService.getUserById).mockResolvedValue({ data: mockUser } as never);
      const { result } = renderHook(
        () =>
          useGetProfileUserById({
            id: MOCK_USER_ITEM_ID,
            projectKey: TEST_PROJECT_KEY,
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(userService.getUserById).toHaveBeenCalledWith({
        id: MOCK_USER_ITEM_ID,
        projectKey: TEST_PROJECT_KEY,
      });
    });
  });

  describe("useGetUserById disabled branch", () => {
    it("stays idle when enabled is false", () => {
      const { result } = renderHook(
        () =>
          useGetUserById({
            id: MOCK_USER_ITEM_ID,
            projectKey: TEST_PROJECT_KEY,
            enabled: false,
          }),
        { wrapper: createWrapper() },
      );
      expect(result.current.fetchStatus).toBe("idle");
      expect(userService.getUserById).not.toHaveBeenCalled();
    });
  });

  describe("useAddUser onSuccess", () => {
    it("invalidates users and subscription-usage queries", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(userService.addUser).mockResolvedValue(undefined as never);
      const { result } = renderHook(() => useAddUser(), {
        wrapper: wrapperWith(client),
      });
      result.current.mutate(mockCreateUserPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({ queryKey: ["users"] });
      expect(spy).toHaveBeenCalledWith({ queryKey: ["subscription-usage"] });
    });
  });

  describe("useUpdateUser onSuccess", () => {
    it("invalidates the current user query when own", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(userService.updateUser).mockResolvedValue(undefined as never);
      const { result } = renderHook(
        () =>
          useUpdateUser({
            id: MOCK_USER_ITEM_ID,
            projectKey: TEST_PROJECT_KEY,
            own: true,
          }),
        { wrapper: wrapperWith(client) },
      );
      result.current.mutate(mockUpdateUserPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({ queryKey: ["user"] });
      expect(spy).not.toHaveBeenCalledWith({
        queryKey: ["user-by-id", { id: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }],
      });
    });

    it("invalidates the user-by-id query when not own", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(userService.updateUser).mockResolvedValue(undefined as never);
      const { result } = renderHook(
        () => useUpdateUser({ id: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }),
        { wrapper: wrapperWith(client) },
      );
      result.current.mutate(mockUpdateUserPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({
        queryKey: ["user-by-id", { id: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }],
      });
    });
  });

  describe("useSaveSignUpSetting onSuccess", () => {
    it("invalidates the sign-up-setting query", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(userService.saveSignUpSetting).mockResolvedValue(undefined as never);
      const { result } = renderHook(() => useSaveSignUpSetting(), {
        wrapper: wrapperWith(client),
      });
      result.current.mutate(mockSaveSignUpSettingPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({ queryKey: ["sign-up-setting"] });
    });
  });

  describe("useAddRolesAndPermissionToUser onSuccess", () => {
    it("invalidates roles and permissions when type is role", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(userService.saveRolesAndPermissions).mockResolvedValue(undefined as never);
      const { result } = renderHook(() => useAddRolesAndPermissionToUser("role"), {
        wrapper: wrapperWith(client),
      });
      result.current.mutate(mockSaveRolesAndPermissionsPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith({ queryKey: ["user-roles"] });
      expect(spy).toHaveBeenCalledWith({ queryKey: ["user-permissions"] });
    });

    it("invalidates only permissions when type is not role", async () => {
      const client = makeClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      vi.mocked(userService.saveRolesAndPermissions).mockResolvedValue(undefined as never);
      const { result } = renderHook(() => useAddRolesAndPermissionToUser("permission"), {
        wrapper: wrapperWith(client),
      });
      result.current.mutate(mockSaveRolesAndPermissionsPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).not.toHaveBeenCalledWith({ queryKey: ["user-roles"] });
      expect(spy).toHaveBeenCalledWith({ queryKey: ["user-permissions"] });
    });
  });

  describe("useUserRoles", () => {
    it("derives slugs and adds/deletes roles through updateUser", async () => {
      vi.mocked(userService.getUserById).mockResolvedValue({
        data: {
          ...mockUser,
          organizationIds: ["org-1"],
          permissions: { default: ["read"] },
        },
      } as never);
      vi.mocked(userService.getUserRoles).mockResolvedValue({
        data: [{ slug: "admin" }, { slug: "editor" }],
      } as never);
      vi.mocked(userService.updateUser).mockResolvedValue(undefined as never);

      const { result } = renderHook(
        () => useUserRoles({ id: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.slugs).toEqual(["admin", "editor"]);

      await result.current.addRoles(["viewer"]);
      const addArg = vi.mocked(userService.updateUser).mock.calls[0][0];
      expect(addArg.itemId).toBe(MOCK_USER_ITEM_ID);
      expect(addArg.roles).toEqual(expect.arrayContaining(["admin", "editor", "viewer"]));
      expect(addArg.organizations).toEqual(["org-1"]);
      expect(addArg.permissions).toEqual(["read"]);

      await result.current.deleteRoles(["admin"]);
      const deleteArg = vi.mocked(userService.updateUser).mock.calls[1][0];
      expect(deleteArg.roles).toEqual(["editor"]);
    });
  });

  describe("useUserPermissions", () => {
    it("derives resources and adds/deletes permissions through updateUser", async () => {
      vi.mocked(userService.getUserById).mockResolvedValue({
        data: {
          ...mockUser,
          organizationIds: ["org-9"],
          roles: { default: ["admin"] },
        },
      } as never);
      vi.mocked(userService.getUserPermissions).mockResolvedValue({
        data: [{ resource: "res-a" }, { resource: "res-b" }],
      } as never);
      vi.mocked(userService.updateUser).mockResolvedValue(undefined as never);

      const { result } = renderHook(
        () => useUserPermissions({ userId: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.resources).toEqual(["res-a", "res-b"]);

      await result.current.addPermissions(["res-c"]);
      const addArg = vi.mocked(userService.updateUser).mock.calls[0][0];
      expect(addArg.itemId).toBe(MOCK_USER_ITEM_ID);
      expect(addArg.permissions).toEqual(expect.arrayContaining(["res-a", "res-b", "res-c"]));
      expect(addArg.roles).toEqual(["admin"]);

      await result.current.deletePermissions(["res-a"]);
      const deleteArg = vi.mocked(userService.updateUser).mock.calls[1][0];
      expect(deleteArg.permissions).toEqual(["res-b"]);
    });
  });
});
