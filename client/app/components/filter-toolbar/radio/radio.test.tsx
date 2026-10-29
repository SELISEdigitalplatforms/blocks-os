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

  const nestedOptions = [
    {
      label: "OS",
      value: "os",
      children: [
        { label: "API", value: "os::api" },
        { label: "Worker", value: "os::worker" },
      ],
    },
    { label: "IAM", value: "iam" },
  ];

  it("does not show an expand toggle for options without children", async () => {
    const user = userEvent.setup();
    render(<Radio label="Service" options={nestedOptions} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    expect(screen.queryByRole("button", { name: "Expand IAM" })).toBeNull();
  });

  it("expands a service to reveal its child options and selects one", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Radio label="Service" options={nestedOptions} value="" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Worker")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Expand OS" }));
    await user.click(await screen.findByText("Worker"));

    expect(onChange).toHaveBeenCalledWith("os::worker");
  });

  it("auto-expands the parent of the currently selected child and shows a combined badge", async () => {
    const user = userEvent.setup();
    render(<Radio label="Service" options={nestedOptions} value="os::worker" onChange={vi.fn()} />);

    expect(within(screen.getByRole("button")).getByText("OS · Worker")).toBeTruthy();

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Worker")).toBeTruthy();
  });
});
