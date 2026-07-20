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

import { UserHistoryList } from "./user-history-list";
import type { IHistories } from "@blocks-idp/iam/models/user";

const history = {
  Event: "issued_refresh_token",
  LastUpdatedDate: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  IpAddresses: "192.168.1.5",
  DeviceInformation: {
    Device: "desktop",
    Model: "thinkpad",
    Browser: "Firefox",
    OS: "Linux",
  },
} as unknown as IHistories;

describe("UserHistoryList", () => {
  it("renders loading skeletons and no table while loading", () => {
    const { container } = render(<UserHistoryList isLoading data={[]} />);
    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByText("No results.")).toBeNull();
  });

  it("renders an empty-state row when there is no history", () => {
    render(<UserHistoryList isLoading={false} data={[]} />);
    expect(screen.getByText("No results.")).toBeTruthy();
  });

  it("maps the event key to a human-readable label and shows device info", () => {
    render(<UserHistoryList isLoading={false} data={[history]} />);
    expect(screen.getByText("Refresh Token Issued")).toBeTruthy();
    expect(screen.getByText("192.168.1.5")).toBeTruthy();
    expect(screen.getByText(/Desktop Thinkpad/)).toBeTruthy();
    expect(screen.getByText(/Firefox/)).toBeTruthy();
  });
});
