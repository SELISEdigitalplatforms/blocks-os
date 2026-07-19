import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { DropdownSearchInput } from "./dropdown-search-input";

const options = [
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
];

describe("DropdownSearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders the current search value", () => {
    render(
      <DropdownSearchInput
        options={options}
        value={{ selected: "name", value: "acme" }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Search...") as HTMLInputElement;
    expect(input.value).toBe("acme");
  });

  it("debounces onChange while typing, preserving the selected column", () => {
    const onChange = vi.fn();
    render(
      <DropdownSearchInput
        options={options}
        value={{ selected: "name", value: "" }}
        onChange={onChange}
      />,
    );
    const input = screen.getByPlaceholderText("Search...") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "bob" } });
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith({ selected: "name", value: "bob" });
  });

  it("clears the value immediately via the clear button", () => {
    const onChange = vi.fn();
    render(
      <DropdownSearchInput
        options={options}
        value={{ selected: "name", value: "bob" }}
        onChange={onChange}
      />,
    );

    // The last button in the row is the clear (X) button.
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onChange).toHaveBeenCalledWith({ selected: "name", value: "" });
  });
});
