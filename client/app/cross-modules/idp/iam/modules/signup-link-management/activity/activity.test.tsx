import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  configs: {
    data: { items: [] as Array<{ itemId: string; name: string; isActive: boolean }>, totalCount: 0 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetched: true,
  },
  summary: {
    data: undefined as undefined | Record<string, unknown>,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetched: true,
  },
  queryParams: {
    configurationId: "",
    range: "30d",
    fromUtc: "",
    toUtc: "",
  },
  setQueryParams: vi.fn(),
  tenantId: "tenant-1" as string | undefined,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (path: string) => `/app/p1/${path}`,
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useGetSignupLinkConfigurations: () => h.configs,
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-summary", () => ({
  useSignupLinkSummary: () => h.summary,
}));

vi.mock("./activity-filter-toolbar", async () => {
  const actual = await vi.importActual<typeof import("./activity-filter-toolbar")>(
    "./activity-filter-toolbar",
  );
  return {
    ...actual,
    useSignupLinkActivityQueryParams: () => ({
      queryParams: h.queryParams,
      setQueryParams: h.setQueryParams,
    }),
    ActivityFilterToolbar: ({ fieldErrors }: { fieldErrors?: Record<string, string> }) => (
      <div data-testid="activity-filter-toolbar">
        {fieldErrors?.configurationId && (
          <span data-testid="activity-configuration-error">{fieldErrors.configurationId}</span>
        )}
        {fieldErrors?.range && (
          <span data-testid="activity-range-error">{fieldErrors.range}</span>
        )}
      </div>
    ),
  };
});

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { SignupLinkActivity } from "./activity";
import { SIGNUP_LINK_ENDPOINTS } from "@blocks-idp/iam/constants/endpoint.constant";
import { SIGNUP_LINK_CONFIGURATION_ENDPOINTS } from "@blocks-idp/iam/constants/endpoint.constant";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const happySummary = {
  configurationId: "c1",
  configurationName: "Partner onboarding",
  fromUtc: "2026-08-29T00:00:00Z",
  toUtc: "2026-09-28T00:00:00Z",
  totalGenerated: 40,
  used: 22,
  neverUsed: 18,
  neverUsedBreakdown: { active: 10, expired: 5, revoked: 3 },
  rejectedAttempts: 2,
};

