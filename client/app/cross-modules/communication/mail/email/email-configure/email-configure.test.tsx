import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  config: { isLoading: false, data: { configurations: [] as Record<string, unknown>[] } },
  formMounts: [] as string[],
  formProps: [] as Record<string, unknown>[],
  configsCalls: [] as unknown[][],
  usage: {} as Record<
    string,
    { data?: number; isLoading?: boolean; isError?: boolean; refetch?: () => void }
  >,
  usageCalls: [] as string[],
  organization: {
    isMultiOrgEnabled: false,
    isLoading: false,
    selectedOrganizationId: "default",
    setSelectedOrganizationId: vi.fn(),
  },
  organizationNames: {} as Record<string, string>,
  addOpen: false,
}));

// Tooltip re-exports blocks-kit (process.env at load); passthrough keeps it renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The configuration modals are heavy standalone components with their own tests. The stand-ins
// render inside a real DialogContent, which mounts only while its dialog is open — so a test can
// see which row's dialog a click opened.
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/new-configuration/new-configuration",
  async () => {
    const { DialogContent, DialogTitle } = await import("@/components/ui-kits/dialog/dialog");
    const { useEffect } = await import("react");
    function NewConfigurationStub(
      props: Readonly<{
        dialogTitle: string;
        previousData?: { name: string };
      }>,
    ) {
      const { dialogTitle, previousData } = props;
      h.formProps.push(props as unknown as Record<string, unknown>);
      // Records each time a form instance is created, so a test can tell whether
      // reopening the dialog starts a fresh form or reuses the unsaved one.
      useEffect(() => {
        h.formMounts.push(dialogTitle);
      }, [dialogTitle]);
      return (
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{`${dialogTitle}: ${previousData?.name ?? "new"}`}</DialogTitle>
        </DialogContent>
      );
    }
    return {
      default: NewConfigurationStub,
    };
  },
);
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/delete-email-config/delete-email-config",
  async () => {
    const { DialogContent, DialogTitle } = await import("@/components/ui-kits/dialog/dialog");
    return {
      default: ({ configId }: { configId: string }) => (
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{`Delete: ${configId}`}</DialogTitle>
        </DialogContent>
      ),
    };
  },
);
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/edit-default-sender-name/edit-default-sender-name",
  async () => {
    const { DialogContent, DialogTitle } = await import("@/components/ui-kits/dialog/dialog");
    return {
      default: ({ config }: { config: { name: string } }) => (
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{`Edit Sender Name: ${config.name}`}</DialogTitle>
        </DialogContent>
      ),
    };
  },
);
vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailSecretConfigs: (...args: unknown[]) => {
    h.configsCalls.push(args);
    return h.config;
  },
  useGetEmailConfigUsage: (configurationId: string) => {
    h.usageCalls.push(configurationId);
    return { refetch: vi.fn(), ...(h.usage[configurationId] ?? { data: 0 }) };
  },
}));
vi.mock("@blocks-communication/mail/hooks/use-email-organization", () => ({
  useEmailOrganization: () => h.organization,
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizationById: ({ itemId }: { itemId: string }) => ({
    data: h.organizationNames[itemId]
      ? { organization: { name: h.organizationNames[itemId] } }
      : undefined,
  }),
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/components/ui-kits/stepper/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("nuqs", () => ({
  parseAsBoolean: { withDefault: () => ({}) },
  useQueryState: () => [h.addOpen, vi.fn()],
}));

import { EmailConfiguration, EmailConfigurationPage } from "./email-configure";

/** Opens a card's ⋮ menu (Radix opens on pointer down) and returns its items' names. */
const openMenu = (name: string) => {
  fireEvent.pointerDown(screen.getByRole("button", { name: `More actions for ${name}` }), {
    button: 0,
    ctrlKey: false,
  });
  return screen.queryAllByRole("menuitem").map((item) => item.textContent);
};
const chooseFromMenu = (name: string, item: "Edit" | "Delete") => {
  openMenu(name);
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
};

const outbound = {
  itemId: "cfg-1",
  name: "Primary Outbound",
  host: "smtp.example.com",
  port: 587,
  isInbound: false,
  isDefault: false,
  provider: 0,
  senderName: "Team",
  senderAddress: "team@example.com",
  senderUserName: "team-user",
};

describe("EmailConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.config = { isLoading: false, data: { configurations: [] } };
    h.formMounts = [];
    h.formProps = [];
    h.configsCalls = [];
    h.usage = {};
    h.usageCalls = [];
    h.organization = {
      isMultiOrgEnabled: false,
      isLoading: false,
      selectedOrganizationId: "default",
      setSelectedOrganizationId: vi.fn(),
    };
    h.organizationNames = {};
    h.addOpen = false;
  });

  it("starts a fresh edit form each time the dialog opens, so Cancel drops unsaved input", () => {
    h.config = { isLoading: false, data: { configurations: [outbound] } };
    render(<EmailConfiguration />);

    // Closed dialogs hold no form.
    expect(h.formMounts).toEqual([]);

    chooseFromMenu("Primary Outbound", "Edit");
    expect(screen.getByText("Edit Configuration: Primary Outbound")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByText("Edit Configuration: Primary Outbound")).toBeNull();

    chooseFromMenu("Primary Outbound", "Edit");
    expect(h.formMounts).toEqual(["Edit Configuration", "Edit Configuration"]);
  });

  it("renders skeletons while loading", () => {
    h.config = { isLoading: true, data: { configurations: [] } };
    const { container } = render(<EmailConfiguration />);
    expect(container.querySelector("[class*='rounded']")).toBeTruthy();
    expect(screen.queryByText("No email configurations found")).toBeNull();
  });

  it("renders the empty state when there are no configurations", () => {
    render(<EmailConfiguration />);
    expect(screen.getByText("No email configurations found")).toBeTruthy();
  });

  it("renders an outbound configuration with sender details and actions", () => {
    h.config = { isLoading: false, data: { configurations: [outbound] } };
    render(<EmailConfiguration />);
    expect(screen.getByText("Primary Outbound")).toBeTruthy();
    expect(screen.getByText("smtp.example.com")).toBeTruthy();
    expect(screen.getByText("Outbound")).toBeTruthy();
    expect(screen.getByText("team@example.com")).toBeTruthy();
    // H10: Edit and Delete live in the card's ⋮ menu.
    expect(openMenu("Primary Outbound")).toEqual(["Edit", "Delete"]);
  });

  it("renders inbound details and hides actions for a default configuration", () => {
    h.config = {
      isLoading: false,
      data: {
        configurations: [
          {
            ...outbound,
            itemId: "cfg-2",
            name: "Default Inbound",
            isInbound: true,
            isDefault: true,
          },
        ],
      },
    };
    render(<EmailConfiguration />);
    expect(screen.getByText("Inbound")).toBeTruthy();
    expect(screen.getByText("Server Name")).toBeTruthy();
    // No action applies to the default inbound record, so it has no menu at all.
    expect(screen.queryByRole("button", { name: "More actions for Default Inbound" })).toBeNull();
  });

  it("lets a default outbound configuration edit only its sender name", () => {
    h.config = {
      isLoading: false,
      data: { configurations: [{ ...outbound, name: "Default", isDefault: true }] },
    };
    render(<EmailConfiguration />);

    expect(openMenu("Default")).toEqual(["Edit"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByText("Edit Sender Name: Default")).toBeTruthy();
    expect(screen.queryByText(/^Edit Configuration/)).toBeNull();
  });

  describe("with several configurations", () => {
    const blockTest = { ...outbound, itemId: "cfg-block", name: "Block Test" };
    const officeInbound = {
      ...outbound,
      itemId: "cfg-office",
      name: "Office Inbound Test",
      host: "outlook.office365.com",
      port: 993,
      isInbound: true,
      provider: 2,
      authenticationType: 1,
      tenantId: "contoso-tenant",
      clientId: "mailer-app",
      mailboxAddress: "support@contoso.com",
      isClientSecretConfigured: true,
    };

    beforeEach(() => {
      h.config = { isLoading: false, data: { configurations: [blockTest, officeInbound] } };
    });

    it("opens the edit dialog of the row that was clicked, and only that one", () => {
      render(<EmailConfiguration />);

      chooseFromMenu("Block Test", "Edit");

      expect(screen.getByText("Edit Configuration: Block Test")).toBeTruthy();
      expect(screen.queryByText("Edit Configuration: Office Inbound Test")).toBeNull();
    });

    it("opens the delete dialog of the row that was clicked, and only that one", () => {
      render(<EmailConfiguration />);

      chooseFromMenu("Block Test", "Delete");

      // A shared open flag put every row's delete dialog on screen, with the last row's on top —
      // confirming it deleted a configuration the user never chose.
      expect(screen.getByText("Delete: cfg-block")).toBeTruthy();
      expect(screen.queryByText("Delete: cfg-office")).toBeNull();
    });

    it("shows an OAuth inbound record's application, not a username and password", () => {
      render(<EmailConfiguration />);

      fireEvent.click(screen.getByText("Office Inbound Test"));

      expect(screen.getByText("contoso-tenant")).toBeTruthy();
      expect(screen.getByText("support@contoso.com")).toBeTruthy();
      expect(screen.queryByText("Username")).toBeNull();
      expect(screen.queryByText("Account Password")).toBeNull();
    });
  });

  describe("Office 365 client secret status", () => {
    const office365 = (over: Record<string, unknown>) => ({
      ...outbound,
      itemId: "cfg-o365",
      name: "Office Outbound",
      provider: 2,
      authenticationType: 1,
      tenantId: "contoso-tenant",
      clientId: "mailer-app",
      mailboxAddress: "mailer@contoso.com",
      ...over,
    });

    const renderExpanded = (over: Record<string, unknown>) => {
      h.config = { isLoading: false, data: { configurations: [office365(over)] } };
      // The first configuration renders expanded.
      render(<EmailConfiguration />);
      return screen.getByText("Client secret").parentElement as HTMLElement;
    };

    it.each(["active", "locked"])(
      "shows exactly the existing 'Configured' text for a %s secret",
      (clientSecretStatus) => {
        const cell = renderExpanded({ clientSecretStatus, isClientSecretConfigured: true });

        expect(cell.textContent).toBe("Client secretConfigured");
        expect(screen.getByText("Configured").className).toBe("text-base");
      },
    );

    it("shows the existing 'Not configured' text when there is no secret", () => {
      const cell = renderExpanded({ clientSecretStatus: "none", isClientSecretConfigured: false });
      expect(cell.textContent).toBe("Client secretNot configured");
    });

    it.each([
      [
        "archived",
        "Archived",
        "The linked secret was archived. Edit this configuration and enter a new secret to repair it.",
      ],
      [
        "missing",
        "Missing",
        "The linked secret no longer exists. Edit this configuration and enter a new secret to repair it.",
      ],
    ])(
      "shows a warning badge and the repair hint for a %s secret",
      (clientSecretStatus, label, help) => {
        renderExpanded({ clientSecretStatus, isClientSecretConfigured: false });

        expect(screen.getByText(label).className).toContain("bg-warning-100");
        expect(screen.getByText(help)).toBeTruthy();
        expect(screen.queryByText("Not configured")).toBeNull();
        expect(screen.queryByText("Configured")).toBeNull();
      },
    );

    it("shows 'Status unavailable' with its explanation when the status could not be read", () => {
      renderExpanded({ clientSecretStatus: "unavailable", isClientSecretConfigured: true });

      expect(screen.getByText("Status unavailable")).toBeTruthy();
      expect(screen.getByText("Couldn't check the linked secret right now.")).toBeTruthy();
      expect(screen.queryByText("Configured")).toBeNull();
    });
  });

  it("renders the page wrapper that binds the add dialog to a query param", () => {
    render(<EmailConfigurationPage />);
    expect(screen.getByText("No email configurations found")).toBeTruthy();
  });
  describe("single-org projects (H12)", () => {
    it("lists every configuration without an organization filter, chips or organization row", () => {
      h.config = {
        isLoading: false,
        data: {
          configurations: [{ ...outbound, isOrganizationDefault: true, organizationId: "default" }],
        },
      };
      render(<EmailConfigurationPage />);

      expect(h.configsCalls.at(-1)).toEqual([undefined, true]);
      expect(screen.queryByText("ORG DEFAULT")).toBeNull();
      expect(screen.queryByText("PROJECT DEFAULT")).toBeNull();
      expect(screen.queryByText("Organization")).toBeNull();
      expect(screen.queryByText("From the Default organization")).toBeNull();
    });

    it("shows how many templates use the expanded card, fetched only for that card (H11)", () => {
      const second = { ...outbound, itemId: "cfg-2", name: "Second" };
      h.config = { isLoading: false, data: { configurations: [outbound, second] } };
      h.usage = { "cfg-1": { data: 0 } };
      render(<EmailConfigurationPage />);

      expect(screen.getByText("Used by 0 templates")).toBeTruthy();
      expect(new Set(h.usageCalls)).toEqual(new Set(["cfg-1"]));
    });

    it("says 1 template in the singular", () => {
      h.config = { isLoading: false, data: { configurations: [outbound] } };
      h.usage = { "cfg-1": { data: 1 } };
      render(<EmailConfigurationPage />);
      expect(screen.getByText("Used by 1 template")).toBeTruthy();
    });

    it("keeps the card and offers a retry when the usage call fails (C8)", () => {
      const refetch = vi.fn();
      h.config = { isLoading: false, data: { configurations: [outbound] } };
      h.usage = { "cfg-1": { isError: true, refetch } };
      render(<EmailConfigurationPage />);

      expect(screen.getByText("smtp.example.com")).toBeTruthy();
      expect(screen.queryByText(/^Used by/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(refetch).toHaveBeenCalled();
    });
  });

  describe("multi-org projects", () => {
    const acmeSmtp = {
      ...outbound,
      itemId: "acme-smtp",
      name: "Acme SMTP",
      organizationId: "acme",
      isOrganizationDefault: true,
    };
    const acmeSes = { ...outbound, itemId: "acme-ses", name: "Acme SES", organizationId: "acme" };
    const projectDefault = {
      ...outbound,
      itemId: "default-1",
      name: "Default",
      isDefault: true,
      organizationId: "default",
    };
    const gmail = { ...outbound, itemId: "gmail-1", name: "Gmail Test", organizationId: "default" };

    beforeEach(() => {
      h.organization = { ...h.organization, isMultiOrgEnabled: true };
      h.organizationNames = { acme: "Acme Corp" };
    });

    it("lists the Default organization's configurations by default (H7)", () => {
      h.config = { isLoading: false, data: { configurations: [projectDefault, gmail] } };
      render(<EmailConfigurationPage />);

      expect(h.configsCalls.at(-1)).toEqual(["default", true]);
      expect(screen.getByText("Default organization · 2 configurations")).toBeTruthy();
      expect(screen.getByText("PROJECT DEFAULT")).toBeTruthy();
      expect(screen.queryByText("From the Default organization")).toBeNull();
    });

    it("waits for the organization config before listing", () => {
      h.organization = { ...h.organization, isLoading: true };
      render(<EmailConfigurationPage />);
      expect(h.configsCalls.at(-1)?.[1]).toBe(false);
    });

    it("shows the organization's configurations, then the Default organization's (Main, H10)", () => {
      h.organization = { ...h.organization, selectedOrganizationId: "acme" };
      h.config = {
        isLoading: false,
        data: { configurations: [projectDefault, acmeSmtp, acmeSes, gmail] },
      };
      render(<EmailConfigurationPage />);

      expect(h.configsCalls.at(-1)).toEqual(["acme", true]);
      const headings = screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent);
      expect(headings).toEqual(["Acme Corp · 2 configurations", "From the Default organization"]);
      expect(screen.getByText("ORG DEFAULT")).toBeTruthy();
      expect(screen.getByText("PROJECT DEFAULT")).toBeTruthy();
      // The organization's first card is the expanded one, with its organization.
      expect(screen.getByText("Acme Corp")).toBeTruthy();
    });

    it("shows the organization's empty state above the Default organization's configurations (H8)", () => {
      h.organization = { ...h.organization, selectedOrganizationId: "acme" };
      h.config = { isLoading: false, data: { configurations: [projectDefault, gmail] } };
      render(<EmailConfigurationPage />);

      expect(screen.getByText("No configurations for Acme Corp")).toBeTruthy();
      expect(screen.getByText("From the Default organization")).toBeTruthy();
      expect(screen.getByText("Gmail Test")).toBeTruthy();
    });

    it("pre-fills the add dialog with the organization and ticks the default when it has none (H9)", () => {
      h.addOpen = true;
      h.organization = { ...h.organization, selectedOrganizationId: "acme" };
      h.config = { isLoading: false, data: { configurations: [projectDefault, acmeSes] } };
      render(<EmailConfigurationPage />);

      expect(h.formProps.at(-1)).toMatchObject({
        organization: { id: "acme", name: "Acme Corp" },
        organizationHasDefault: false,
      });
    });

    it("tells the add dialog when the organization already has a default", () => {
      h.addOpen = true;
      h.organization = { ...h.organization, selectedOrganizationId: "acme" };
      h.config = { isLoading: false, data: { configurations: [acmeSmtp] } };
      render(<EmailConfigurationPage />);

      expect(h.formProps.at(-1)).toMatchObject({ organizationHasDefault: true });
    });

    it("passes the card's organization to the edit dialog, so it shows read-only (C6)", () => {
      h.organization = { ...h.organization, selectedOrganizationId: "acme" };
      h.config = { isLoading: false, data: { configurations: [acmeSmtp] } };
      render(<EmailConfigurationPage />);

      chooseFromMenu("Acme SMTP", "Edit");
      expect(h.formProps.at(-1)).toMatchObject({
        isEdit: true,
        organization: { id: "acme", name: "Acme Corp" },
      });
    });

    it("keeps the full list in the embedded dialog, which has no picker (D8)", () => {
      h.config = { isLoading: false, data: { configurations: [acmeSmtp, gmail] } };
      render(<EmailConfiguration />);

      expect(h.configsCalls.at(-1)).toEqual([undefined, true]);
      expect(screen.queryByText("From the Default organization")).toBeNull();
      expect(screen.getByText("Acme SMTP")).toBeTruthy();
      expect(screen.getByText("Gmail Test")).toBeTruthy();
    });
  });
});
