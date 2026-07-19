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

Element.prototype.scrollIntoView = vi.fn();

import { DateRange } from "./date-range";

describe("DateRange", () => {
  it("renders the label on the trigger", () => {
    render(<DateRange label="Created" value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("opens the calendar popover exposing Apply and Reset", async () => {
    const user = userEvent.setup();
    render(<DateRange label="Created" value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Created/ }));
    expect(await screen.findByRole("button", { name: "Apply" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
  });

  it("applies the current value on Apply", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const value = {
      from: new Date("2024-01-15T00:00:00"),
      to: new Date("2024-01-20T00:00:00"),
    };
    render(<DateRange label="Created" value={value} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Created/ }));
    await user.click(await screen.findByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith(value);
  });
});
