import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IEmailConfig, IEmailTemplate } from "@blocks-communication/mail/models/email";

type ListArgs = [number, number, string, string, boolean, string, string, string];

const h = vi.hoisted(() => ({
  listCalls: [] as unknown[][],
  pages: {} as Record<number, { templates: unknown[]; totalCount: number }>,
  alreadyCount: 1,
  isError: false,
  refetch: vi.fn(),
  assign: vi.fn(),
  isPending: false,
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplates: (...args: unknown[]) => {
    h.listCalls.push(args);
    const [page, , , , , , mailConfigurationId] = args as ListArgs;
    if (mailConfigurationId) {
      return {
        isLoading: false,
        isError: false,
        isSuccess: true,
        data: { templates: [], totalCount: h.alreadyCount },
      };
    }
    return {
      isLoading: false,
      isError: h.isError,
      refetch: h.refetch,
      data: h.isError ? undefined : (h.pages[page] ?? { templates: [], totalCount: 0 }),
    };
  },
  useAssignTemplates: () => ({ mutateAsync: h.assign, isPending: h.isPending }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => ({
    isLoading: false,
    data: [
      { itemId: "1", languageCode: "en-US", languageName: "English" },
      { itemId: "2", languageCode: "lang-b", languageName: "Lang B" },
    ],
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { AssignTemplatesDialog } from "./assign-templates";

const acmeSmtp = {
  itemId: "acme-smtp",
  name: "Acme SMTP",
  organizationId: "acme",
  isInbound: false,
  isDefault: false,
} as IEmailConfig;
const acmeSes = {
  itemId: "acme-ses",
  name: "Acme SES",
  organizationId: "acme",
  isInbound: false,
  isDefault: false,
} as IEmailConfig;
const gmail = {
  itemId: "gmail",
  name: "Gmail Test",
  organizationId: "default",
  isInbound: false,
  isDefault: false,
} as IEmailConfig;

const row = (id: string, name: string, mailConfigurationId = "", language = "en-US") =>
  ({ itemId: id, name, language, mailConfigurationId, organizationId: "acme" }) as IEmailTemplate;

const renderDialog = ({
  config = acmeSmtp,
  showOrganization = true,
  organizationName = "Acme Corp",
}: { config?: IEmailConfig; showOrganization?: boolean; organizationName?: string } = {}) => {
  const onClose = vi.fn();
  render(
    <Dialog open>
      <AssignTemplatesDialog
        config={config}
        configs={[acmeSmtp, acmeSes, gmail]}
        organizationName={organizationName}
        showOrganization={showOrganization}
        onClose={onClose}
      />
    </Dialog>,
  );
  return { onClose, user: userEvent.setup() };
};

const lastListArgs = () => h.listCalls.filter((args) => !(args as ListArgs)[6]).at(-1) as ListArgs;

describe("AssignTemplatesDialog (SPEC32 H7-H11, C7, C9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.listCalls = [];
    h.isError = false;
    h.isPending = false;
    h.alreadyCount = 1;
    h.pages = {
      0: {
        templates: [
          row("a1", "InvoiceReady"),
          row("a2", "OrderCancelled", "acme-ses"),
          row("a3", "SupportTicketReply", "acme-smtp"),
        ],
        totalCount: 14,
      },
      1: { templates: [row("a11", "WeeklyDigest")], totalCount: 14 },
    };
    h.assign.mockResolvedValue({ isSuccess: true, updatedCount: 2 });
  });

  it("lists only the configuration organization's templates, 10 per page (H7)", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Assign templates" })).toBeTruthy();
    expect(
      screen.getByText(
        "Pick the templates that should send through Acme SMTP. Acme SMTP belongs to Acme Corp, so the list shows only Acme Corp's templates.",
      ),
    ).toBeTruthy();
    const [page, size, search, sort, desc, language, configId, organization] = lastListArgs();
    expect([page, size, search, sort, desc, language, configId, organization]).toEqual([
      0,
      10,
      "",
      "Name",
      false,
      "",
      "",
      "acme",
    ]);
    for (const header of ["Name", "Language", "Current configuration", "What happens"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeTruthy();
    }
    expect(screen.getByText("1–10 of 14")).toBeTruthy();
  });

  it("shows what happens to each row; a template already on it is disabled (H4)", async () => {
    const { user } = renderDialog();
    const already = screen.getByRole("checkbox", { name: "SupportTicketReply · English" });
    expect(already).toHaveProperty("disabled", true);
    expect(screen.getByText("Already uses Acme SMTP")).toBeTruthy();
    expect(screen.getAllByText("No change")).toHaveLength(2);

    await user.click(screen.getByRole("checkbox", { name: "InvoiceReady · English" }));
    expect(screen.getByText("Switches to Acme SMTP")).toBeTruthy();
    expect(screen.getByText("Organization default")).toBeTruthy();
    expect(screen.getByText("Acme SES")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assign 1 template" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("selects the page, offers every page, and submits allMatching with the filters (H8, H9)", async () => {
    const { user, onClose } = renderDialog();
    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "Order");
    await waitFor(() => expect(lastListArgs()[2]).toBe("Order"));

    await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
    expect(screen.getByText("All 2 on this page are selected.")).toBeTruthy();
    // 14 matching, 1 already on the configuration (D4).
    await user.click(screen.getByRole("button", { name: "Select all 13 templates in Acme Corp" }));
    expect(
      screen.getByText("All 13 templates in Acme Corp are selected, on every page."),
    ).toBeTruthy();
    expect(screen.getByText("13 selected.")).toBeTruthy();
    expect(screen.getByText("13 of Acme Corp's templates switch to Acme SMTP.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Assign 13 templates" }));
    await waitFor(() => expect(h.assign).toHaveBeenCalled());
    expect(h.assign.mock.calls[0][0]).toEqual({
      configurationId: "acme-smtp",
      allMatching: true,
      searchKey: "Order",
    });
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "2 templates now use Acme SMTP" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps row selections across pages and submits their ids (H1)", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "InvoiceReady · English" }));
    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    await waitFor(() => expect(lastListArgs()[0]).toBe(1));
    await user.click(screen.getByRole("checkbox", { name: "WeeklyDigest · English" }));
    expect(screen.getByText("2 selected.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Assign 2 templates" }));
    await waitFor(() => expect(h.assign).toHaveBeenCalled());
    expect(h.assign.mock.calls[0][0]).toEqual({
      configurationId: "acme-smtp",
      allMatching: false,
      templateIds: ["a1", "a11"],
    });
  });

  it("leaves every-page mode when a filter changes (H9)", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 13 templates in Acme Corp" }));
    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "x");
    await waitFor(() =>
      expect(
        screen.queryByText("All 13 templates in Acme Corp are selected, on every page."),
      ).toBeNull(),
    );
  });

  it("unticking a row in every-page mode keeps the rest of the page ticked", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 13 templates in Acme Corp" }));
    await user.click(screen.getByRole("checkbox", { name: "InvoiceReady · English" }));
    expect(screen.getByRole("checkbox", { name: "InvoiceReady · English" })).toHaveProperty(
      "ariaChecked",
      "false",
    );
    expect(screen.getByText("1 selected.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Assign 1 template" }));
    await waitFor(() => expect(h.assign).toHaveBeenCalled());
    expect(h.assign.mock.calls[0][0]).toEqual({
      configurationId: "acme-smtp",
      allMatching: false,
      templateIds: ["a2"],
    });
  });

  it("says when the only selectable row on the page is selected", async () => {
    h.pages = { 0: { templates: [row("a1", "InvoiceReady")], totalCount: 1 } };
    h.alreadyCount = 0;
    const { user } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
    expect(screen.getByText("The 1 template on this page is selected.")).toBeTruthy();
  });

  it("waits for a typed search before it can assign", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "InvoiceReady · English" }));
    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "Inv");
    expect(screen.getByRole("button", { name: "Assign 1 template" })).toHaveProperty(
      "disabled",
      true,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Assign 1 template" })).toHaveProperty(
        "disabled",
        false,
      ),
    );
  });

  it("refuses more than 500 explicit templates before sending (C4)", async () => {
    const many = Array.from({ length: 10 }, (_, index) => row(`p${index}`, `T${index}`));
    h.pages = Object.fromEntries(
      Array.from({ length: 51 }, (_, page) => [
        page,
        {
          templates: many.map((t) => ({ ...t, itemId: `${t.itemId}-${page}` })),
          totalCount: 510,
        },
      ]),
    );
    h.alreadyCount = 0;
    const { user } = renderDialog();
    for (let page = 0; page < 51; page++) {
      await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
      if (page < 50) await user.click(screen.getByRole("button", { name: "Go to next page" }));
    }
    expect(screen.getByText("510 selected.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("No more than 500 templates per request");
    expect(screen.getByRole("button", { name: "Assign 510 templates" })).toHaveProperty(
      "disabled",
      true,
    );
  }, 60_000);

  it("clears the selection from the every-page bar", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 13 templates in Acme Corp" }));
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.getByText("0 selected.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assign 0 templates" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("keeps the dialog and the selection open when the request fails (C7)", async () => {
    h.assign.mockResolvedValue({
      isSuccess: false,
      errors: { TemplateIds: "Some templates aren't in this configuration's organization" },
    });
    const { user, onClose } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "InvoiceReady · English" }));
    await user.click(screen.getByRole("button", { name: "Assign 1 template" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    const { customMessages } = h.showErrorToast.mock.calls[0][0];
    expect(customMessages["Some templates aren't in this configuration's organization"]).toBe(
      "Some templates aren't in this configuration's organization",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("checkbox", { name: "InvoiceReady · English" }).getAttribute("data-state"),
    ).toBe("checked");
  });

  it("shows the error when the request throws, and keeps the dialog (C7)", async () => {
    h.assign.mockRejectedValue({ errors: { ConfigurationId: "Configuration not found" } });
    const { user, onClose } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "InvoiceReady · English" }));
    await user.click(screen.getByRole("button", { name: "Assign 1 template" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("changes nothing on Cancel (C9)", async () => {
    const { user, onClose } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "InvoiceReady · English" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(h.assign).not.toHaveBeenCalled();
  });

  it("describes a Default organization configuration (board AssignTemplatesDefault)", async () => {
    const { user } = renderDialog({ config: gmail, organizationName: "Default organization" });
    expect(
      screen.getByText(
        "Pick the templates that should send through Gmail Test. Gmail Test belongs to the Default organization, so the list shows only the Default organization's templates.",
      ),
    ).toBeTruthy();
    expect(lastListArgs()[7]).toBe("default");
    await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
    expect(
      screen.getByRole("button", { name: "Select all 13 templates in the Default organization" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "3 Default organization templates switch to Gmail Test. Organizations' own copies don't change.",
      ),
    ).toBeTruthy();
  });

  it("offers the same dialog with no organizations when multi-org is off (H11)", async () => {
    const { user } = renderDialog({ config: gmail, showOrganization: false });
    expect(
      screen.getByText("Pick the templates that should send through Gmail Test."),
    ).toBeTruthy();
    expect(screen.queryByText(/belongs to/)).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Select all templates on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 13 templates" }));
    expect(screen.getByText("All 13 templates are selected, on every page.")).toBeTruthy();
    expect(screen.getByText("13 templates switch to Gmail Test.")).toBeTruthy();
  });

  it("shows the organization's empty list", () => {
    h.pages = { 0: { templates: [], totalCount: 0 } };
    renderDialog();
    expect(screen.getByText("No templates in Acme Corp yet")).toBeTruthy();
  });

  it("shows an error with retry when the list fails", async () => {
    h.isError = true;
    const { user } = renderDialog();
    expect(screen.getByText("Couldn't load the templates.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("filters by language through the Language filter (H7, D5)", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("button", { name: /^Language/ }));
    const option = await screen.findByLabelText("Lang B");
    await user.click(option);
    await waitFor(() => expect(lastListArgs()[5]).toBe("lang-b"));
    expect(lastListArgs()[0]).toBe(0);
    expect(screen.getAllByText("Lang B").length).toBeGreaterThan(0);
  });
});
