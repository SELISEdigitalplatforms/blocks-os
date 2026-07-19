import { render, screen, fireEvent } from "@testing-library/react";
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

import { SortHeader } from "./sort-header";

describe("SortHeader", () => {
  it("renders the label", () => {
    render(
      <SortHeader
        id="name"
        label="Name"
        value={{ property: "", isDescending: false }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Name")).toBeTruthy();
  });

  it("sorts ascending when clicking a currently unsorted column", () => {
    const onChange = vi.fn();
    render(
      <SortHeader
        id="name"
        label="Name"
        value={{ property: "created", isDescending: false }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Name"));
    expect(onChange).toHaveBeenCalledWith({ property: "name", isDescending: false });
  });

  it("toggles direction when clicking the active ascending column", () => {
    const onChange = vi.fn();
    render(
      <SortHeader
        id="name"
        label="Name"
        value={{ property: "name", isDescending: false }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Name"));
    expect(onChange).toHaveBeenCalledWith({ property: "name", isDescending: true });
  });
});
