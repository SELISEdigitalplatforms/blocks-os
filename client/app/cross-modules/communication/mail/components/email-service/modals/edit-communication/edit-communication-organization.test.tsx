import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  save: vi.fn(),
  configsArgs: [] as unknown[],
  multiOrg: true,
}));

vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailSecretConfigs: (...args: unknown[]) => {
    h.configsArgs = args;
    return {
      isLoading: false,
      data: {
        configurations: [
          { itemId: "def", name: "Default", isDefault: true, isInbound: false },
          { itemId: "inbox", name: "Inbox", isInbound: true },
          { itemId: "acme-smtp", name: "Acme SMTP", organizationId: "acme", isInbound: false },
        ],
      },
    };
  },
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => ({
    isLoading: false,
    data: [{ languageCode: "en-US", languageName: "English" }],
  }),
}));
vi.mock("../../../../hooks/use-email-template", () => ({
  useSaveMailTemplate: () => ({ isPending: false, mutateAsync: h.save }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-organization", () => ({
  useEmailOrganization: () => ({
    isMultiOrgEnabled: h.multiOrg,
    isLoading: false,
    selectedOrganizationId: "acme",
  }),
  useOrganizationName: (id: string) => (id === "acme" ? "Acme Corp" : "Default organization"),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), showErrorToast: vi.fn() }));

import EditCommunication from "./edit-communication";

const template = {
  itemId: "t-acme",
  name: "OrderConfirmation",
  language: "en-US",
  organizationId: "acme",
  mailConfigurationId: "acme-smtp",
  templateSubject: "Your order",
} as IEmailTemplate;

const renderEdit = () =>
  render(
    <Dialog open>
      <EditCommunication dialogTitle="Edit Template" templateData={template} onClose={vi.fn()} />
    </Dialog>,
  );

describe("EditCommunication per organization (H9, C2, C3, D2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.multiOrg = true;
    h.save.mockResolvedValue({ isSuccess: true });
  });

  it("shows Name and Language read-only with their hints and the template's summary", () => {
    renderEdit();
    const name = screen.getByLabelText("Template name") as HTMLInputElement;
    expect(name.readOnly).toBe(true);
    expect(name.value).toBe("OrderConfirmation");
    const language = screen.getByLabelText("Language") as HTMLInputElement;
    expect(language.readOnly).toBe(true);
    expect(language.value).toBe("English");
    expect(screen.getByText("Can't be changed after creation.")).toBeTruthy();
    expect(screen.getByText("To use another language, clone this template.")).toBeTruthy();
    expect(screen.getByText("Acme Corp · OrderConfirmation · English")).toBeTruthy();
    expect(h.configsArgs[0]).toBe("acme");
  });

  it("lists outbound configurations only, each with a chip for its organization", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("combobox", { name: /email configuration/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /Organization default/ })).toBeTruthy();
    const acmeSmtp = within(listbox).getByRole("option", { name: "Acme SMTP" });
    expect(within(acmeSmtp).getByText("Acme Corp")).toBeTruthy();
    const projectDefault = within(listbox).getByRole("option", { name: "Default" });
    expect(within(projectDefault).getByText("PROJECT DEFAULT")).toBeTruthy();
    expect(within(listbox).queryByRole("option", { name: "Inbox" })).toBeNull();
    expect(
      screen.getByText("Outbound configurations only. Inbound ones can't send mail."),
    ).toBeTruthy();
  });

  it("saves subject and configuration without name, language or organization", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.save).toHaveBeenCalled());
    expect(h.save.mock.calls[0][0]).toEqual({
      itemId: "t-acme",
      templateSubject: "Your order",
      mailConfigurationId: "acme-smtp",
    });
  });

  it("drops the organization from the summary with multi-org off (C13)", () => {
    h.multiOrg = false;
    renderEdit();
    expect(screen.getByText("OrderConfirmation · English")).toBeTruthy();
  });
});
