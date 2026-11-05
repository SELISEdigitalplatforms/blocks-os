import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  del: vi.fn(),
  deleteAcross: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  data: {
    organizations: [] as Array<{ itemId: string; name: string }>,
    copies: new Map<string, { organizationId: string; templateId: string }>(),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
    copiesLoading: false,
    copiesError: false,
    refetchCopies: vi.fn(),
  },
  templateIds: [] as Array<string | undefined>,
}));

vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useDeleteEmailTemplate: () => ({ mutateAsync: h.del, isPending: false }),
}));
vi.mock("@blocks-communication/mail/hooks/use-template-copy", () => ({
  useDeleteTemplateAcrossOrganizations: () => ({ mutateAsync: h.deleteAcross, isPending: false }),
  useOrganizationChecklistData: (templateId?: string) => {
    h.templateIds.push(templateId);
    return h.data;
  },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { DeleteTemplateDialog } from "./delete-template";

const acme = {
  itemId: "t-acme",
  name: "OrderConfirmation",
  organizationId: "acme",
} as IEmailTemplate;
const fallback = { itemId: "t-def", name: "OrderConfirmation" } as IEmailTemplate;

const COPIES_DELETED_MESSAGE =
  "The Default template was deleted, but deleting organization copies couldn't start. Try again from an organization's template.";

const renderDialog = (template: IEmailTemplate, isMultiOrgEnabled: boolean) => {
  const onDeleted = vi.fn();
  const onClose = vi.fn();
  render(
    <Dialog open>
      <DeleteTemplateDialog
        template={template}
        languageName="English"
        organizationName={template.organizationId === "acme" ? "Acme Corp" : "Default organization"}
        isMultiOrgEnabled={isMultiOrgEnabled}
        onClose={onClose}
        onDeleted={onDeleted}
      />
    </Dialog>,
  );
  return { onDeleted, onClose, user: userEvent.setup() };
};

describe("DeleteTemplateDialog (H11, C11, D6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.del.mockResolvedValue({ isSuccess: true });
    h.templateIds = [];
  });

  it("tells an organization template's admin that the Default template takes over (DeleteTemplateOrg)", async () => {
    const { onDeleted, user } = renderDialog(acme, true);
    expect(screen.getByRole("heading", { name: "Delete template?" })).toBeTruthy();
    expect(
      screen.getByText(
        "After this, Acme Corp's OrderConfirmation · English mails use the Default organization's template, if it has one.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith({ itemId: "t-acme" }));
    expect(onDeleted).toHaveBeenCalled();
  });

  it("keeps the plain confirm with multi-org off (D6, C13; SPEC34 H10)", async () => {
    const { user } = renderDialog(fallback, false);
    expect(
      screen.getByText("Are you sure you want to delete the OrderConfirmation template?"),
    ).toBeTruthy();
    expect(screen.queryByText(/Organizations without their own copy/)).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith({ itemId: "t-def" }));
  });

  it("shows the server error and keeps the dialog's caller informed", async () => {
    h.del.mockRejectedValue({ errors: { ItemId: "ItemId not found" } });
    const { onDeleted, user } = renderDialog(acme, true);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

describe("DeleteTemplateDialog for a Default template with multi-org on (SPEC34 H1, H2, H6-H8, C11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.del.mockResolvedValue({ isSuccess: true });
    h.deleteAcross.mockResolvedValue({ isSuccess: true, itemId: "job-9" });
    h.templateIds = [];
    h.data = {
      ...h.data,
      organizations: [
        { itemId: "acme", name: "Acme Corp" },
        { itemId: "umbrella", name: "Umbrella Ltd" },
      ],
      copies: new Map([["umbrella", { organizationId: "umbrella", templateId: "u-1" }]]),
      isLoading: false,
      copiesLoading: false,
      copiesError: false,
    };
  });

  it("asks what to delete, starting with the Default template only (H6, board DeleteTemplateDefault)", () => {
    renderDialog(fallback, true);
    expect(screen.getByRole("alertdialog", { name: "Delete OrderConfirmation?" })).toBeTruthy();
    expect(screen.getByText("Default organization · English.")).toBeTruthy();
    expect(screen.getByRole("group", { name: "What to delete" })).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "Only the Default organization's template" }),
    ).toHaveProperty("ariaChecked", "true");
    expect(screen.getByText("Organizations' own copies stay.")).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "Also delete organizations' own copies" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Copies with the same name and language, in the organizations you choose."),
    ).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Umbrella Ltd" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "This can't be undone. Organizations without their own copy stop getting OrderConfirmation · English mail.",
    );
  });

  it("scrolls inside the viewport, so Cancel and Delete stay reachable with a long organization list", () => {
    renderDialog(fallback, true);
    const dialog = screen.getByRole("alertdialog", { name: "Delete OrderConfirmation?" });
    expect(dialog.className).toContain("max-h-[90vh]");
    expect(dialog.className).toContain("overflow-y-auto");
  });

  it("starts with the focus on Cancel", async () => {
    renderDialog(fallback, true);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })),
    );
  });

  it("takes the focus back to Cancel when the opening menu returns focus to its trigger", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    renderDialog(fallback, true);
    // What a closing ⋮ menu does right after it opened the dialog.
    trigger.focus();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })),
    );
    trigger.remove();
  });

  it("deletes only the Default template through the existing delete (H1)", async () => {
    const { onDeleted, user } = renderDialog(fallback, true);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith({ itemId: "t-def" }));
    expect(h.deleteAcross).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Deleted template successfully" }),
    );
    expect(onDeleted).toHaveBeenCalled();
  });

  it("deletes the copies of the selected organizations too (H2, H7, H8)", async () => {
    const { onDeleted, user } = renderDialog(fallback, true);
    await user.click(screen.getByRole("radio", { name: "Also delete organizations' own copies" }));
    expect(screen.getByRole("radio", { name: "Selected organizations" })).toHaveProperty(
      "ariaChecked",
      "true",
    );
    expect(h.templateIds).toContain("t-def");
    expect(screen.getByRole("checkbox", { name: "Acme Corp" })).toHaveProperty("disabled", true);
    expect(screen.getByText("No copy · nothing to delete")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "This can't be undone. Organizations without their own copy stop getting OrderConfirmation · English mail. Deleting copies runs in the background; you get a notification when it's done.",
    );
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("checkbox", { name: "Umbrella Ltd" }));
    expect(screen.getByText("Deletes their copy")).toBeTruthy();
    await user.click(deleteButton);
    await waitFor(() => expect(h.deleteAcross).toHaveBeenCalled());
    expect(h.deleteAcross.mock.calls[0][0]).toEqual({
      templateId: "t-def",
      allOrganizations: false,
      organizationIds: ["umbrella"],
    });
    expect(h.del).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        description:
          "Template deleted. Deleting organization copies runs in the background; you'll get a notification.",
      }),
    );
    expect(onDeleted).toHaveBeenCalled();
  });

  it("deletes the copies in all organizations without listing them (H4)", async () => {
    const { user } = renderDialog(fallback, true);
    await user.click(screen.getByRole("radio", { name: "Also delete organizations' own copies" }));
    await user.click(screen.getByRole("radio", { name: "All organizations" }));
    expect(screen.queryByRole("checkbox", { name: "Umbrella Ltd" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.deleteAcross).toHaveBeenCalled());
    expect(h.deleteAcross.mock.calls[0][0]).toEqual({
      templateId: "t-def",
      allOrganizations: true,
    });
  });

  it("can't delete selected copies while their lookup is pending or failed", async () => {
    h.data = { ...h.data, copiesLoading: true };
    const { user } = renderDialog(fallback, true);
    await user.click(screen.getByRole("radio", { name: "Also delete organizations' own copies" }));
    expect(screen.getByRole("button", { name: "Delete" })).toHaveProperty("disabled", true);
  });

  it("returns to the list when the Default template went but its copies didn't (C5)", async () => {
    h.deleteAcross.mockRejectedValue({ errors: { Copies: COPIES_DELETED_MESSAGE } });
    const { onDeleted, user } = renderDialog(fallback, true);
    await user.click(screen.getByRole("radio", { name: "Also delete organizations' own copies" }));
    await user.click(screen.getByRole("radio", { name: "All organizations" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    const shown = h.showErrorToast.mock.calls[0][0] as {
      errors: unknown;
      customMessages: Record<string, string>;
    };
    expect(shown.errors).toEqual({ Copies: COPIES_DELETED_MESSAGE });
    expect(shown.customMessages[COPIES_DELETED_MESSAGE]).toBe(COPIES_DELETED_MESSAGE);
    expect(onDeleted).toHaveBeenCalled();
  });

  it("keeps the dialog when nothing was deleted (C1, C3)", async () => {
    h.deleteAcross.mockResolvedValue({
      isSuccess: false,
      errors: { OrganizationIds: "Select at least one organization" },
    });
    const { onDeleted, user } = renderDialog(fallback, true);
    await user.click(screen.getByRole("radio", { name: "Also delete organizations' own copies" }));
    await user.click(screen.getByRole("radio", { name: "All organizations" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("deletes nothing on Cancel (C11)", async () => {
    const { onClose, user } = renderDialog(fallback, true);
    await user.click(screen.getByRole("radio", { name: "Also delete organizations' own copies" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(h.del).not.toHaveBeenCalled();
    expect(h.deleteAcross).not.toHaveBeenCalled();
  });
});
