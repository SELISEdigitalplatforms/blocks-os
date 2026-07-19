import { render, screen, within } from "@testing-library/react";
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

// cmdk (Command) scrolls the active item into view; jsdom lacks scrollIntoView.
Element.prototype.scrollIntoView = vi.fn();

import { MultiSelect } from "./multi-select";

const options = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

describe("MultiSelect", () => {
  it("renders the label and shows badges for selected values", () => {
    render(
      <MultiSelect label="Status" options={options} value={["active", "draft"]} onChange={vi.fn()} />,
    );
    const trigger = screen.getByRole("button");
    expect(within(trigger).getAllByText("Status").length).toBeGreaterThan(0);
    expect(within(trigger).getByText("Active")).toBeTruthy();
    expect(within(trigger).getByText("Draft")).toBeTruthy();
  });

  it("summarizes as 'N selected' when more than two are chosen", () => {
    render(
      <MultiSelect
        label="Status"
        options={options}
        value={["active", "draft", "archived"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("3 selected")).toBeTruthy();
  });

  it("adds a value to the selection when an option is chosen", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MultiSelect label="Status" options={options} value={["active"]} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Archived"));

    expect(onChange).toHaveBeenCalledWith(["active", "archived"]);
  });
});
