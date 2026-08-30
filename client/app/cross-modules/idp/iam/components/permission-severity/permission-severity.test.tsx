import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { PermissionSeverity } from "./permission-severity";
import type { IGetPermissionsSeverityResponse } from "@blocks-idp/iam/models/permission";

const data = [
  { severityLevel: "Critical", count: 3 },
  { severityLevel: "High", count: 12 },
] as unknown as IGetPermissionsSeverityResponse;

describe("PermissionSeverity", () => {
  it("renders a card for every severity level", () => {
    render(<PermissionSeverity data={data} isLoading={false} />);
    expect(screen.getByText("Permission Severity Overview")).toBeTruthy();
    for (const label of ["Critical", "High", "Medium", "Low", "None"]) {
      expect(screen.getByText(`${label} Risk`)).toBeTruthy();
    }
  });

  it("zero-pads counts and defaults missing levels to 00", () => {
    render(<PermissionSeverity data={data} isLoading={false} />);
    // Critical=3 -> "03"
    expect(screen.getByText("03")).toBeTruthy();
    // High=12 -> "12"
    expect(screen.getByText("12")).toBeTruthy();
    // Medium/Low/None absent from data -> "00" (three cards)
    expect(screen.getAllByText("00")).toHaveLength(3);
  });

  it("hides the numeric counts while loading", () => {
    render(<PermissionSeverity data={data} isLoading />);
    // Labels still render, but no count numbers are shown during loading.
    expect(screen.getByText("Critical Risk")).toBeTruthy();
    expect(screen.queryByText("03")).toBeNull();
    expect(screen.queryByText("Permissions")).toBeNull();
  });

  it("shows a compact skeleton sized for the reduced tile height while loading", () => {
    // H4
    const { container } = render(<PermissionSeverity data={data} isLoading />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(5);
    skeletons.forEach((skeleton) => {
      expect(skeleton.className).toContain("h-6");
      expect(skeleton.className).not.toContain("h-8");
    });
  });

  it("lays out all 5 tiles in a single row from the tablet breakpoint up, not capped at 4", () => {
    // H1, H2 - `md:grid-cols-5` fits all 5 tiles in one row at tablet width and stays that way at
    // any wider viewport too, unlike the old `xl:grid-cols-4` cap which could never fit 5 in a row.
    const { container } = render(<PermissionSeverity data={data} isLoading={false} />);
    const grid = container.querySelector(".grid");
    expect(grid?.className).toContain("md:grid-cols-5");
    expect(grid?.className).not.toContain("xl:grid-cols-4");
  });

  it("wraps rather than forcing a single row below the tablet breakpoint", () => {
    // C1
    const { container } = render(<PermissionSeverity data={data} isLoading={false} />);
    const grid = container.querySelector(".grid");
    expect(grid?.className).toContain("grid-cols-2");
    expect(grid?.className).not.toContain("grid-cols-1");
  });

  it("uses a smaller count font size than the old text-4xl treatment", () => {
    // H3
    render(<PermissionSeverity data={data} isLoading={false} />);
    const count = screen.getByText("03");
    expect(count.className).toContain("text-2xl");
    expect(count.className).not.toContain("text-4xl");
  });
});
