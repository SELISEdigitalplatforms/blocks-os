import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_TEXT } from "../constants/notification-ui.constant";
import { PUSH_RESULT_FIX, WEB_PROBLEM_TEXT, WEB_TEXT } from "../constants/push-ui.constant";
import type { IPushSettings } from "../models/push.model";

const PROJECT = "shop-app";
const SENDER = "123456789012";
const API_KEY = "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q";
const APP_ID = `1:${SENDER}:web:abc123def456`;
const VAPID = "B".repeat(87);
const KEY_MATERIAL = "fake-key-material";
const EMAIL = `svc@${PROJECT}.iam.gserviceaccount.com`;
const KEY = JSON.stringify({
  type: "service_account",
  project_id: PROJECT,
  private_key: KEY_MATERIAL,
  client_email: EMAIL,
});
const SNIPPET = (project: string) =>
  `const firebaseConfig = { apiKey: "${API_KEY}", projectId: "${project}", messagingSenderId: "${SENDER}", appId: "${APP_ID}" };`;
const SAVE = "Save";
const WEB_SWITCH = "Web sending";
const SENT_AT = "2026-10-28T20:41:00Z";
const TEST_ALL = "Test all platforms";
const NOW_ISO = () => new Date(Date.now() - 2 * 3_600_000).toISOString();
const BASE: IPushSettings = {
  projectId: PROJECT,
  enabled: true,
  hasKey: true,
  keyUploadedBy: "Ana",
  platforms: { android: true, ios: true, web: false },
  hasWebConfig: false,
};
const NOT_SET_UP: IPushSettings = {
  ...BASE,
  projectId: null,
  enabled: false,
  hasKey: false,
  keyUploadedBy: undefined,
};

const h = vi.hoisted(() => ({
  settings: {} as IPushSettings,
  save: vi.fn(),
  test: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  status: {} as Record<string, unknown>,
}));

