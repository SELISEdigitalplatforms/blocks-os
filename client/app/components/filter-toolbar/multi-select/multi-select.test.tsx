import { fireEvent, render, screen, within } from "@testing-library/react";
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
      <MultiSelect
        label="Status"
        options={options}
        value={["active", "draft"]}
        onChange={vi.fn()}
      />,
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

  const nestedOptions = [
    {
      label: "OS",
      value: "blocks-os",
      children: [{ label: "blocks-os-worker", value: "blocks-os-worker" }],
    },
    { label: "IAM", value: "blocks-iam" },
  ];

  it("does not show an expand toggle for options without children", async () => {
    const user = userEvent.setup();
    render(<MultiSelect label="Service" options={nestedOptions} value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    expect(screen.queryByRole("button", { name: "Expand IAM" })).toBeNull();
  });

  it("expands a service to reveal and select a worker without deselecting the API entry", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelect
        label="Service"
        options={nestedOptions}
        value={["blocks-os"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("blocks-os-worker")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Expand OS" }));
    await user.click(await screen.findByText("blocks-os-worker"));

    expect(onChange).toHaveBeenCalledWith(["blocks-os", "blocks-os-worker"]);
  });

  it("resolves a selected child's label in the trigger badge", () => {
    render(
      <MultiSelect
        label="Service"
        options={nestedOptions}
        value={["blocks-os-worker"]}
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button");
    expect(within(trigger).getByText("blocks-os-worker")).toBeTruthy();
  });

  it("loads the next page when the options list is scrolled near the bottom", async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelect
        label="Organization"
        options={options}
        value={[]}
        onChange={vi.fn()}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button"));
    const list = screen.getByRole("listbox");
    Object.defineProperties(list, {
      scrollHeight: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, value: 180 },
    });
    fireEvent.scroll(list);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not request another page while one is already loading", async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelect
        label="Organization"
        options={options}
        value={[]}
        onChange={vi.fn()}
        hasMore
        isLoadingMore
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button"));
    fireEvent.scroll(screen.getByRole("listbox"));

    expect(screen.getByRole("status").textContent).toContain("Loading more");
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("can keep its scrollable content inside a containing modal", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="modal-content">
        <MultiSelect
          label="Organization"
          options={options}
          value={[]}
          onChange={vi.fn()}
          portalled={false}
        />
      </div>,
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByTestId("modal-content").contains(screen.getByRole("listbox"))).toBe(true);
  });
});
