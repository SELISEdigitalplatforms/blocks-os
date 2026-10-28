import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/http/http-client", () => ({ http: { get: h.get, post: h.post } }));
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: () => "https://logic.example/" }));

import { pushSettingsService } from "./push-settings.service";

const SETTINGS_URL = "https://logic.example/api/Notifier/push-settings";

describe("PushSettingsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the settings from the logic service with an absolute URL", async () => {
    h.get.mockResolvedValue({ projectId: "p", enabled: true, hasKey: true });
    const settings = await pushSettingsService.getSettings();
    expect(h.get).toHaveBeenCalledWith(SETTINGS_URL, undefined, { absoluteUrl: true });
    expect(settings).toMatchObject({ projectId: "p", enabled: true, hasKey: true });
  });

  it("reads settings wrapped in data and fills the defaults for a missing answer", async () => {
    h.get.mockResolvedValueOnce({ data: { projectId: "p", enabled: false, hasKey: false } });
    expect(await pushSettingsService.getSettings()).toMatchObject({ projectId: "p" });
    h.get.mockResolvedValueOnce(undefined);
    expect(await pushSettingsService.getSettings()).toEqual({
      projectId: null,
      enabled: false,
      hasKey: false,
    });
  });

  it("posts the key once, in the save body only", async () => {
    h.post.mockResolvedValue({ isSuccess: true });
    await pushSettingsService.saveSettings({ projectId: "p", enabled: true, serviceAccountJson: "{}" });
    expect(h.post).toHaveBeenCalledWith(
      SETTINGS_URL,
      { projectId: "p", enabled: true, serviceAccountJson: "{}" },
      undefined,
      { absoluteUrl: true },
    );
  });

  it("reports a refusal and posts the test to its own endpoint", async () => {
    h.post.mockResolvedValueOnce({ isSuccess: false, errors: { Key: "bad" } });
    expect(await pushSettingsService.saveSettings({ projectId: "p", enabled: true })).toEqual({
      isSuccess: false,
      errors: { Key: "bad" },
    });
    h.post.mockResolvedValueOnce({});
    await pushSettingsService.sendTest();
    expect(h.post).toHaveBeenLastCalledWith(`${SETTINGS_URL}/test`, {}, undefined, {
      absoluteUrl: true,
    });
  });
});
