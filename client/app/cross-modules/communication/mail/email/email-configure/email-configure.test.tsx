import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  config: { isLoading: false, data: { configurations: [] as Record<string, unknown>[] } },
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
    return {
      default: ({
        dialogTitle,
        previousData,
      }: {
        dialogTitle: string;
        previousData?: { name: string };
      }) => (
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{`${dialogTitle}: ${previousData?.name ?? "new"}`}</DialogTitle>
        </DialogContent>
      ),
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
vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailSecretConfigs: () => h.config,
}));
vi.mock("@/components/ui-kits/stepper/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("nuqs", () => ({
  parseAsBoolean: { withDefault: () => ({}) },
  useQueryState: () => [false, vi.fn()],
}));

import { EmailConfiguration, EmailConfigurationPage } from "./email-configure";

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
    expect(screen.getByLabelText("Edit")).toBeTruthy();
    expect(screen.getByLabelText("Delete")).toBeTruthy();
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
    expect(screen.queryByLabelText("Edit")).toBeNull();
    expect(screen.queryByLabelText("Delete")).toBeNull();
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

      fireEvent.click(screen.getAllByLabelText("Edit")[0]);

      expect(screen.getByText("Edit Configuration: Block Test")).toBeTruthy();
      expect(screen.queryByText("Edit Configuration: Office Inbound Test")).toBeNull();
    });

    it("opens the delete dialog of the row that was clicked, and only that one", () => {
      render(<EmailConfiguration />);

      fireEvent.click(screen.getAllByLabelText("Delete")[0]);

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

  it("renders the page wrapper that binds the add dialog to a query param", () => {
    render(<EmailConfigurationPage />);
    expect(screen.getByText("No email configurations found")).toBeTruthy();
  });
});