vi.mock("../hooks/use-push-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks/use-push-settings")>()),
  usePushSettings: () => ({ data: h.settings, isLoading: false }),
  useSavePushSettings: () => ({ mutateAsync: h.save, isPending: false }),
}));
vi.mock("../hooks/use-push-runtime", () => ({
  usePushStatus: () => ({ data: h.status }),
  useSendTestPush: () => ({ mutateAsync: h.test, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { PushSettingsPage } from "./push-settings-page";

const keyFile = (text = KEY) => new File([text], "key.json", { type: "application/json" });
const fileInput = () => screen.getByLabelText(PUSH_TEXT.upload) as HTMLInputElement;
const clickSave = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: SAVE }));
const savedPayload = (call = 0) => h.save.mock.calls[call][0];

const renderPage = () => render(<PushSettingsPage onClose={vi.fn()} onViewDevices={vi.fn()} />);

const addWebConfig = async (user: ReturnType<typeof userEvent.setup>, project = PROJECT) => {
  await user.click(screen.getByLabelText(WEB_TEXT.pasteLabel));
  await user.paste(SNIPPET(project));
  await user.type(screen.getByLabelText(WEB_TEXT.vapidPaste), VAPID);
};

describe("PushSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.settings = BASE;
    h.status = {
      android: { devices: 3, lastTest: null },
      ios: { devices: 1, lastTest: null },
      web: { devices: 0, lastTest: null },
    };
    h.save.mockResolvedValue({ isSuccess: true });
    h.test.mockResolvedValue({
      isSuccess: true,
      sentAt: SENT_AT,
      delivered: 0,
      failed: 0,
      devices: [],
    });
  });

  it("shows the status, the project and who stored the key, never the key", () => {
    renderPage();
    expect(screen.getByText(PUSH_TEXT.ready)).toBeTruthy();
    expect(screen.getByText(PROJECT)).toBeTruthy();
    expect(screen.getByRole("switch", { name: PUSH_TEXT.pushOn })).toBeTruthy();
    expect(screen.getByText(/Key uploaded.* by Ana/)).toBeTruthy();
    expect(document.body.textContent).not.toContain(KEY_MATERIAL);
  });

  it("sends the chosen key with the save, then forgets it and never shows its content", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(fileInput(), keyFile());
    expect(await screen.findByText(/key\.json/)).toBeTruthy();
    expect(document.body.textContent).not.toContain(KEY_MATERIAL);

    await clickSave(user);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(savedPayload()).toEqual({
      enabled: true,
      platforms: BASE.platforms,
      serviceAccountJson: KEY,
      webConfig: undefined,
    });
    await waitFor(() => expect(screen.queryByText(/key\.json/)).toBeNull());
    expect(fileInput().value).toBe("");

    await clickSave(user);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
    expect(savedPayload(1).serviceAccountJson).toBeUndefined();
  });

  it("refuses a file that is not a service account key and sends no key", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(fileInput(), keyFile('{"type":"user"}'));
    expect(await screen.findByText(PUSH_TEXT.invalidKey)).toBeTruthy();
    await clickSave(user);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(savedPayload().serviceAccountJson).toBeUndefined();
  });

  it("drops the key and shows the refusal when the save fails", async () => {
    h.save.mockResolvedValueOnce({ isSuccess: false, errors: { Key: "bad" } });
    const user = userEvent.setup();
    renderPage();
    await user.upload(fileInput(), keyFile());
    await screen.findByText(/key\.json/);
    await clickSave(user);
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { Key: "bad" } }));
    expect(screen.queryByText(/key\.json/)).toBeNull();
  });

  it("first setup: no switch, refuses a save without a key, and a key turns push on", async () => {
    h.settings = NOT_SET_UP;
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole("switch", { name: PUSH_TEXT.pushOn })).toBeNull();
    await clickSave(user);
    expect(await screen.findByText(PUSH_TEXT.needKey)).toBeTruthy();
    expect(h.save).not.toHaveBeenCalled();

    await user.upload(fileInput(), keyFile());
    await clickSave(user);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(savedPayload()).toMatchObject({ enabled: true, serviceAccountJson: KEY });
  });

  it("the switch pauses push and keeps the stored key", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("switch", { name: PUSH_TEXT.pushOn }));
    await clickSave(user);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(savedPayload()).toMatchObject({ enabled: false, serviceAccountJson: undefined });
  });

  it("warns when the new key is for another Firebase project", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(fileInput(), keyFile(KEY.replace(PROJECT, "other-app")));
    expect(await screen.findByText(PUSH_TEXT.otherProject)).toBeTruthy();
  });

  describe("manual key", () => {
    const openManual = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole("button", { name: PUSH_TEXT.manualMode }));
    };

    it("has no project input: the project is read from the email", async () => {
      const user = userEvent.setup();
      h.settings = NOT_SET_UP;
      renderPage();
      await openManual(user);
      expect(screen.queryByLabelText(/project id/i)).toBeNull();
      expect(screen.getByText(PUSH_TEXT.noProjectManual)).toBeTruthy();
      await user.type(screen.getByLabelText(PUSH_TEXT.clientEmail), EMAIL);
      expect(screen.getByText(PROJECT)).toBeTruthy();
      expect(screen.getByText(PUSH_TEXT.fromEmail)).toBeTruthy();
    });

    it("builds the key, fixes pasted \\n line breaks and forgets the private key", async () => {
      const user = userEvent.setup();
      renderPage();
      await openManual(user);
      await user.type(screen.getByLabelText(PUSH_TEXT.clientEmail), EMAIL);
      const privateKey = screen.getByLabelText(PUSH_TEXT.privateKey) as HTMLTextAreaElement;
      await user.click(privateKey);
      await user.paste(String.raw`-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n`);
      await clickSave(user);

      await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
      expect(JSON.parse(savedPayload().serviceAccountJson)).toEqual({
        type: "service_account",
        project_id: PROJECT,
        client_email: EMAIL,
        private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
      });
      await waitFor(() => expect(privateKey.value).toBe(""));
    });

    it("refuses an email that names no project and sends nothing", async () => {
      const user = userEvent.setup();
      renderPage();
      await openManual(user);
      await user.type(screen.getByLabelText(PUSH_TEXT.clientEmail), "someone@example.com");
      await user.click(screen.getByLabelText(PUSH_TEXT.privateKey));
      await user.paste("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
      await clickSave(user);
      expect(await screen.findByText(PUSH_TEXT.emailInvalid)).toBeTruthy();
      expect(h.save).not.toHaveBeenCalled();
    });

    it("refuses a missing private key", async () => {
      const user = userEvent.setup();
      renderPage();
      await openManual(user);
      await user.type(screen.getByLabelText(PUSH_TEXT.clientEmail), EMAIL);
      await clickSave(user);
      expect(await screen.findByText(PUSH_TEXT.manualIncomplete)).toBeTruthy();
      expect(h.save).not.toHaveBeenCalled();
    });
  });

  describe("web config", () => {
    it("keeps the Web switch off until a config is added", async () => {
      const user = userEvent.setup();
      renderPage();
      expect(screen.getByRole("switch", { name: WEB_SWITCH }).hasAttribute("disabled")).toBe(true);
      await addWebConfig(user);
      expect(await screen.findByText(WEB_TEXT.added.split(" ·")[0], { exact: false })).toBeTruthy();
      expect(screen.getByRole("switch", { name: WEB_SWITCH }).hasAttribute("disabled")).toBe(false);
    });

    it("sends a pasted config with the save and shows none of its values", async () => {
      const user = userEvent.setup();
      renderPage();
      await addWebConfig(user);
      await user.click(screen.getByRole("switch", { name: WEB_SWITCH }));
      expect(document.body.textContent).not.toContain(API_KEY);
      expect(document.body.textContent).not.toContain(VAPID);

      await clickSave(user);
      await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
      expect(savedPayload()).toMatchObject({
        platforms: { web: true },
        webConfig: {
          apiKey: API_KEY,
          appId: APP_ID,
          messagingSenderId: SENDER,
          vapidKey: VAPID,
          projectId: PROJECT,
        },
      });
      await waitFor(() => expect(screen.queryByText(WEB_TEXT.remove)).toBeNull());
      await clickSave(user);
      await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
      expect(savedPayload(1).webConfig).toBeUndefined();
    });

    it("blocks a config for another Firebase project and sends nothing", async () => {
      const user = userEvent.setup();
      renderPage();
      await addWebConfig(user, "other-app");
      expect((await screen.findAllByText(WEB_PROBLEM_TEXT.otherProject)).length).toBeGreaterThan(0);
      await clickSave(user);
      expect(h.save).not.toHaveBeenCalled();
    });

    it("says so when the pasted text is not a web config", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByLabelText(WEB_TEXT.pasteLabel));
      await user.paste("hello");
      expect(await screen.findByText(WEB_PROBLEM_TEXT.notConfig)).toBeTruthy();
    });

    it("typed fields: refuses an App ID that belongs to another sender", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole("button", { name: WEB_TEXT.fields }));
      await user.type(screen.getByLabelText(WEB_TEXT.apiKey), API_KEY);
      await user.type(screen.getByLabelText(WEB_TEXT.appId), APP_ID);
      await user.type(screen.getByLabelText(WEB_TEXT.senderId), "999");
      await user.type(screen.getByLabelText(WEB_TEXT.vapid), VAPID);
      await clickSave(user);
      expect(await screen.findByText(WEB_PROBLEM_TEXT.otherSender)).toBeTruthy();
      expect(h.save).not.toHaveBeenCalled();
    });
  });

  describe("last test per platform", () => {
    it("shows the last result: delivered with its age, or failed with the reason and the Apple key hint", () => {
      h.status = {
        android: { devices: 3, lastTest: { at: NOW_ISO(), delivered: 3, failed: 0 } },
        ios: {
          devices: 1,
          lastTest: { at: NOW_ISO(), delivered: 0, failed: 1, reason: "apnsKeyMissing" },
        },
        web: { devices: 0, lastTest: null },
      };
      renderPage();
      expect(screen.getByText("Delivered · 2 hours ago")).toBeTruthy();
      expect(screen.getByText(/Failed · /)).toBeTruthy();
      expect(screen.getByText(/Upload your APNs key in Firebase console/)).toBeTruthy();
    });

    it("a failure without a reason is just failed", () => {
      h.status = {
        android: { devices: 1, lastTest: { at: NOW_ISO(), delivered: 0, failed: 1 } },
        ios: { devices: 0, lastTest: null },
        web: { devices: 0, lastTest: null },
      };
      renderPage();
      expect(screen.getByText("Failed")).toBeTruthy();
    });

    it("the Web row says a config is needed until one exists", () => {
      renderPage();
      expect(screen.getByText("Needs web config")).toBeTruthy();
    });
  });

  describe("web config panel", () => {
    it("says when and by whom the stored config was added", () => {
      h.settings = {
        ...BASE,
        hasWebConfig: true,
        webConfigUploadedAt: SENT_AT,
        webConfigUploadedBy: "Ana",
      };
      renderPage();
      expect(screen.getByText("Web config stored on 28/10/2026 by Ana")).toBeTruthy();
    });

    it("reads a chosen config file and shows only that it was added", async () => {
      const user = userEvent.setup();
      renderPage();
      const file = new File([SNIPPET(PROJECT)], "firebase.js", { type: "text/javascript" });
      await user.upload(screen.getByLabelText(WEB_TEXT.chooseFile, { selector: "input" }), file);
      expect(await screen.findByText("firebase.js")).toBeTruthy();
      expect(document.body.textContent).not.toContain(API_KEY);
    });

    it("an unreadable file adds nothing", async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderPage();
      const file = new File(["x"], "broken.json", { type: "application/json" });
      Object.defineProperty(file, "text", { value: () => Promise.reject(new Error("read")) });
      await user.upload(screen.getByLabelText(WEB_TEXT.chooseFile, { selector: "input" }), file);
      await waitFor(() => expect(screen.queryByText("broken.json")).toBeNull());
      expect(screen.queryByText(WEB_TEXT.remove)).toBeNull();
    });

    it("Remove takes the added config back out so the Web switch locks again", async () => {
      const user = userEvent.setup();
      renderPage();
      await addWebConfig(user);
      await user.click(await screen.findByRole("button", { name: WEB_TEXT.remove }));
      expect(screen.queryByRole("button", { name: WEB_TEXT.remove })).toBeNull();
      expect(screen.getByRole("switch", { name: WEB_SWITCH }).hasAttribute("disabled")).toBe(true);
    });
  });

  it("opens the setup guide from the key area and closes it again", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole("button", { name: PUSH_TEXT.howToFind })[0]);
    expect(await screen.findByText(/Setup guide/)).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText(/Setup guide/)).toBeNull());
  });

  describe("test send", () => {
    it("Send again repeats the same test and Close hides the result", async () => {
      h.test.mockResolvedValue({
        isSuccess: true,
        sentAt: SENT_AT,
        delivered: 1,
        failed: 0,
        devices: [{ platform: "android", name: "Pixel 8", result: "delivered" }],
      });
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole("button", { name: "Send test Android" }));
      await screen.findByText("Pixel 8");
      await user.click(screen.getByRole("button", { name: "Send again" }));
      await waitFor(() => expect(h.test).toHaveBeenCalledTimes(2));
      expect(h.test).toHaveBeenLastCalledWith({ platform: "android" });
      const close = screen
        .getAllByRole("button", { name: "Close" })
        .find((button) => button.textContent === "Close");
      await user.click(close as HTMLElement);
      await waitFor(() => expect(screen.queryByText("Pixel 8")).toBeNull());
    });

    it("shows an error when the test call itself fails", async () => {
      h.test.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole("button", { name: TEST_ALL }));
      await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    });

    it("shows the result dialog with the fix line of a failed device", async () => {
      h.test.mockResolvedValue({
        isSuccess: true,
        sentAt: SENT_AT,
        delivered: 0,
        failed: 1,
        devices: [{ platform: "ios", name: "iPhone 15", result: "apnsKeyMissing" }],
      });
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole("button", { name: "Send test iOS" }));
      expect(await screen.findByText(PUSH_RESULT_FIX.apnsKeyMissing as string)).toBeTruthy();
      expect(h.test).toHaveBeenCalledWith({ platform: "ios" });
    });

    it("shows the refusal when nothing could be sent", async () => {
      h.test.mockResolvedValue({ isSuccess: false, errors: { devices: "No device" } });
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole("button", { name: TEST_ALL }));
      await waitFor(() =>
        expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { devices: "No device" } }),
      );
    });

    it("offers no test before push is set up", () => {
      h.settings = NOT_SET_UP;
      renderPage();
      expect(screen.getByRole("button", { name: TEST_ALL }).hasAttribute("disabled")).toBe(true);
    });
  });
});
