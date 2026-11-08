import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { http } from "@/lib/http/http-client";
import { sampleActions } from "@/cross-modules/actions/test-utils/__mocks__";
import { WEBHOOKS_ENDPOINTS } from "../constants/endpoint.constant";
import { makeWebhook, SIGNING_SECRET } from "../test-utils/__mocks__";

const toasts = vi.hoisted(() => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  showInfoToast: vi.fn(),
}));

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("@/hooks/use-toast", () => toasts);

import { WebhookFormDialog } from "./webhook-form-dialog";
import type { IWebhook } from "../models/webhook.model";

const SAVE_WEBHOOK = "Save webhook";
const USER_CREATED_NAME = "iam.user.created";

const onOpenChange = vi.fn();

const renderDialog = (webhook?: IWebhook) =>
  render(<WebhookFormDialog open onOpenChange={onOpenChange} webhook={webhook} />, {
    wrapper: createWrapper(),
  });

const fillNewWebhook = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText("Name"), "CRM sync");
  await user.type(screen.getByLabelText("Endpoint URL"), "https://crm.acme.com/hook");
  await user.type(screen.getByLabelText("Signing secret"), SIGNING_SECRET);
  await user.click(await screen.findByRole("checkbox", { name: /User created/ }));
};

describe("WebhookFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue(sampleActions);
    vi.mocked(http.post).mockResolvedValue(makeWebhook());
  });

  it("lists only the actions that have Webhook turned on", async () => {
    renderDialog();

    expect(await screen.findByRole("checkbox", { name: /User created/ })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Files generated/ })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Organization created/ })).toBeNull();
  });

  it("creates a webhook with its secret and closes", async () => {
    const user = userEvent.setup();
    renderDialog();
    await fillNewWebhook(user);

    await user.click(screen.getByRole("button", { name: SAVE_WEBHOOK }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith(WEBHOOKS_ENDPOINTS.SAVE, {
        name: "CRM sync",
        url: "https://crm.acme.com/hook",
        secret: SIGNING_SECRET,
        isActive: true,
        actions: [USER_CREATED_NAME],
      }),
    );
    expect(toasts.showSuccessToast).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks an empty form and says what is missing, without calling the server", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole("button", { name: SAVE_WEBHOOK }));

    expect(await screen.findByText("Enter a name.")).toBeTruthy();
    expect(screen.getByText("The URL must start with https://")).toBeTruthy();
    expect(screen.getByText("Enter a signing secret.")).toBeTruthy();
    expect(screen.getByText("Choose at least one action.")).toBeTruthy();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("on edit keeps the current secret when the field stays empty", async () => {
    const user = userEvent.setup();
    renderDialog(makeWebhook({ actions: [USER_CREATED_NAME] }));

    expect(await screen.findByLabelText("New secret (optional)")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("CRM sync");
    await screen.findByRole("checkbox", { name: /User created/ });
    await user.click(screen.getByRole("button", { name: SAVE_WEBHOOK }));

    await waitFor(() => expect(http.post).toHaveBeenCalled());
    const [, payload] = vi.mocked(http.post).mock.calls[0];
    expect(payload).toEqual({
      id: "wh-1",
      name: "CRM sync",
      url: "https://crm.acme.com/hooks/blocks",
      isActive: true,
      actions: [USER_CREATED_NAME],
    });
  });

  it("shows a taken name on the name field and stays open", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "WEBHOOK_NAME_TAKEN" } });
    renderDialog();
    await fillNewWebhook(user);

    await user.click(screen.getByRole("button", { name: SAVE_WEBHOOK }));

    expect(await screen.findByText("Another webhook already uses this name.")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows a refused URL on the URL field", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "URL_NOT_ALLOWED" } });
    renderDialog();
    await fillNewWebhook(user);

    await user.click(screen.getByRole("button", { name: SAVE_WEBHOOK }));

    expect(
      await screen.findByText("This URL is not allowed. Use a public https:// address."),
    ).toBeTruthy();
  });

  it("closes and explains when the webhook was deleted meanwhile", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "WEBHOOK_NOT_FOUND" } });
    renderDialog(makeWebhook({ actions: [USER_CREATED_NAME] }));
    await screen.findByRole("checkbox", { name: /User created/ });

    await user.click(screen.getByRole("button", { name: SAVE_WEBHOOK }));

    await waitFor(() => expect(toasts.showErrorToast).toHaveBeenCalled());
    expect(toasts.showErrorToast.mock.calls[0][0].customMessages.WEBHOOK_NOT_FOUND).toBe(
      "This webhook does not exist any more.",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
