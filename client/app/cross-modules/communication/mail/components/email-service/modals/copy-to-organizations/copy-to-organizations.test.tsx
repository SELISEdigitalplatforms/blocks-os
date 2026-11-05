import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  copy: vi.fn(),
  isPending: false,
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  data: {
    organizations: [] as Array<{ itemId: string; name: string }>,
    copies: new Map<
      string,
      { organizationId: string; templateId: string; lastUpdatedDate?: string }
    >(),
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

vi.mock("@blocks-communication/mail/hooks/use-template-copy", () => ({
  useCopyTemplateToOrganizations: () => ({ mutateAsync: h.copy, isPending: h.isPending }),
  useOrganizationChecklistData: (templateId?: string) => {
    h.templateIds.push(templateId);
    return h.data;
  },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { CopyToOrganizationsDialog } from "./copy-to-organizations";

const template = {
  itemId: "d-order-en",
  name: "OrderConfirmation",
  language: "en-US",
  organizationId: "default",
} as IEmailTemplate;

const renderDialog = () => {
  const onClose = vi.fn();
  const view = () => (
    <Dialog open>
      <CopyToOrganizationsDialog template={template} languageName="English" onClose={onClose} />
    </Dialog>
  );
  const { rerender } = render(view());
  return { onClose, user: userEvent.setup(), rerender: () => rerender(view()) };
};

const row = (name: string) => screen.getByRole("checkbox", { name });

describe("CopyToOrganizationsDialog (SPEC33 H9-H11, board CopyToOrgs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.templateIds = [];
    h.data = {
      ...h.data,
      organizations: [
        { itemId: "acme", name: "Acme Corp" },
        { itemId: "globex", name: "Globex" },
        { itemId: "umbrella", name: "Umbrella Ltd" },
      ],
      copies: new Map([
        [
          "umbrella",
          {
            organizationId: "umbrella",
            templateId: "u-1",
            lastUpdatedDate: "2026-10-30T09:00:00Z",
          },
        ],
      ]),
      isLoading: false,
      isError: false,
      hasNextPage: false,
      copiesLoading: false,
      copiesError: false,
    };
    h.copy.mockResolvedValue({ isSuccess: true, itemId: "job-1" });
  });

  it("describes the template and looks up copies for this template (H9)", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Copy to organizations" })).toBeTruthy();
    expect(
      screen.getByText(
        'OrderConfirmation · English. Each organization gets its own copy, set to "Organization default", that it can change. Later changes to this template don\'t change the copies.',
      ),
    ).toBeTruthy();
    expect(h.templateIds).toContain("d-order-en");
    expect(screen.getByText("OWN COPY")).toBeTruthy();
  });

  it("with Keep, an organization with its own copy can't be selected (H4)", async () => {
    renderDialog();
    expect(row("Umbrella Ltd")).toHaveProperty("disabled", true);
    expect(screen.getByText("Keeps their copy")).toBeTruthy();
    expect(screen.getAllByText("Keeps using the Default template")).toHaveLength(2);
  });

  it("copies to the selected organizations and says copying started (H1, H10)", async () => {
    const { user, onClose } = renderDialog();
    await user.click(row("Acme Corp"));
    expect(screen.getByText("Creates a copy")).toBeTruthy();
    expect(screen.getByText("1 selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Copy to 1 organization" }));
    await waitFor(() => expect(h.copy).toHaveBeenCalled());
    expect(h.copy.mock.calls[0][0]).toEqual({
      templateId: "d-order-en",
      allOrganizations: false,
      organizationIds: ["acme"],
      existing: "keep",
    });
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        description: "Copying started. You'll get a notification when it's done.",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("with Replace, counts replacements and warns naming the organizations (H5, H11)", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("radio", { name: /Replace it with this version/ }));
    await user.click(row("Acme Corp"));
    await user.click(row("Globex"));
    await user.click(row("Umbrella Ltd"));
    expect(screen.getByText("3 selected · 1 to replace")).toBeTruthy();
    expect(screen.getByText(/^Replaces their copy · edited /)).toBeTruthy();
    const warning = screen.getByRole("status");
    expect(warning.textContent).toBe(
      "Creates 2 copies and replaces 1 copy. The changes Umbrella Ltd made to OrderConfirmation · English will be overwritten. Copying runs in the background; you get a notification when it's done.",
    );
    await user.click(screen.getByRole("button", { name: "Copy to 3 organizations" }));
    await waitFor(() => expect(h.copy).toHaveBeenCalled());
    expect(h.copy.mock.calls[0][0]).toMatchObject({
      allOrganizations: false,
      organizationIds: ["acme", "globex", "umbrella"],
      existing: "replace",
    });
  });

  it("switching back to Keep drops the organizations that have their own copy", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("radio", { name: /Replace it with this version/ }));
    await user.click(row("Umbrella Ltd"));
    await user.click(screen.getByRole("radio", { name: "Keep their copy" }));
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("copies to all organizations without listing them", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("radio", { name: "All organizations" }));
    expect(screen.queryByRole("checkbox", { name: "Acme Corp" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Copy to all organizations" }));
    await waitFor(() => expect(h.copy).toHaveBeenCalled());
    expect(h.copy.mock.calls[0][0]).toEqual({
      templateId: "d-order-en",
      allOrganizations: true,
      existing: "keep",
    });
  });

  it("Select all picks the listed organizations that can be selected", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByText("2 selected")).toBeTruthy();
  });

  it("filters the organizations by the search", async () => {
    const { user } = renderDialog();
    await user.type(screen.getByRole("searchbox", { name: "Search organizations" }), "glo");
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("checkbox")).toHaveLength(1);
    expect(row("Globex")).toBeTruthy();
  });

  it("keeps the dialog open with the error when copying can't start (C9)", async () => {
    h.copy.mockResolvedValue({
      isSuccess: false,
      errors: { Copy: "Copying couldn't start. Try again." },
    });
    const { user, onClose } = renderDialog();
    await user.click(row("Acme Corp"));
    await user.click(screen.getByRole("button", { name: "Copy to 1 organization" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(
      h.showErrorToast.mock.calls[0][0].customMessages["Copying couldn't start. Try again."],
    ).toBe("Copying couldn't start. Try again.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables Copy until an organization is selected", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Copy to 0 organizations" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows the empty, error and more states of the organization list", async () => {
    h.data = { ...h.data, organizations: [], copies: new Map() };
    const { unmount } = render(
      <Dialog open>
        <CopyToOrganizationsDialog template={template} languageName="English" onClose={vi.fn()} />
      </Dialog>,
    );
    expect(screen.getByText("No other organizations")).toBeTruthy();
    unmount();

    h.data = { ...h.data, isError: true };
    const user = userEvent.setup();
    const second = render(
      <Dialog open>
        <CopyToOrganizationsDialog template={template} languageName="English" onClose={vi.fn()} />
      </Dialog>,
    );
    expect(screen.getByText("Couldn't load the organizations.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.data.refetch).toHaveBeenCalled();
    second.unmount();

    h.data = {
      ...h.data,
      isError: false,
      organizations: [{ itemId: "acme", name: "Acme Corp" }],
      hasNextPage: true,
    };
    render(
      <Dialog open>
        <CopyToOrganizationsDialog template={template} languageName="English" onClose={vi.fn()} />
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Show more organizations" }));
    expect(h.data.fetchNextPage).toHaveBeenCalled();
  });

  it("never counts or sends an organization whose own copy turned up under Keep", async () => {
    h.data = { ...h.data, copies: new Map() };
    const { user, rerender } = renderDialog();
    await user.click(row("Acme Corp"));
    await user.click(row("Umbrella Ltd"));
    expect(screen.getByRole("button", { name: "Copy to 2 organizations" })).toBeTruthy();

    // The copies lookup answers after the pick: Umbrella Ltd has its own copy, so Keep locks it.
    h.data = {
      ...h.data,
      copies: new Map([["umbrella", { organizationId: "umbrella", templateId: "u-1" }]]),
    };
    rerender();
    expect(row("Umbrella Ltd")).toHaveProperty("disabled", true);
    expect(screen.getByText("1 selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Copy to 1 organization" }));
    await waitFor(() => expect(h.copy).toHaveBeenCalled());
    expect(h.copy.mock.calls[0][0]).toMatchObject({ organizationIds: ["acme"] });
  });

  it("can't copy while the copies lookup is still running", async () => {
    h.data = { ...h.data, copiesLoading: true };
    const { user } = renderDialog();
    await user.click(row("Acme Corp"));
    expect(screen.getByRole("button", { name: "Copy to 1 organization" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("says when the copies lookup failed, offers a retry and can't copy", async () => {
    h.data = { ...h.data, copiesError: true };
    const { user } = renderDialog();
    expect(
      screen.getByText("Couldn't check which organizations already have their own copy."),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.data.refetchCopies).toHaveBeenCalled();
    await user.click(row("Acme Corp"));
    expect(screen.getByRole("button", { name: "Copy to 1 organization" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("names the keep-or-replace choice by its legend", () => {
    renderDialog();
    expect(
      screen.getByRole("radiogroup", { name: "If an organization already has its own copy" }),
    ).toBeTruthy();
  });
});
