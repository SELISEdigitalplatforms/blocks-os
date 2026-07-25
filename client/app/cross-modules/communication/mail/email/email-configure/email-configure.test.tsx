import { render, screen } from "@testing-library/react";
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

// The configuration modals are heavy standalone components with their own tests.
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/new-configuration/new-configuration",
  () => ({ default: () => <div data-testid="new-configuration" /> }),
);
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/delete-email-config/delete-email-config",
  () => ({ default: () => <div data-testid="delete-config" /> }),
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

  it("renders the page wrapper that binds the add dialog to a query param", () => {
    render(<EmailConfigurationPage />);
    expect(screen.getByText("No email configurations found")).toBeTruthy();
  });
});
