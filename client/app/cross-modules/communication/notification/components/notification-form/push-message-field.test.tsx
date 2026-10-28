import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FORM_VALUES } from "../../utils/notification-form";
import { NOTIFICATION_TEXT } from "../../constants/notification-ui.constant";

const h = vi.hoisted(() => ({
  keys: [] as unknown[],
  languages: [] as unknown[],
  env: "https://loc.example/callback",
}));

vi.mock("../../hooks/use-push-message-keys", () => ({
  usePushMessageKeys: () => ({
    keys: h.keys,
    languages: h.languages,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: () => h.env }));

import { PushMessageField, localizationUrl } from "./push-message-field";

const TITLE_TEXT = "Order {{orderNo}} paid";

const props = {
  values: { ...EMPTY_FORM_VALUES, pushEnabled: true, titleKey: "PAID_TITLE", bodyKey: "PAID_BODY" },
  onPatch: vi.fn(),
  locked: false,
  pushReady: true,
  onSetUpPush: vi.fn(),
};

describe("PushMessageField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.env = "https://loc.example/callback";
    h.languages = [
      { itemId: "1", languageName: "English", languageCode: "en-US", isDefault: true },
      { itemId: "2", languageName: "Deutsch", languageCode: "de-DE" },
    ];
    h.keys = [
      { keyName: "PAID_TITLE", resources: [{ culture: "en-US", value: TITLE_TEXT }] },
      { keyName: "PAID_BODY", resources: [{ culture: "en-US", value: "{{amount}} received" }] },
    ];
  });

  it("previews the default language, lists the fields and names the languages that lack text", () => {
    render(<PushMessageField {...props} />);
    expect(screen.getByText(TITLE_TEXT)).toBeTruthy();
    expect(screen.getByText("{{amount}} received")).toBeTruthy();
    expect(screen.getByText(/Fields: \{\{orderNo\}\} \{\{amount\}\}/)).toBeTruthy();
    expect(screen.getByText("No Deutsch text yet — the default language is used.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Manage keys in Localization/ }).getAttribute("href"),
    ).toBe("https://loc.example/?module=notifications");
  });

  it("tells the user when mobile push is not set up and opens the set-up page", async () => {
    const user = userEvent.setup();
    render(<PushMessageField {...props} pushReady={false} />);
    expect(screen.getByText(NOTIFICATION_TEXT.pushNotReady)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: NOTIFICATION_TEXT.setUpPush }));
    expect(props.onSetUpPush).toHaveBeenCalled();
  });

  it("shows only the fixed preview of a personal notice", () => {
    render(<PushMessageField {...props} locked />);
    expect(screen.getByText(NOTIFICATION_TEXT.fixedText)).toBeTruthy();
    expect(screen.queryByLabelText(NOTIFICATION_TEXT.titleKey)).toBeNull();
    expect(screen.getByText(TITLE_TEXT)).toBeTruthy();
  });

  it("falls back to the key name when Localization has no text, and hides the link without an address", () => {
    h.keys = [];
    h.env = "";
    render(<PushMessageField {...props} />);
    expect(document.querySelector("b")?.textContent).toBe("PAID_TITLE");
    expect(screen.queryByRole("link")).toBeNull();
    expect(localizationUrl()).toBe("");
  });
});
