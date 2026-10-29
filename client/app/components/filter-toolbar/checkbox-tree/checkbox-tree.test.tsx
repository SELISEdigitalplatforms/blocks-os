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

import { CheckboxTree } from "./checkbox-tree";

const options = [
  {
    label: "IAM",
    value: "iam",
    children: [
      { label: "API", value: "iam::api" },
      { label: "Worker", value: "iam::worker" },
    ],
  },
  { label: "OS", value: "os" },
];

const checkbox = (name: string) => screen.getByRole("checkbox", { name });

describe("CheckboxTree", () => {
  it("renders a badge for a fully selected group", () => {
    render(<CheckboxTree label="Service" options={options} value={["iam"]} onChange={vi.fn()} />);
    expect(within(screen.getAllByRole("button")[0]).getByText("IAM")).toBeTruthy();
  });

  it("renders a badge naming the single selected child", () => {
    render(
      <CheckboxTree label="Service" options={options} value={["iam::worker"]} onChange={vi.fn()} />,
    );
    expect(within(screen.getAllByRole("button")[0]).getByText("IAM · Worker")).toBeTruthy();
  });

  it("selects the parent and all of its children in one click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CheckboxTree label="Service" options={options} value={[]} onChange={onChange} />);

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByText("IAM"));

    expect(onChange).toHaveBeenCalledWith(["iam"]);
  });

  it("shows every child checked while the parent is selected", async () => {
    const user = userEvent.setup();
    render(<CheckboxTree label="Service" options={options} value={["iam"]} onChange={vi.fn()} />);

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByRole("button", { name: "Expand IAM" }));

    expect(checkbox("IAM").getAttribute("data-state")).toBe("checked");
    expect(checkbox("API").getAttribute("data-state")).toBe("checked");
    expect(checkbox("Worker").getAttribute("data-state")).toBe("checked");
  });

  it("narrows a fully selected parent to the remaining children", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CheckboxTree label="Service" options={options} value={["iam"]} onChange={onChange} />);

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByRole("button", { name: "Expand IAM" }));
    await user.click(screen.getByText("Worker"));

    expect(onChange).toHaveBeenCalledWith(["iam::api"]);
  });

  it("shows the parent as indeterminate for a partial selection and auto-expands it", async () => {
    const user = userEvent.setup();
    render(
      <CheckboxTree label="Service" options={options} value={["iam::api"]} onChange={vi.fn()} />,
    );

    await user.click(screen.getAllByRole("button")[0]);

    expect(checkbox("IAM").getAttribute("data-state")).toBe("indeterminate");
    expect(checkbox("API").getAttribute("data-state")).toBe("checked");
    expect(checkbox("Worker").getAttribute("data-state")).toBe("unchecked");
  });

  it("collapses a completed child set back to the parent value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CheckboxTree label="Service" options={options} value={["iam::api"]} onChange={onChange} />,
    );

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByText("Worker"));

    expect(onChange).toHaveBeenCalledWith(["iam"]);
  });

  it("deselects the whole group when the last child is unchecked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CheckboxTree label="Service" options={options} value={["iam::api"]} onChange={onChange} />,
    );

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByText("API"));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("keeps several groups selected at once", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CheckboxTree label="Service" options={options} value={["iam"]} onChange={onChange} />);

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByText("OS"));

    expect(onChange).toHaveBeenCalledWith(["iam", "os"]);
  });

  it("adds another group without touching the current one", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CheckboxTree label="Service" options={options} value={["iam::api"]} onChange={onChange} />,
    );

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByText("OS"));

    expect(onChange).toHaveBeenCalledWith(["iam::api", "os"]);
  });

  it("does not show an expand toggle for options without children", async () => {
    const user = userEvent.setup();
    render(<CheckboxTree label="Service" options={options} value={[]} onChange={vi.fn()} />);

    await user.click(screen.getAllByRole("button")[0]);

    expect(screen.queryByRole("button", { name: "Expand OS" })).toBeNull();
  });

  it("filters options by the search box, keeping matching children", async () => {
    const user = userEvent.setup();
    render(<CheckboxTree label="Service" options={options} value={[]} onChange={vi.fn()} />);

    await user.click(screen.getAllByRole("button")[0]);
    fireEvent.change(await screen.findByPlaceholderText("Service"), {
      target: { value: "work" },
    });

    expect(screen.getByText("IAM")).toBeTruthy();
    expect(screen.queryByText("OS")).toBeNull();
  });

  it("offers no in-popover Clear footer — resetting is the toolbar's job", async () => {
    const user = userEvent.setup();
    render(<CheckboxTree label="Service" options={options} value={["iam"]} onChange={vi.fn()} />);

    await user.click(screen.getAllByRole("button")[0]);
    await screen.findByPlaceholderText("Service");

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});
