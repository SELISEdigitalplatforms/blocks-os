import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./add-dependent-permission", () => ({
  AddDependentPermission: () => <div data-testid="add-dependent" />,
}));

import { DependentPermissions } from "./dependent-permissions";

describe("DependentPermissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty state and selected count when nothing is selected", () => {
    render(<DependentPermissions permissionsResource={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No dependent permissions selected")).toBeTruthy();
    expect(screen.getByText("0/5 selected")).toBeTruthy();
    expect(screen.getByTestId("add-dependent")).toBeTruthy();
  });

  it("renders a badge per selected permission", () => {
    render(
      <DependentPermissions permissionsResource={["perm-a", "perm-b"]} onChange={vi.fn()} />,
    );
    expect(screen.getByText("perm-a")).toBeTruthy();
    expect(screen.getByText("perm-b")).toBeTruthy();
    expect(screen.getByText("2/5 selected")).toBeTruthy();
  });

  it("removes a permission when its remove icon is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DependentPermissions permissionsResource={["perm-a", "perm-b"]} onChange={onChange} />,
    );
    await user.click(screen.getByLabelText("Remove perm-a"));
    expect(onChange).toHaveBeenCalledWith(["perm-b"]);
  });

  it("hides the add control and remove icons when disabled", () => {
    render(<DependentPermissions permissionsResource={["perm-a"]} onChange={vi.fn()} disabled />);
    expect(screen.queryByTestId("add-dependent")).toBeNull();
    expect(screen.queryByLabelText("Remove perm-a")).toBeNull();
  });
});
