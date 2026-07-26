import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetResourceGroup: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetResourceGroup: (...args: unknown[]) => h.useGetResourceGroup(...args),
}));

import { PermissionGroupCombobox } from "./permission-group-combobox";

const setGroups = (groups: string[]) => {
  h.useGetResourceGroup.mockReturnValue({
    data: groups.map((resourceGroup) => ({ resourceGroup })),
  });
};

describe("PermissionGroupCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGroups(["finance", "operations", "marketing"]);
  });

  it("shows the placeholder when no value is selected", () => {
    render(<PermissionGroupCombobox value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select or create group...")).toBeTruthy();
  });

  it("shows the selected value and a clear affordance", () => {
    render(<PermissionGroupCombobox value="finance" onChange={vi.fn()} />);
    expect(screen.getByText("finance")).toBeTruthy();
    expect(screen.getByLabelText("Clear group")).toBeTruthy();
  });

  it("clears the value from the trigger clear button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PermissionGroupCombobox value="finance" onChange={onChange} />);

    await user.click(screen.getByLabelText("Clear group"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("lists the existing groups when opened", async () => {
    const user = userEvent.setup();
    render(<PermissionGroupCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("finance")).toBeTruthy();
    expect(screen.getByText("operations")).toBeTruthy();
  });

  it("selects an existing group", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PermissionGroupCombobox value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("operations"));
    expect(onChange).toHaveBeenCalledWith("operations");
  });

  it("filters the list by the typed query", async () => {
    const user = userEvent.setup();
    render(<PermissionGroupCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search or create a group..."), "mark");

    expect(screen.getByText("marketing")).toBeTruthy();
    expect(screen.queryByText("finance")).toBeNull();
  });

  it("offers to create a group when the query matches nothing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PermissionGroupCombobox value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search or create a group..."), "logistics");

    await user.click(screen.getByText(/Create group/));
    expect(onChange).toHaveBeenCalledWith("logistics");
  });

  it("creates a group by pressing Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PermissionGroupCombobox value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search or create a group...");
    await user.type(input, "security{Enter}");
    expect(onChange).toHaveBeenCalledWith("security");
  });

  it("offers a clear-selection item while a value is set", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PermissionGroupCombobox value="finance" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Clear selection"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not render a clear button when disabled", () => {
    render(<PermissionGroupCombobox value="finance" onChange={vi.fn()} disabled />);
    expect(screen.queryByLabelText("Clear group")).toBeNull();
  });

  it("shows the empty prompt when there are no groups and no query", async () => {
    const user = userEvent.setup();
    setGroups([]);
    render(<PermissionGroupCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() =>
      expect(
        screen.getByText("Type a name to create a new group, or pick one below."),
      ).toBeTruthy(),
    );
  });
});
