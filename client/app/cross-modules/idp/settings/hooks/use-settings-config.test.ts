import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { settingsConfigService } from "@blocks-idp/settings/services/settings-config.service";
import {
  useSettingsAuthConfig,
  useSaveSettingsAuthConfig,
  useSettingsOrganizationConfig,
  useSaveSettingsOrganizationConfig,
  useSettingsSignUpSetting,
  useSaveSettingsSignUpSetting,
} from "./use-settings-config";

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("@blocks-idp/settings/services/settings-config.service", () => ({
  settingsConfigService: {
    getAuthConfig: vi.fn(),
    saveAuthConfig: vi.fn(),
    getOrganizationConfig: vi.fn(),
    saveOrganizationConfig: vi.fn(),
    getSignUpSetting: vi.fn(),
    saveSignUpSetting: vi.fn(),
  },
}));

describe("use-settings-config hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useSettingsAuthConfig fetches the auth config", async () => {
    vi.mocked(settingsConfigService.getAuthConfig).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSettingsAuthConfig(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settingsConfigService.getAuthConfig).toHaveBeenCalled();
  });

  it("useSettingsOrganizationConfig fetches the organization config", async () => {
    vi.mocked(settingsConfigService.getOrganizationConfig).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSettingsOrganizationConfig(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settingsConfigService.getOrganizationConfig).toHaveBeenCalled();
  });

  it("useSettingsSignUpSetting fetches the signup settings", async () => {
    vi.mocked(settingsConfigService.getSignUpSetting).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSettingsSignUpSetting(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settingsConfigService.getSignUpSetting).toHaveBeenCalled();
  });

  it("useSaveSettingsAuthConfig saves the auth config", async () => {
    vi.mocked(settingsConfigService.saveAuthConfig).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSaveSettingsAuthConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ foo: "bar" } as never);
    expect(settingsConfigService.saveAuthConfig).toHaveBeenCalled();
  });

  it("useSaveSettingsOrganizationConfig saves the organization config", async () => {
    vi.mocked(settingsConfigService.saveOrganizationConfig).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSaveSettingsOrganizationConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({} as never);
    expect(settingsConfigService.saveOrganizationConfig).toHaveBeenCalled();
  });

  it("useSaveSettingsOrganizationConfig invalidates the organization screens' caches", async () => {
    vi.mocked(settingsConfigService.saveOrganizationConfig).mockResolvedValue({} as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const configKey = ["organization", "config", "test-tenant-id-123"];
    const listKey = ["organizations", { page: 0, pageSize: 10, projectKey: "test-tenant-id-123" }];
    queryClient.setQueryData(configKey, { isMultiOrgEnabled: false });
    queryClient.setQueryData(listKey, { isSuccess: false, errors: { multi_org_disabled: "off" } });

    const { result } = renderHook(() => useSaveSettingsOrganizationConfig(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children),
    });
    await result.current.mutateAsync({} as never);

    expect(queryClient.getQueryState(configKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it("useSaveSettingsSignUpSetting saves the signup settings", async () => {
    vi.mocked(settingsConfigService.saveSignUpSetting).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSaveSettingsSignUpSetting(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({} as never);
    expect(settingsConfigService.saveSignUpSetting).toHaveBeenCalled();
  });
});
