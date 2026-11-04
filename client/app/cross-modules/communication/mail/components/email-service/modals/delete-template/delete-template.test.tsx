import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({ del: vi.fn(), toast: vi.fn(), showErrorToast: vi.fn() }));

vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useDeleteEmailTemplate: () => ({ mutateAsync: h.del, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { DeleteTemplateDialog } from "./delete-template";

const acme = {
  itemId: "t-acme",
  name: "OrderConfirmation",
  organizationId: "acme",
} as IEmailTemplate;
const fallback = { itemId: "t-def", name: "OrderConfirmation" } as IEmailTemplate;

const renderDialog = (template: IEmailTemplate, isMultiOrgEnabled: boolean) => {
  const onDeleted = vi.fn();
  render(
    <Dialog open>
      <DeleteTemplateDialog
        template={template}
        languageName="English"
        organizationName={template.organizationId === "acme" ? "Acme Corp" : "Default organization"}
        isMultiOrgEnabled={isMultiOrgEnabled}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    </Dialog>,
  );
  return { onDeleted };
};

describe("DeleteTemplateDialog (H11, C11, D6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.del.mockResolvedValue({ isSuccess: true });
  });

  it("tells an organization template's admin that the Default template takes over (DeleteTemplateOrg)", async () => {
    const user = userEvent.setup();
    const { onDeleted } = renderDialog(acme, true);
    expect(screen.getByRole("heading", { name: "Delete template?" })).toBeTruthy();
    expect(
      screen.getByText(
        "After this, Acme Corp's OrderConfirmation · English mails use the Default organization's template, if it has one.",
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith({ itemId: "t-acme" }));
    expect(onDeleted).toHaveBeenCalled();
  });

  it("warns before deleting a Default organization template with multi-org on (C11)", () => {
    renderDialog(fallback, true);
    expect(screen.getByRole("heading", { name: "Delete OrderConfirmation?" })).toBeTruthy();
    expect(
      screen.getByText(/Organizations without their own copy stop getting this mail/),
    ).toBeTruthy();
  });

  it("keeps the plain confirm with multi-org off (D6, C13)", async () => {
    const user = userEvent.setup();
    renderDialog(fallback, false);
    expect(
      screen.getByText("Are you sure you want to delete the OrderConfirmation template?"),
    ).toBeTruthy();
    expect(screen.queryByText(/Organizations without their own copy/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith({ itemId: "t-def" }));
  });

  it("shows the server error and keeps the dialog's caller informed", async () => {
    h.del.mockRejectedValue({ errors: { ItemId: "ItemId not found" } });
    const user = userEvent.setup();
    const { onDeleted } = renderDialog(acme, true);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
