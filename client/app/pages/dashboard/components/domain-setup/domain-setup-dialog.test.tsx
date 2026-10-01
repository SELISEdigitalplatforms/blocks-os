import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainSetupPhase, DomainSetupSteps } from "@/hooks/use-domain-setup";
import type { IDomain } from "@/models/project.model";
import type { IDomainSetupGuideItem } from "@/models/domain-setup.model";

const { stream } = vi.hoisted(() => ({
  stream: {
    phase: "idle" as DomainSetupPhase,
    error: null as string | null,
    steps: {} as DomainSetupSteps,
    start: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("@/hooks/use-domain-setup", () => ({
  useDomainSetupStream: () => stream,
}));
vi.mock("@seliseblocks/genesis-os/components", () => ({
  LoadingButton: ({
    children,
    isLoading: _isLoading,
    ...props
  }: React.ComponentProps<"button"> & { isLoading?: boolean }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

import { DomainSetupDialog } from "./domain-setup-dialog";

const pendingSteps = (): DomainSetupSteps => ({
  app_dns: { status: "pending" },
  api_dns: { status: "pending" },
  ssl: { status: "pending" },
});

const customDomain = {
  domain: "https://asif.asifrafeen.shop",
  cookieDomain: "asifrafeen.shop",
  isDomainVerified: false,
  domainType: "Custom",
} as IDomain;

const customGuide: IDomainSetupGuideItem = {
  domain: "https://asif.asifrafeen.shop",
  cookieDomain: "asifrafeen.shop",
  isDomainVerified: false,
  isPlatformDomain: false,
  isApex: false,
  apiBaseUrl: "https://dev-blocksapi.asifrafeen.shop",
  records: [
    {
      purpose: "app",
      type: "CNAME",
      name: "asif",
      host: "asif.asifrafeen.shop",
      value: "dev-api.blocksdevelopers.com",
    },
    {
      purpose: "api",
      type: "CNAME",
      name: "dev-blocksapi",
      host: "dev-blocksapi.asifrafeen.shop",
      value: "dev-api.blocksdevelopers.com",
    },
  ],
};

const apexGuide: IDomainSetupGuideItem = {
  ...customGuide,
  domain: "https://lhj.com",
  cookieDomain: "lhj.com",
  isApex: true,
  apiBaseUrl: "https://dev-blocksapi.lhj.com",
  records: [
    { purpose: "app", type: "A", name: "@", host: "lhj.com", value: "4.252.128.223" },
    {
      purpose: "api",
      type: "CNAME",
      name: "dev-blocksapi",
      host: "dev-blocksapi.lhj.com",
      value: "dev-api.blocksdevelopers.com",
    },
  ],
};

const renderDialog = (props: Partial<React.ComponentProps<typeof DomainSetupDialog>> = {}) => {
  const onOpenChange = vi.fn();
  render(
    <DomainSetupDialog
      open
      onOpenChange={onOpenChange}
      domain={customDomain}
      guide={customGuide}
      isGuideLoading={false}
      {...props}
    />,
  );
  return { onOpenChange };
};

describe("DomainSetupDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stream.phase = "idle";
    stream.error = null;
    stream.steps = pendingSteps();
  });

  it("starts an unverified domain on its DNS records", () => {
    renderDialog();

    expect(screen.getByText("Set up custom domain")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Record 1" }).textContent).toContain("asif");
    expect(screen.getByRole("region", { name: "Record 2" }).textContent).toContain("dev-blocksapi");
    expect(screen.getAllByText("dev-api.blocksdevelopers.com")).toHaveLength(2);
  });

  it("explains the A record on an apex domain", () => {
    renderDialog({
      domain: { ...customDomain, domain: "https://lhj.com", cookieDomain: "lhj.com" },
      guide: apexGuide,
    });

    expect(screen.getByText(/is a root \(apex\) domain/)).toBeTruthy();
    expect(screen.getByText("4.252.128.223")).toBeTruthy();
    expect(screen.getByText(/IP address of dev-api.blocksdevelopers.com/)).toBeTruthy();
  });

  it("starts the setup with the site host", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /I’ve added the records/ }));

    expect(stream.start).toHaveBeenCalledWith("asif.asifrafeen.shop");
  });

  it("blocks closing while setup is running", async () => {
    stream.phase = "running";
    stream.steps = { ...pendingSteps(), app_dns: { status: "done" }, ssl: { status: "running" } };
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    expect(screen.getByText("Setting up your domain…")).toBeTruthy();
    const close = screen.getByRole("button", { name: /Close \(disabled while setup is running\)/ });
    expect((close as HTMLButtonElement).disabled).toBe(true);

    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows which record failed and lets the person retry", async () => {
    stream.phase = "failed";
    stream.error = "No DNS record found for dev-blocksapi.asifrafeen.shop.";
    stream.steps = {
      app_dns: { status: "done" },
      api_dns: {
        status: "failed",
        message: "No DNS record found for dev-blocksapi.asifrafeen.shop.",
      },
      ssl: { status: "pending" },
    };
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole("alert").textContent).toContain("We couldn’t find Record 2 yet");
    expect(screen.getByText("Skipped")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(stream.start).toHaveBeenCalledWith("asif.asifrafeen.shop");

    await user.click(screen.getByRole("button", { name: /Back to records/ }));
    expect(stream.reset).toHaveBeenCalled();
  });

  it("opens a verified domain straight on connect, without steps", () => {
    renderDialog({
      domain: { ...customDomain, isDomainVerified: true },
      guide: { ...customGuide, isDomainVerified: true },
    });

    expect(screen.getByRole("heading", { name: "Connect your app" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Setup steps" })).toBeNull();
    expect(
      screen.getByText("VITE_BLOCKS_API_URL=https://dev-blocksapi.asifrafeen.shop"),
    ).toBeTruthy();
    expect(screen.getByText("Your domain is live.")).toBeTruthy();
  });

  it("shows the default API URL for the platform domain", () => {
    renderDialog({
      domain: {
        domain: "https://djskjb-ehxqx.dev.slsblx.com",
        cookieDomain: "slsblx.com",
        isDomainVerified: true,
        domainType: "PlatformSubdomain",
      },
      guide: {
        ...customGuide,
        domain: "https://djskjb-ehxqx.dev.slsblx.com",
        isPlatformDomain: true,
        isDomainVerified: true,
        apiBaseUrl: "https://blocksapi.dev.slsblx.com",
        records: [],
      },
    });

    expect(screen.getByText(/Default domain/)).toBeTruthy();
    expect(screen.getByText("VITE_BLOCKS_API_URL=https://blocksapi.dev.slsblx.com")).toBeTruthy();
    expect(screen.getByText("Ready to use.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Test now/ }).getAttribute("href")).toBe(
      "https://blocksapi.dev.slsblx.com/iam/v4/swagger/index.html",
    );
  });

  it("moves on to connect with the stepper complete once setup succeeds", () => {
    stream.phase = "succeeded";
    renderDialog();

    expect(screen.getByRole("heading", { name: "Connect your app" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Setup steps" })).toBeTruthy();
  });

  it("resets the run when closed", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.click(screen.getByRole("button", { name: "I’ll do it later" }));

    expect(stream.reset).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
