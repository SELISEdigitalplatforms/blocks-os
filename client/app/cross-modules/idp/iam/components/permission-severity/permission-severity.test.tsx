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
});
