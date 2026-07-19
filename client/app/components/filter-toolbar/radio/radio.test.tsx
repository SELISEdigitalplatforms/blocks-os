import { render, screen, within, fireEvent } from "@testing-library/react";
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

import { Radio } from "./radio";

const options = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

describe("Radio", () => {
  it("renders the label and a badge for the selected value", () => {
    render(<Radio label="Status" options={options} value="draft" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button");
    expect(within(trigger).getByText("Draft")).toBeTruthy();
  });

  it("selects an option from the popover", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Radio label="Status" options={options} value="" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Archived"));

    expect(onChange).toHaveBeenCalledWith("archived");
  });

  it("filters options by the search box", async () => {
    const user = userEvent.setup();
    render(<Radio label="Status" options={options} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    const search = await screen.findByPlaceholderText("Status");
    fireEvent.change(search, { target: { value: "arch" } });

    expect(screen.getByText("Archived")).toBeTruthy();
    expect(screen.queryByText("Draft")).toBeNull();
  });

  it("clears the selection via the Clear button", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Radio label="Status" options={options} value="active" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
