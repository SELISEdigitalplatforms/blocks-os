import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/components/ui-kits/tooltip/tooltip", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});

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

    // Toggling again re-masks the value.
    await user.click(screen.getByLabelText("Hide value"));
    expect(screen.queryByText("super-secret-value")).toBeNull();
  });

  it("renders a copyable value with a copy button", () => {
    render(<KVDetailItem label="Client ID" value="copy-me-123" copyable />);
    expect(screen.getByText("copy-me-123")).toBeTruthy();
    expect(screen.getByLabelText("Copy value")).toBeTruthy();
  });

  it("copies a copyable value through the clipboard API", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });

    render(<KVDetailItem label="Client ID" value="clip-copyable" copyable />);
    await user.click(screen.getByLabelText("Copy value"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("clip-copyable"));
  });

  it("copies a sensitive value through the clipboard API", async () => {
    const user = userEvent.setup();
    // Override after setup so userEvent's own clipboard stub does not shadow ours.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });

    render(<KVDetailItem label="Secret" value="clip-secret" sensitive />);
    await user.click(screen.getByLabelText("Copy value"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("clip-secret"));
  });

  it("falls back to execCommand when the clipboard API is unavailable", async () => {
    const user = userEvent.setup();
    // Remove the clipboard after setup to force the legacy execCommand path.
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    const exec = vi.fn();
    (document as unknown as { execCommand: unknown }).execCommand = exec;

    render(<KVDetailItem label="Secret" value="legacy-secret" sensitive />);
    await user.click(screen.getByLabelText("Copy value"));

    await waitFor(() => expect(exec).toHaveBeenCalledWith("copy"));
  });
});
