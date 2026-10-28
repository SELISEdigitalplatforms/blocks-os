import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_TEXT } from "../constants/notification-ui.constant";

const h = vi.hoisted(() => ({
  settings: { projectId: "shop-app", enabled: true, hasKey: true } as {
    projectId: string | null;
    enabled: boolean;
    hasKey: boolean;
    keyUploadedBy?: string;
  },
  save: vi.fn(),
  test: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("../hooks/use-push-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks/use-push-settings")>()),
  usePushSettings: () => ({ data: h.settings, isLoading: false }),
  useSavePushSettings: () => ({ mutateAsync: h.save, isPending: false }),
  useSendTestPush: () => ({ mutateAsync: h.test, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { PushSettingsPage } from "./push-settings-page";

const KEY_MATERIAL = "fake-key-material";
const SAVE = "Save";
const PROJECT = "shop-app";
const EMAIL = "svc@shop-app.iam";
const KEY = JSON.stringify({
  type: "service_account",
  project_id: PROJECT,
  private_key: KEY_MATERIAL,
  client_email: EMAIL,
});
const keyFile = (text = KEY) => new File([text], "key.json", { type: "application/json" });
const fileInput = () => screen.getByLabelText(PUSH_TEXT.upload) as HTMLInputElement;

describe("PushSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.settings = { projectId: PROJECT, enabled: true, hasKey: true, keyUploadedBy: "Ana" };
    h.save.mockResolvedValue({ isSuccess: true });
    h.test.mockResolvedValue({ isSuccess: true });
  });

  it("shows the status, the project id and who stored the key, never the key", () => {
    render(<PushSettingsPage onClose={vi.fn()} />);
    expect(screen.getByText(PUSH_TEXT.ready)).toBeTruthy();
    expect(screen.getByText(PROJECT)).toBeTruthy();
    expect(screen.getByRole("switch", { name: PUSH_TEXT.pushOn })).toBeTruthy();
    expect(screen.getByText(/Key uploaded.* by Ana/)).toBeTruthy();
    expect(document.body.textContent).not.toContain(KEY_MATERIAL);
  });

  it("sends the chosen key with the save, then forgets it and never shows its content", async () => {
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    await user.upload(fileInput(), keyFile());
    expect(await screen.findByText(/key\.json/)).toBeTruthy();
    expect(document.body.textContent).not.toContain(KEY_MATERIAL);

    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save.mock.calls[0][0]).toEqual({
      projectId: PROJECT,
      enabled: true,
      serviceAccountJson: KEY,
    });
    await waitFor(() => expect(screen.queryByText(/key\.json/)).toBeNull());
    expect(fileInput().value).toBe("");

    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
    expect(h.save.mock.calls[1][0].serviceAccountJson).toBeUndefined();
  });

  it("refuses a file that is not a service account key and sends nothing", async () => {
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    await user.upload(fileInput(), keyFile('{"type":"user"}'));
    expect(await screen.findByText(PUSH_TEXT.invalidKey)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save.mock.calls[0][0].serviceAccountJson).toBeUndefined();
  });

  it("drops the key and shows the refusal when the save fails", async () => {
    h.save.mockResolvedValueOnce({ isSuccess: false, errors: { Key: "bad" } });
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    await user.upload(fileInput(), keyFile());
    await screen.findByText(/key\.json/);
    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { Key: "bad" } }));
    expect(screen.queryByText(/key\.json/)).toBeNull();
  });

  it("offers the test send only when push is ready", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PushSettingsPage onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: PUSH_TEXT.sendTest }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: PUSH_TEXT.testSent }),
      ),
    );
    unmount();
    h.settings = { projectId: null, enabled: false, hasKey: false };
    render(<PushSettingsPage onClose={vi.fn()} />);
    expect(screen.getByText(PUSH_TEXT.notSetUp)).toBeTruthy();
    expect(screen.queryByRole("button", { name: PUSH_TEXT.sendTest })).toBeNull();
  });

  it("first setup: no switch, refuses a save without a key, and a key turns push on", async () => {
    h.settings = { projectId: null, enabled: false, hasKey: false };
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    expect(screen.queryByRole("switch")).toBeNull();
    await user.click(screen.getByRole("button", { name: SAVE }));
    expect(await screen.findByText(PUSH_TEXT.needKey)).toBeTruthy();
    expect(h.save).not.toHaveBeenCalled();

    await user.upload(fileInput(), keyFile());
    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save.mock.calls[0][0]).toEqual({
      projectId: PROJECT,
      enabled: true,
      serviceAccountJson: KEY,
    });
  });

  it("the switch pauses push and keeps the stored key", async () => {
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    await user.click(screen.getByRole("switch", { name: PUSH_TEXT.pushOn }));
    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save.mock.calls[0][0]).toEqual({
      projectId: PROJECT,
      enabled: false,
      serviceAccountJson: undefined,
    });
  });

  it("warns when the new key is for another Firebase project", async () => {
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    await user.upload(fileInput(), keyFile(KEY.replace(PROJECT, "other-app")));
    expect(await screen.findByText(PUSH_TEXT.otherProject)).toBeTruthy();
  });

  it("builds the key from typed fields, fixes pasted \\n line breaks and forgets the private key", async () => {
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: PUSH_TEXT.manualMode }));
    await user.type(screen.getByLabelText(PUSH_TEXT.projectId), PROJECT);
    await user.type(screen.getByLabelText(PUSH_TEXT.clientEmail), EMAIL);
    const privateKey = screen.getByLabelText(PUSH_TEXT.privateKey) as HTMLTextAreaElement;
    await user.click(privateKey);
    await user.paste(String.raw`-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n`);
    await user.click(screen.getByRole("button", { name: SAVE }));

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    const payload = h.save.mock.calls[0][0];
    expect(payload.projectId).toBe(PROJECT);
    expect(JSON.parse(payload.serviceAccountJson)).toEqual({
      type: "service_account",
      project_id: PROJECT,
      client_email: EMAIL,
      private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
    });
    await waitFor(() => expect(privateKey.value).toBe(""));
  });

  it("refuses typed fields with no private key and sends nothing", async () => {
    const user = userEvent.setup();
    render(<PushSettingsPage onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: PUSH_TEXT.manualMode }));
    await user.type(screen.getByLabelText(PUSH_TEXT.projectId), PROJECT);
    await user.click(screen.getByRole("button", { name: SAVE }));
    expect(await screen.findByText(PUSH_TEXT.manualIncomplete)).toBeTruthy();
    expect(h.save).not.toHaveBeenCalled();
  });
});
