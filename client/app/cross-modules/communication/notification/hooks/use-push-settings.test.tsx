import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushSettingsService } from "../services/push-settings.service";
import { isPushReady, usePushSettings, useSavePushSettings } from "./use-push-settings";

vi.mock("../services/push-settings.service", () => ({
  pushSettingsService: { getSettings: vi.fn(), saveSettings: vi.fn() },
}));

const service = vi.mocked(pushSettingsService);
const READY = { projectId: "shop", enabled: true, hasKey: true };

const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const spy = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
};

describe("push settings hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("push is ready only with a project, a key and the switch on", () => {
    expect(isPushReady(READY)).toBe(true);
    expect(isPushReady()).toBe(false);
    expect(isPushReady({ ...READY, enabled: false })).toBe(false);
    expect(isPushReady({ ...READY, hasKey: false })).toBe(false);
    expect(isPushReady({ ...READY, projectId: null })).toBe(false);
  });

  it("does not load the settings when switched off by the caller", () => {
    const { wrapper } = setup();
    renderHook(() => usePushSettings({ enabled: false }), { wrapper });
    expect(service.getSettings).not.toHaveBeenCalled();
  });

  it("loads the settings by default", async () => {
    service.getSettings.mockResolvedValue(READY as never);
    const { wrapper } = setup();
    const { result } = renderHook(() => usePushSettings(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(READY));
  });

  it("a save refreshes the settings and the status", async () => {
    service.saveSettings.mockResolvedValue({ isSuccess: true } as never);
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useSavePushSettings(), { wrapper });
    await act(() => result.current.mutateAsync({ enabled: true } as never));
    expect(service.saveSettings).toHaveBeenCalledWith({ enabled: true });
    expect(spy.mock.calls.map((call) => (call[0] as { queryKey: string[] }).queryKey[0])).toEqual([
      "notification-push-settings",
      "notification-push-status",
    ]);
  });
});
