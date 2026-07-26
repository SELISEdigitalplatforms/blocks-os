import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigMultiSelect } from "./config-multi-select";

const options = [
  { label: "Cloud Admin", value: "cloudadmin" },
  { label: "Support Agent", value: "support" },
  { label: "Viewer", value: "viewer" },
];

describe("ConfigMultiSelect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading placeholder while loading", () => {
    render(<ConfigMultiSelect options={options} selected={[]} onChange={vi.fn()} isLoading />);
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("shows the empty message when there are no options", () => {
    render(
      <ConfigMultiSelect
        options={[]}
        selected={[]}
        onChange={vi.fn()}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  it("selects an option that was not previously selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConfigMultiSelect options={options} selected={[]} onChange={onChange} />);

    await user.click(screen.getByText("Support Agent"));
    expect(onChange).toHaveBeenCalledWith(["support"]);
  });

  it("deselects an already-selected option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConfigMultiSelect options={options} selected={["support"]} onChange={onChange} />,
    );

    // Toggle via the list row (the label also appears in the selected badge).
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("Support Agent"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("removes a selection via its badge remove button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConfigMultiSelect
        options={options}
        selected={["cloudadmin", "support"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Remove Cloud Admin"));
    expect(onChange).toHaveBeenCalledWith(["support"]);
  });

  it("clears every selection with Clear all", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConfigMultiSelect
        options={options}
        selected={["cloudadmin", "support"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("filters the visible options by the search query", async () => {
    const user = userEvent.setup();
    render(<ConfigMultiSelect options={options} selected={[]} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Search select items"), "view");
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(screen.queryByText("Support Agent")).toBeNull();
  });

  it("shows a no-results message when nothing matches the search", async () => {
    const user = userEvent.setup();
    render(<ConfigMultiSelect options={options} selected={[]} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Search select items"), "zzz");
    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it("reports the selected and available counts", () => {
    render(
      <ConfigMultiSelect options={options} selected={["viewer"]} onChange={vi.fn()} />,
    );
    expect(screen.getByText("1 selected · 3 available")).toBeTruthy();
  });

  it("does not fire onChange while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConfigMultiSelect options={options} selected={["support"]} onChange={onChange} disabled />,
    );

    await user.click(screen.getByText("Viewer"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
