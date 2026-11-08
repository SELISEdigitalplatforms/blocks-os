import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailTemplate } from "../../../models/email";

const h = vi.hoisted(() => ({
  saveTemplate: vi.fn(),
  configsArgs: [] as unknown[],
  organization: { isMultiOrgEnabled: true, isLoading: false, selectedOrganizationId: "acme" },
}));

vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailSecretConfigs: (...args: unknown[]) => {
    h.configsArgs = args;
    return {
      isLoading: false,
      data: {
        configurations: [
          { itemId: "def", name: "Default", isDefault: true, isInbound: false },
          { itemId: "gmail", name: "Gmail Test", isInbound: false },
          { itemId: "inbox", name: "Inbox", isInbound: true },
          { itemId: "acme-smtp", name: "Acme SMTP", organizationId: "acme", isInbound: false },
          { itemId: "acme-in", name: "Acme Inbox", organizationId: "acme", isInbound: true },
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
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useSaveMailTemplate: () => ({ isPending: false, mutateAsync: h.saveTemplate }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-organization", () => ({
  useEmailOrganization: () => h.organization,
  useOrganizationName: (id: string) => (id === "acme" ? "Acme Corp" : "Default organization"),
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn() }));

import BasicInformation from "./basic-information";

type ImperativeRef = { submit: () => void; isValid: boolean };
const blank = {
  itemId: "",
  name: "",
  language: "",
  mailConfigurationId: "",
  templateSubject: "",
} as IEmailTemplate;

describe("BasicInformation per organization (H1, H8, D9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.organization = { isMultiOrgEnabled: true, isLoading: false, selectedOrganizationId: "acme" };
    h.saveTemplate.mockResolvedValue({ isSuccess: true, itemId: "t-new" });
  });

  it("shows the page's organization read-only and lists Organization default and outbound configurations, each with a chip for its organization", async () => {
    const user = userEvent.setup();
    render(<BasicInformation templateData={blank} />);
    const organization = screen.getByLabelText("Organization") as HTMLInputElement;
    expect(organization.value).toBe("Acme Corp");
    expect(organization.readOnly).toBe(true);
    expect(h.configsArgs[0]).toBe("acme");

    await user.click(screen.getByRole("combobox", { name: /email configuration/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /Organization default/ })).toBeTruthy();
    const acmeSmtp = within(listbox).getByRole("option", { name: "Acme SMTP" });
    expect(within(acmeSmtp).getByText("Acme Corp")).toBeTruthy();
    const gmail = within(listbox).getByRole("option", { name: "Gmail Test" });
    expect(within(gmail).getByText("Default organization")).toBeTruthy();
    const projectDefault = within(listbox).getByRole("option", { name: "Default" });
    expect(within(projectDefault).getByText("PROJECT DEFAULT")).toBeTruthy();
    expect(within(listbox).queryByRole("option", { name: "Acme Inbox" })).toBeNull();
    expect(within(listbox).queryByRole("option", { name: "Inbox" })).toBeNull();
  });

  it("shows no organization chips with multi-org off", async () => {
    h.organization = {
      isMultiOrgEnabled: false,
      isLoading: false,
      selectedOrganizationId: "default",
    };
    const user = userEvent.setup();
    render(<BasicInformation templateData={blank} />);
    await user.click(screen.getByRole("combobox", { name: /email configuration/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "Gmail Test" })).toBeTruthy();
    expect(within(listbox).queryByText("Default organization")).toBeNull();
    expect(within(listbox).queryByText("PROJECT DEFAULT")).toBeNull();
  });

  it("saves in the page's organization, with Organization default as an empty configuration (D9)", async () => {
    const ref = createRef<ImperativeRef>();
    render(
      <BasicInformation
        ref={ref}
        templateData={{
          ...blank,
          itemId: "t-1",
          name: "OrderConfirmation",
          language: "en-US",
          templateSubject: "Hi",
          mailConfigurationId: "",
        }}
      />,
    );
    await waitFor(() => expect(ref.current?.isValid).toBe(true));
    await act(async () => ref.current?.submit());
    await waitFor(() => expect(h.saveTemplate).toHaveBeenCalled());
    expect(h.saveTemplate.mock.calls[0][0]).toMatchObject({
      name: "OrderConfirmation",
      organizationId: "acme",
      mailConfigurationId: "",
    });
  });

  it("keeps the name and language fixed once step 1 has saved (C2, C3)", () => {
    render(
      <BasicInformation
        templateData={{ ...blank, itemId: "t-1", name: "OrderConfirmation", language: "en-US" }}
      />,
    );
    expect((screen.getByPlaceholderText("Enter name") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByRole("combobox", { name: /language/i })).toHaveProperty("disabled", true);
  });

  it("lets a new template choose its name and language", () => {
    render(<BasicInformation templateData={blank} />);
    expect((screen.getByPlaceholderText("Enter name") as HTMLInputElement).readOnly).toBe(false);
    expect(screen.getByRole("combobox", { name: /language/i })).toHaveProperty("disabled", false);
  });

  it("has no Organization field with multi-org off and creates in the Default organization (H2, C13)", async () => {
    h.organization = {
      isMultiOrgEnabled: false,
      isLoading: false,
      selectedOrganizationId: "default",
    };
    const ref = createRef<ImperativeRef>();
    render(
      <BasicInformation
        ref={ref}
        templateData={{
          ...blank,
          name: "Welcome",
          language: "en-US",
          templateSubject: "Hi",
          mailConfigurationId: "gmail",
        }}
      />,
    );
    expect(screen.queryByLabelText("Organization")).toBeNull();
    await waitFor(() => expect(ref.current?.isValid).toBe(true));
    await act(async () => ref.current?.submit());
    await waitFor(() => expect(h.saveTemplate).toHaveBeenCalled());
    expect(h.saveTemplate.mock.calls[0][0]).toMatchObject({
      organizationId: "default",
      mailConfigurationId: "gmail",
    });
  });
});
