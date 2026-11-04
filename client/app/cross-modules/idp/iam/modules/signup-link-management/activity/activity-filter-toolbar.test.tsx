import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({
  queryParams: {
    configurationId: "",
    range: "30d",
    fromUtc: "",
    toUtc: "",
  },
  setQueryParams: vi.fn(),
  configs: [
    { itemId: "c1", name: "Partner", isActive: true },
    { itemId: "c2", name: "Archived campaign", isActive: false },
  ],
}));

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => ({}) },
  useQueryStates: () => [h.queryParams, h.setQueryParams],
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useGetSignupLinkConfigurations: () => ({
    data: { items: h.configs, totalCount: h.configs.length },
    isLoading: false,
  }),
}));

vi.mock("@/components/ui-kits/select/select", () => {
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <div data-value={value} data-testid={`select-${value || "empty"}`}>
      <button
        type="button"
        data-testid={`select-change-${value || "empty"}`}
        onClick={() =>
          onValueChange(
            value === "30d" || value === "7d" || value === "90d" || value === "custom"
              ? "custom"
              : "c2",
          )
        }
      >
        change
      </button>
      {children}
    </div>
  );
  return {
    Select,
    SelectTrigger: ({ children, ...props }: { children: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    SelectValue: () => <span>value</span>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
      <div data-item={value}>{children}</div>
    ),
  };
});

vi.mock("@/components/ui-kits/label/label", () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui-kits/badge/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui-kits/popover/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui-kits/calendar/calendar", () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

vi.mock("@/components/ui-kits/button/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/lib/utils", () => ({
  formatDate: (d: Date) => d.toISOString().slice(0, 10),
}));

import {
  ActivityFilterToolbar,
  buildSummaryPayload,
  computeTrailingUtcBounds,
  resolveFilterFieldErrors,
} from "./activity-filter-toolbar";

describe("buildSummaryPayload", () => {
  it("returns null without configurationId", () => {
    expect(
      buildSummaryPayload({ configurationId: "", range: "30d", fromUtc: "", toUtc: "" }),
    ).toBeNull();
  });

  it("sends no dates for the 30d preset (H6)", () => {
    expect(
      buildSummaryPayload({ configurationId: "c1", range: "30d", fromUtc: "", toUtc: "" }),
    ).toEqual({ configurationId: "c1" });
  });

  it("sends explicit bounds for 7d and 90d (H6)", () => {
    const seven = buildSummaryPayload({
      configurationId: "c1",
      range: "7d",
      fromUtc: "",
      toUtc: "",
    });
    expect(seven?.configurationId).toBe("c1");
    expect(seven?.fromUtc).toBeTruthy();
    expect(seven?.toUtc).toBeTruthy();
    const ninety = buildSummaryPayload({
      configurationId: "c1",
      range: "90d",
      fromUtc: "",
      toUtc: "",
    });
    expect(ninety?.fromUtc).toBeTruthy();
  });

  it("passes custom dates through", () => {
    expect(
      buildSummaryPayload({
        configurationId: "c1",
        range: "custom",
        fromUtc: "a",
        toUtc: "b",
      }),
    ).toEqual({ configurationId: "c1", fromUtc: "a", toUtc: "b" });
  });
});

describe("computeTrailingUtcBounds", () => {
  it("computes a trailing window from now", () => {
    const now = new Date("2026-09-28T12:00:00.000Z");
    const bounds = computeTrailingUtcBounds(7, now);
    expect(bounds.toUtc).toBe(now.toISOString());
    expect(new Date(bounds.fromUtc).getTime()).toBe(now.getTime() - 7 * 86400000);
  });
});

describe("resolveFilterFieldErrors", () => {
  it("maps ConfigurationId and Range/FromUtc/ToUtc onto controls (C7)", () => {
    expect(
      resolveFilterFieldErrors({
        ConfigurationId: "bad id",
        FromUtc: "fromUtc must be earlier than toUtc",
      }),
    ).toEqual({
      configurationId: "bad id",
      range: "fromUtc must be earlier than toUtc",
    });
    expect(resolveFilterFieldErrors({ Range: "The range must not exceed 366 days" })).toEqual({
      range: "The range must not exceed 366 days",
    });
  });
});

describe("ActivityFilterToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queryParams = { configurationId: "", range: "30d", fromUtc: "", toUtc: "" };
  });

  it("lists archived configurations with an Archived badge (H9)", () => {
    render(<ActivityFilterToolbar />);
    expect(screen.getByText("Archived campaign")).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
  });

  it("writes the selected configuration into URL state", async () => {
    const user = userEvent.setup();
    render(<ActivityFilterToolbar />);
    await user.click(screen.getByTestId("select-change-empty"));
    expect(h.setQueryParams).toHaveBeenCalled();
  });

  it("renders field errors against their controls (C7)", () => {
    render(
      <ActivityFilterToolbar
        fieldErrors={{ configurationId: "bad id", range: "range too long" }}
      />,
    );
    expect(screen.getByTestId("activity-configuration-error").textContent).toBe("bad id");
    expect(screen.getByTestId("activity-range-error").textContent).toBe("range too long");
  });

  it("shows custom date picker when range is custom", () => {
    h.queryParams = {
      configurationId: "c1",
      range: "custom",
      fromUtc: "2026-01-01T00:00:00.000Z",
      toUtc: "2026-01-10T00:00:00.000Z",
    };
    render(<ActivityFilterToolbar />);
    expect(screen.getByTestId("activity-custom-range")).toBeTruthy();
    expect(screen.getByText(/2026-01-01/)).toBeTruthy();
  });

  it("switches range to custom via the range select", async () => {
    const user = userEvent.setup();
    h.queryParams = { configurationId: "c1", range: "30d", fromUtc: "", toUtc: "" };
    render(<ActivityFilterToolbar />);
    await user.click(screen.getByTestId("select-change-30d"));
    expect(h.setQueryParams).toHaveBeenCalled();
  });

  it("resets and applies custom dates", async () => {
    const user = userEvent.setup();
    h.queryParams = {
      configurationId: "c1",
      range: "custom",
      fromUtc: "2026-01-01T00:00:00.000Z",
      toUtc: "2026-01-10T00:00:00.000Z",
    };
    render(<ActivityFilterToolbar />);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(h.setQueryParams).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(h.setQueryParams).toHaveBeenCalled();
  });
});
