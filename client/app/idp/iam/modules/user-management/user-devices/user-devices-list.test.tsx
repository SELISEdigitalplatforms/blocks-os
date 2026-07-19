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

import { UserDevicesList } from "./user-devices-list";
import type { IDeviceSession } from "@blocks-idp/iam/models/user";

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const activeSession = {
  IpAddresses: "10.0.0.1",
  IssuedUtc: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  ExpiresUtc: future,
  DeviceInformation: {
    Device: "desktop",
    Model: "macbook",
    Browser: "Chrome",
    OS: "macOS",
  },
} as unknown as IDeviceSession;

const expiredSession = {
  IpAddresses: "10.0.0.2",
  IssuedUtc: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  ExpiresUtc: past,
  DeviceInformation: {
    Device: "",
    Model: "",
    Browser: "",
    OS: "",
  },
} as unknown as IDeviceSession;

describe("UserDevicesList", () => {
  it("renders loading skeletons while loading", () => {
    const { container } = render(<UserDevicesList isLoading data={[]} />);
    // Skeletons are rendered instead of the table
    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByText("No results.")).toBeNull();
  });

  it("renders an empty-state row when there is no data", () => {
    render(<UserDevicesList isLoading={false} data={[]} />);
    expect(screen.getByText("No results.")).toBeTruthy();
  });

  it("renders device rows with IP, device details and an active badge", () => {
    render(<UserDevicesList isLoading={false} data={[activeSession]} />);
    expect(screen.getByText("10.0.0.1")).toBeTruthy();
    // Device + Model are capitalised
    expect(screen.getByText(/Desktop Macbook/)).toBeTruthy();
    expect(screen.getByText(/Chrome/)).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.queryByText("expired")).toBeNull();
  });

  it("falls back to Unknown labels and marks expired sessions", () => {
    render(<UserDevicesList isLoading={false} data={[expiredSession]} />);
    expect(screen.getByText(/Unknown Device/)).toBeTruthy();
    expect(screen.getByText(/Unknown Browser/)).toBeTruthy();
    expect(screen.getByText("expired")).toBeTruthy();
    expect(screen.queryByText("active")).toBeNull();
  });
});
