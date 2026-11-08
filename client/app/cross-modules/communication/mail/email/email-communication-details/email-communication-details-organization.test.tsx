import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  template: null as IEmailTemplate | null,
  configsArgs: [] as unknown[],
  multiOrg: true,
  navigate: vi.fn(),
  dialogs: [] as string[],
}));

vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplate: () => ({ isLoading: false, isFetching: false, data: h.template }),
  useSaveMailTemplate: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailSecretConfigs: (...args: unknown[]) => {
    h.configsArgs = args;
    return {
      isLoading: false,
      isFetching: false,
      data: {
        configurations: [
          { itemId: "def", name: "Default", isDefault: true, isInbound: false },
          {
            itemId: "acme-ses",
            name: "Acme Marketing (SES)",
            organizationId: "acme",
            isOrganizationDefault: true,
            isInbound: false,
          },
        ],
      },
    };
  },
}));
vi.mock("@blocks-communication/mail/hooks/use-email-organization", () => ({
  EMAIL_ORGANIZATION_PARAM: "emailOrg",
  useEmailOrganization: () => ({
    isMultiOrgEnabled: h.multiOrg,
    isLoading: false,
    selectedOrganizationId: "acme",
  }),
  useOrganizationName: (id: string) => (id === "acme" ? "Acme Corp" : "Default organization"),
}));
vi.mock("@seliseblocks/genesis-os/store", () => ({
  useUserStore: () => ({ userDetails: { email: "me@example.com" } }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => ({
    isLoading: false,
    data: [{ languageCode: "en-US", languageName: "English" }],
  }),
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
  usePathSegments: () => [],
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/clone-template/clone-template",
  () => ({
    CloneTemplateDialog: () => <div>clone-dialog</div>,
  }),
);
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/delete-template/delete-template",
  () => ({
    DeleteTemplateDialog: () => <div>delete-dialog</div>,
  }),
);
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/send-test-email/send-test-email",
  () => ({
    SendTestEmailDialog: (p: { sendsThrough: string }) => <div>send-dialog {p.sendsThrough}</div>,
  }),
);

import { EmailCommunicationDetails } from "./email-communication-details";

const template = (over: Partial<IEmailTemplate> = {}) =>
  ({
    itemId: "t-acme",
    name: "ShipmentUpdate",
    language: "en-US",
    organizationId: "acme",
    mailConfigurationId: "",
    templateSubject: "Shipped",
    generatedBy: "System",
    ...over,
  }) as IEmailTemplate;

const renderPage = () =>
  render(
    <MemoryRouter>
      <EmailCommunicationDetails params={{ id: "t-acme" }} />
    </MemoryRouter>,
  );

describe("EmailCommunicationDetails per organization (TemplateDetails, H12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.multiOrg = true;
    h.template = template();
  });

  it("shows the template's organization, language name and resolved configuration", () => {
    renderPage();
    expect(screen.getByText("Organization")).toBeTruthy();
    expect(screen.getByText("Acme Corp")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Organization default")).toBeTruthy();
    expect(screen.getByText("via Acme Marketing (SES)")).toBeTruthy();
    expect(h.configsArgs[0]).toBe("acme");
  });

  it("offers Clone and Delete from the more-actions menu", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "More actions for ShipmentUpdate" }));
    expect(await screen.findByRole("menuitem", { name: "Clone Template" })).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByText("delete-dialog")).toBeTruthy();
  });

  it("hides Delete for a built-in template", async () => {
    h.template = template({ generatedBy: "Tenant" });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "More actions for ShipmentUpdate" }));
    expect(await screen.findByRole("menuitem", { name: "Clone Template" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("opens the test mail dialog with the configuration it sends through", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Send test Email" }));
    expect(await screen.findByText("send-dialog Acme Marketing (SES)")).toBeTruthy();
  });

  it("has no Organization field with multi-org off (C13)", () => {
    h.multiOrg = false;
    renderPage();
    expect(screen.queryByText("Acme Corp")).toBeNull();
  });
});
