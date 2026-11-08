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
    selectedOrganizationId: "default",
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

vi.mock(
  "@blocks-communication/mail/components/email-service/modals/copy-to-organizations/copy-to-organizations",
  () => ({
    CopyToOrganizationsDialog: (p: { template: { itemId: string }; languageName: string }) => (
      <div>
        copy-dialog {p.template.itemId} {p.languageName}
      </div>
    ),
  }),
);

import { EmailCommunicationDetails } from "./email-communication-details";

const template = (over: Partial<IEmailTemplate> = {}) =>
  ({
    itemId: "d-order-en",
    name: "OrderConfirmation",
    language: "en-US",
    organizationId: "default",
    mailConfigurationId: "",
    templateSubject: "Thanks",
    generatedBy: "System",
    ...over,
  }) as IEmailTemplate;

const renderPage = () =>
  render(
    <MemoryRouter>
      <EmailCommunicationDetails params={{ id: "d-order-en" }} />
    </MemoryRouter>,
  );

describe("EmailCommunicationDetails: Copy to organizations (SPEC33 H8, C1, C13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.multiOrg = true;
    h.template = template();
  });

  it("offers Copy to organizations on a Default organization template and opens the dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Copy to organizations" }));
    expect(screen.getByText("copy-dialog d-order-en English")).toBeTruthy();
  });

  it("offers no copying on an organization's own template (C1)", () => {
    h.template = template({ itemId: "acme-order-en", organizationId: "acme" });
    renderPage();
    expect(screen.queryByRole("button", { name: "Copy to organizations" })).toBeNull();
  });

  it("offers no copying with multi-org off (C13)", () => {
    h.multiOrg = false;
    renderPage();
    expect(screen.queryByRole("button", { name: "Copy to organizations" })).toBeNull();
  });
});
