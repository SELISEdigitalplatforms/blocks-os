import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_FORM_TEXT, TEST_DIALOG_TEXT } from "../../constants/push-ui.constant";
import { EMPTY_FORM_VALUES } from "../../utils/notification-form";
import { EMPTY_PUSH_OPTIONS } from "../../utils/push-options";

const h = vi.hoisted(() => ({ send: vi.fn(), toast: vi.fn(), pending: false }));

vi.mock("../../hooks/use-push-runtime", () => ({
  useSendNotificationTest: () => ({ mutateAsync: h.send, isPending: h.pending }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: h.toast }));

import { PushTestRow } from "./push-test-row";

const draft = {
  ...EMPTY_FORM_VALUES,
  titleKey: "PAID_TITLE",
  bodyKey: "PAID_BODY",
  link: "orders/1",
  pushPlatforms: ["android" as const],
  pushOptions: {
    ...EMPTY_PUSH_OPTIONS,
    android: { ...EMPTY_PUSH_OPTIONS.android, ttl: "3600" },
  },
};
const OK = {
  isSuccess: true,
  sentAt: "2026-10-28T20:41:00Z",
  delivered: 1,
  failed: 0,
  devices: [{ platform: "android", name: "Pixel 8", result: "delivered" }],
};
const sendButton = () => screen.getByRole("button", { name: PUSH_FORM_TEXT.sendTest });

describe("PushTestRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pending = false;
    h.send.mockResolvedValue(OK);
  });

  it("sends the current draft and shows the result, which can be closed", async () => {
    const user = userEvent.setup();
    render(<PushTestRow values={draft} />);
    await user.click(sendButton());
    expect(await screen.findByText("Pixel 8")).toBeTruthy();
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({
        titleKey: "PAID_TITLE",
        bodyKey: "PAID_BODY",
        link: "orders/1",
        platforms: ["android"],
        options: expect.objectContaining({ android: { ttlSeconds: 3600 } }),
      }),
    );
    await user.click(screen.getByRole("button", { name: TEST_DIALOG_TEXT.sendAgain }));
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(2));
    const close = screen
      .getAllByRole("button", { name: TEST_DIALOG_TEXT.close })
      .find((button) => button.textContent === TEST_DIALOG_TEXT.close);
    await user.click(close as HTMLElement);
    await waitFor(() => expect(screen.queryByText("Pixel 8")).toBeNull());
  });

  it("closes the result with Escape", async () => {
    const user = userEvent.setup();
    render(<PushTestRow values={draft} />);
    await user.click(sendButton());
    await screen.findByText("Pixel 8");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Pixel 8")).toBeNull());
  });

  it("shows the refusal and no result when nothing could be sent", async () => {
    h.send.mockResolvedValue({ isSuccess: false, errors: { devices: "No device" } });
    const user = userEvent.setup();
    render(<PushTestRow values={draft} />);
    await user.click(sendButton());
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith({ errors: { devices: "No device" } }));
    expect(screen.queryByText(TEST_DIALOG_TEXT.title)).toBeNull();
  });

  it("shows an error when the call itself fails", async () => {
    h.send.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<PushTestRow values={draft} />);
    await user.click(sendButton());
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith({ errors: "Something went wrong" }));
  });

  it("passes the server's error details to the toast when it sends them", async () => {
    h.send.mockRejectedValue({ errors: { Key: "bad" } });
    const user = userEvent.setup();
    render(<PushTestRow values={draft} />);
    await user.click(sendButton());
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith({ errors: { Key: "bad" } }));
  });

  it("is off, with a hint, until a title key and a message key are chosen", () => {
    render(<PushTestRow values={{ ...draft, bodyKey: "" }} />);
    expect(sendButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(PUSH_FORM_TEXT.needKeys)).toBeTruthy();
  });

  it("is off while a test is running", () => {
    h.pending = true;
    render(<PushTestRow values={draft} />);
    expect(sendButton().hasAttribute("disabled")).toBe(true);
  });
});
