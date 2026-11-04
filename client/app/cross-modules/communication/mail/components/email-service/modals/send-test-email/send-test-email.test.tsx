import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({ send: vi.fn(), toast: vi.fn(), showErrorToast: vi.fn() }));

vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useSendTestMail: () => ({ mutateAsync: h.send, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { SendTestEmailDialog } from "./send-test-email";

const template = {
  itemId: "t-acme",
  name: "ShipmentUpdate",
  language: "en-US",
  organizationId: "acme",
} as IEmailTemplate;

const renderDialog = (showOrganization: boolean) => {
  const onClose = vi.fn();
  render(
    <Dialog open>
      <SendTestEmailDialog
        template={template}
        to="admin@example.com"
        languageName="English"
        organizationName="Acme Corp"
        showOrganization={showOrganization}
        sendsThrough="Acme Marketing (SES)"
        onClose={onClose}
      />
    </Dialog>,
  );
  return { onClose };
};

describe("SendTestEmailDialog (H12, board TestMail)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.send.mockResolvedValue({ isSuccess: true });
  });

  it("shows the template, its organization and the configuration it sends through", () => {
    renderDialog(true);
    expect(screen.getByRole("heading", { name: "Send test email" })).toBeTruthy();
    expect(screen.getByText("ShipmentUpdate · English")).toBeTruthy();
    expect(screen.getByText("Acme Corp")).toBeTruthy();
    expect(screen.getByText("Acme Marketing (SES)")).toBeTruthy();
  });

  it("sends this exact template by id", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(true);
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(h.send).toHaveBeenCalledWith({
        to: "admin@example.com",
        purpose: "ShipmentUpdate",
        language: "en-US",
        templateId: "t-acme",
      }),
    );
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Sent test email successfully" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the organization row with multi-org off (C13)", () => {
    renderDialog(false);
    expect(screen.queryByText("Acme Corp")).toBeNull();
  });

  it("shows a failure from the server", async () => {
    h.send.mockResolvedValue({ isSuccess: false, errors: { To: "bad" } });
    const user = userEvent.setup();
    renderDialog(true);
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { To: "bad" } }));
  });
});
