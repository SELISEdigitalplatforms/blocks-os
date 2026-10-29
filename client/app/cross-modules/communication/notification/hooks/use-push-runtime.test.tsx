import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushRuntimeService } from "../services/push-runtime.service";
import {
  usePushDevices,
  usePushStatus,
  useRemovePushDevice,
  useSendNotificationTest,
  useSendTestPush,
} from "./use-push-runtime";

vi.mock("../services/push-runtime.service", () => ({
  pushRuntimeService: {
    getStatus: vi.fn(),
    sendTest: vi.fn(),
    sendNotificationTest: vi.fn(),
    getDevices: vi.fn(),
    removeDevice: vi.fn(),
  },
}));

const service = vi.mocked(pushRuntimeService);

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
const invalidated = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((call) => (call[0] as { queryKey: string[] }).queryKey[0]);

describe("push runtime hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the status of the platforms", async () => {
    const status = { android: { devices: 2, lastTest: null } };
    service.getStatus.mockResolvedValue(status as never);
    const { wrapper } = setup();
    const { result } = renderHook(() => usePushStatus(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(status));
  });

  it("a test to my devices sends the platform and refreshes the status", async () => {
    service.sendTest.mockResolvedValue({ isSuccess: true } as never);
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useSendTestPush(), { wrapper });
    await act(() => result.current.mutateAsync({ platform: "ios" }));
    expect(service.sendTest).toHaveBeenCalledWith({ platform: "ios" });
    expect(invalidated(spy)).toEqual(["notification-push-status"]);
  });

  it("a draft test sends the draft and does not refresh the status", async () => {
    service.sendNotificationTest.mockResolvedValue({ isSuccess: true } as never);
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useSendNotificationTest(), { wrapper });
    const request = { titleKey: "T", bodyKey: "B", platforms: ["web"] };
    await act(() => result.current.mutateAsync(request as never));
    expect(service.sendNotificationTest).toHaveBeenCalledWith(request);
    expect(spy).not.toHaveBeenCalled();
  });

  it("loads the devices with the filter, search and page", async () => {
    service.getDevices.mockResolvedValue({ items: [], totalCount: 0 } as never);
    const { wrapper } = setup();
    const query = { platform: "ios" as const, search: "ana", page: 2, pageSize: 20 };
    const { result } = renderHook(() => usePushDevices(query), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getDevices).toHaveBeenCalledWith(query);
  });

  it("removing a device refreshes the list and the device counts", async () => {
    service.removeDevice.mockResolvedValue(undefined);
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useRemovePushDevice(), { wrapper });
    await act(() => result.current.mutateAsync("d1"));
    expect(service.removeDevice).toHaveBeenCalledWith("d1");
    expect(invalidated(spy).sort((a, b) => a.localeCompare(b))).toEqual([
      "notification-push-devices",
      "notification-push-status",
    ]);
  });

  it("a failed removal refreshes nothing", async () => {
    service.removeDevice.mockRejectedValue(new Error("gone"));
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useRemovePushDevice(), { wrapper });
    await act(() => result.current.mutateAsync("d1").catch(() => undefined));
    expect(spy).not.toHaveBeenCalled();
  });
});
