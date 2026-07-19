import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { FilterToolbar } from "./filter-toolbar";

// A single SearchInput-typed filter keeps the toolbar's mobile view from
// tucking extra controls behind a Sheet, so the rendered controls are direct.
const searchFilter = [
  {
    key: "q",
    type: "SearchInput" as const,
    label: "Search",
    props: { placeholder: "Search here" },
  },
];

describe("FilterToolbar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the configured controls", () => {
    render(
      <FilterToolbar
        filters={searchFilter as never}
        values={{ q: "" }}
        defaultValues={{ q: "" }}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    // Desktop + mobile views each render the control.
    expect(screen.getAllByPlaceholderText("Search here").length).toBeGreaterThan(0);
  });

  it("hides the global reset button when values match the defaults", () => {
    render(
      <FilterToolbar
        filters={searchFilter as never}
        values={{ q: "" }}
        defaultValues={{ q: "" }}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });

  it("shows the reset button and calls onReset with the defaults when clicked", async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterToolbar
        filters={searchFilter as never}
        values={{ q: "changed" }}
        defaultValues={{ q: "" }}
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );

    const resetBtn = screen.getByRole("button", { name: "Reset" });
    await user.click(resetBtn);
    expect(onReset).toHaveBeenCalledWith({ q: "" });
  });

  it("forwards debounced control changes through onChange", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <FilterToolbar
        filters={searchFilter as never}
        values={{ q: "" }}
        defaultValues={{ q: "" }}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    const input = screen.getAllByPlaceholderText("Search here")[0];
    fireEvent.change(input, { target: { value: "abc" } });
    vi.advanceTimersByTime(300);

    expect(onChange).toHaveBeenCalledWith("q", "abc", { q: "abc" });
  });
});