describe("SignupLinkActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tenantId = "tenant-1";
    h.queryParams = { configurationId: "", range: "30d", fromUtc: "", toUtc: "" };
    h.configs = {
      data: { items: [{ itemId: "c1", name: "Partner", isActive: true }], totalCount: 1 },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetched: true,
    };
    h.summary = {
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetched: true,
    };
  });

  it("renders the choose state and does not show tiles when nothing is selected (H2)", () => {
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-choose")).toBeTruthy();
    expect(screen.getByTestId("activity-filter-toolbar")).toBeTruthy();
    expect(screen.queryByTestId("activity-tiles")).toBeNull();
  });

  it("renders the none state with a link when the tenant has no configurations (C3)", () => {
    h.configs.data = { items: [], totalCount: 0 };
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-none")).toBeTruthy();
    expect(screen.queryByTestId("activity-filter-toolbar")).toBeNull();
    expect(screen.getByRole("link", { name: /Signup Link Configurations/i })).toBeTruthy();
  });

  it("renders tiles from a successful summary (H4, H5)", () => {
    h.queryParams.configurationId = "c1";
    h.summary.data = happySummary;
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("tile-generated").textContent).toBe("40");
    expect(screen.getByTestId("tile-used").textContent).toBe("22");
    expect(screen.getByTestId("rejected-attempts")).toBeTruthy();
  });

  it("renders the empty state when totalGenerated is 0 (C4)", () => {
    h.queryParams.configurationId = "c1";
    h.summary.data = { ...happySummary, totalGenerated: 0, used: 0, neverUsed: 0 };
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-empty")).toBeTruthy();
    expect(screen.queryByTestId("activity-tiles")).toBeNull();
  });

  it("renders the unknown state when configurationName is null (C5)", () => {
    h.queryParams.configurationId = "missing";
    h.summary.data = { ...happySummary, configurationName: null, totalGenerated: 0 };
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-unknown")).toBeTruthy();
  });

  it("renders tile skeletons while loading (C10)", () => {
    h.queryParams.configurationId = "c1";
    h.summary.isLoading = true;
    h.summary.isFetched = false;
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-tiles-loading")).toBeTruthy();
  });

  it("replaces the screen on 403 without a toast (C8)", () => {
    h.queryParams.configurationId = "c1";
    h.summary.isError = true;
    h.summary.error = { status: 403 };
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-forbidden").textContent).toContain(
      "You do not have permission to view signup link activity.",
    );
    expect(screen.queryByTestId("activity-filter-toolbar")).toBeNull();
  });

  it("shows Retry on network/5xx errors (C9)", async () => {
    h.queryParams.configurationId = "c1";
    h.summary.isError = true;
    h.summary.error = { status: 500 };
    const user = userEvent.setup();
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-error")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.summary.refetch).toHaveBeenCalled();
  });

  it("dims the previous summary and annotates filters on 400 (C7)", () => {
    h.queryParams.configurationId = "c1";
    h.summary.data = happySummary;
    h.summary.isError = true;
    h.summary.error = {
      status: 400,
      errors: { FromUtc: "fromUtc must be earlier than toUtc" },
    };
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-tiles").className).toContain("opacity-50");
    expect(screen.getByTestId("activity-range-error").textContent).toContain(
      "fromUtc must be earlier than toUtc",
    );
  });

  it("shows loading when no project is selected (C11)", () => {
    h.tenantId = undefined;
    render(<SignupLinkActivity />);
    expect(screen.getByTestId("activity-tiles-loading")).toBeTruthy();
  });

  it("renders custom range caption from echoed bounds", () => {
    h.queryParams.configurationId = "c1";
    h.queryParams.range = "custom";
    h.summary.data = happySummary;
    render(<SignupLinkActivity />);
    expect(screen.getByText(/2026-08-29 → 2026-09-28/)).toBeTruthy();
  });

  it("renders last-7-days caption for the 7d preset", () => {
    h.queryParams.configurationId = "c1";
    h.queryParams.range = "7d";
    h.summary.data = happySummary;
    render(<SignupLinkActivity />);
    expect(screen.getByText("Last 7 days")).toBeTruthy();
  });
});

describe("C2 containment — no generate/query/revoke in this module", () => {
  it("SIGNUP_LINK_ENDPOINTS exposes only SUMMARY", () => {
    expect(Object.keys(SIGNUP_LINK_ENDPOINTS)).toEqual(["SUMMARY"]);
    expect(SIGNUP_LINK_ENDPOINTS.SUMMARY).toContain("/signup-links/summary");
  });

  it("activity module source does not name generate/query/revoke endpoints", () => {
    const dir = resolve(__dirname);
    const files = [
      "activity.tsx",
      "activity-filter-toolbar.tsx",
      "activity-summary-tiles.tsx",
      "activity-empty-states.tsx",
      "activity-refresh-header.tsx",
      "index.ts",
    ];
    const banned = [
      "signup-links/query",
      "signup-links/revoke",
      "/signup-links`",
      "GENERATE",
      "REVOKE",
    ];
    for (const file of files) {
      const text = readFileSync(resolve(dir, file), "utf8");
      for (const needle of banned) {
        expect(text.includes(needle), `${file} must not contain ${needle}`).toBe(false);
      }
    }
    // Configuration endpoints remain separate and are allowed for the selector.
    expect(SIGNUP_LINK_CONFIGURATION_ENDPOINTS.QUERY).toContain("configurations/query");
  });
});
