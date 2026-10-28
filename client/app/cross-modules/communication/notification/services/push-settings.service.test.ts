import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/http/http-client", () => ({ http: { get: h.get, post: h.post } }));

import { pushSettingsService } from "./push-settings.service";

const GET_URL = "/api/PushSettings/Get";
const SAVE_URL = "/api/PushSettings/Save";
const FLAGS = { android: true, ios: true, web: false };

describe("PushSettingsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the settings from the OS server with a relative URL", async () => {
    h.get.mockResolvedValue({ projectId: "p", enabled: true, hasKey: true, platforms: FLAGS });
    const settings = await pushSettingsService.getSettings();
    expect(h.get).toHaveBeenCalledWith(GET_URL);
    expect(settings).toMatchObject({ projectId: "p", enabled: true, hasKey: true });
  });

  it("fills the defaults for a missing answer and for missing platform flags", async () => {
    h.get.mockResolvedValueOnce(undefined);
    expect(await pushSettingsService.getSettings()).toMatchObject({
      hasKey: false,
      hasWebConfig: false,
      platforms: FLAGS,
    });
    h.get.mockResolvedValueOnce({
      data: { projectId: "p", enabled: false, hasKey: true, platforms: { web: true } },
    });
    expect((await pushSettingsService.getSettings()).platforms).toEqual({ ...FLAGS, web: true });
  });

  it("posts the key once, in the save body only", async () => {
    h.post.mockResolvedValue({ isSuccess: true });
    const payload = { enabled: true, platforms: FLAGS, serviceAccountJson: "{}" };
    await pushSettingsService.saveSettings(payload);
    expect(h.post).toHaveBeenCalledWith(SAVE_URL, payload);
  });

  it("reports a refusal with its errors", async () => {
    h.post.mockResolvedValueOnce({ isSuccess: false, errors: { Key: "bad" } });
    expect(await pushSettingsService.saveSettings({ enabled: true, platforms: FLAGS })).toEqual({
      isSuccess: false,
      errors: { Key: "bad" },
    });
  });
});
