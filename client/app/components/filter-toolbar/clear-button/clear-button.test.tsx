import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

import { ClearButton } from "./clear-button";

describe("ClearButton", () => {
  it("renders a Clear button", () => {
    render(<ClearButton onClear={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });

  it("fires onClear when clicked", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<ClearButton onClear={onClear} />);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
