import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { KVDetailItem } from "./kv-detail-item";

describe("KVDetailItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the label and a plain value", () => {
    render(<KVDetailItem label="Client ID" value="abc-123" />);
    expect(screen.getByText("Client ID")).toBeTruthy();
    expect(screen.getByText("abc-123")).toBeTruthy();
  });

  it("renders an empty placeholder when the value is missing", () => {
    render(<KVDetailItem label="Secret" value="" />);
    expect(screen.getByText("empty")).toBeTruthy();
  });

  it("masks a sensitive value until it is revealed", async () => {
    const user = userEvent.setup();
    render(<KVDetailItem label="Secret" value="super-secret-value" sensitive />);

    // The raw value is masked initially.
    expect(screen.queryByText("super-secret-value")).toBeNull();

    await user.click(screen.getByLabelText("Show value"));

    expect(screen.getByText("super-secret-value")).toBeTruthy();
    // Toggling exposes a hide affordance.
    expect(screen.getByLabelText("Hide value")).toBeTruthy();
  });
});
