import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/http/http-client", () => ({ http: { get: h.get, post: h.post, delete: h.del } }));
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: () => "https://logic.example/" }));

import { pushRuntimeService } from "./push-runtime.service";

const BASE = "https://logic.example/api/Notifier";
const ABSOLUTE = { absoluteUrl: true };

describe("PushRuntimeService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks the logic service for devices with the platform and search, trimmed", async () => {
    h.get.mockResolvedValue({ items: [], totalCount: 0, counts: {} });
    await pushRuntimeService.getDevices({
      platform: "ios",
      search: " ana ",
      page: 2,
      pageSize: 20,
    });
    expect(h.get).toHaveBeenCalledWith(
      `${BASE}/devices/all?page=2&pageSize=20&platform=ios&search=ana`,
      undefined,
      ABSOLUTE,
    );
  });

  it("removes a device by its own id", async () => {
    h.del.mockResolvedValue({});
    await pushRuntimeService.removeDevice("a/b");
    expect(h.del).toHaveBeenCalledWith(`${BASE}/devices/all/a%2Fb`, undefined, ABSOLUTE);
  });

  it("reads a platform the status leaves out as no devices and no test", async () => {
    h.get.mockResolvedValue({ ios: { devices: 2, lastTest: null } });
    const status = await pushRuntimeService.getStatus();
    expect(status.android).toEqual({ devices: 0, lastTest: null });
    expect(status.ios.devices).toBe(2);
  });

  it("posts the platform test and the unsaved-notification test to their own routes", async () => {
    h.post.mockResolvedValue({});
    await pushRuntimeService.sendTest({ platform: "web" });
    expect(h.post).toHaveBeenLastCalledWith(
      `${BASE}/push-test`,
      { platform: "web" },
      undefined,
      ABSOLUTE,
    );
    await pushRuntimeService.sendNotificationTest({ titleKey: "t", bodyKey: "b" });
    expect(h.post.mock.calls.at(-1)?.[0]).toBe(`${BASE}/push-test/notification`);
  });
});
