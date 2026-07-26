import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Isolate the form from data-fetching child controls.
vi.mock("@blocks-idp/iam/components/permission-group-combobox/permission-group-combobox", () => ({
  PermissionGroupCombobox: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      aria-label="group"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock("../dependent-permissions", () => ({
  DependentPermissions: () => <div data-testid="dependent-permissions" />,
}));

import { PermissionForm } from "./permission-form";

describe("PermissionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the core fields with a default value", () => {
    render(<PermissionForm onSave={vi.fn()} isPending={false} />);
    expect(screen.getByPlaceholderText("Enter name")).toBeTruthy();
    expect(screen.getByText("Type")).toBeTruthy();
    expect(screen.getByLabelText("group")).toBeTruthy();
    expect(screen.getByText("Severity")).toBeTruthy();
  });

  it("shows the read-only banner and disables the save button for built-in permissions", () => {
    render(<PermissionForm onSave={vi.fn()} isPending={false} isBuiltIn />);
    expect(screen.getByText("Read-only permission")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText("Enter name") as HTMLInputElement).disabled).toBe(true);
  });

  it("hides the tags field when showTags is false", () => {
    render(<PermissionForm onSave={vi.fn()} isPending={false} showTags={false} />);
    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("submits the entered values through onSave", async () => {
    const onSave = vi.fn();
    render(
      <PermissionForm
        onSave={onSave}
        isPending={false}
        values={{
          name: "Read Orders",
          type: 2,
          resource: "orders::read",
          resourceGroup: "Orders",
          permissionSeverity: 1,
          tags: [],
          description: "desc",
          dependentPermissions: [],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: "Read Orders", resource: "orders::read" });
  });

  it("renders dependent permissions only for resource type 2", () => {
    render(
      <PermissionForm
        onSave={vi.fn()}
        isPending={false}
        values={{
          name: "n",
          type: 2,
          resource: "r",
          resourceGroup: "g",
          permissionSeverity: 1,
          tags: [],
          description: "",
          dependentPermissions: [],
        }}
      />,
    );
    expect(screen.getByTestId("dependent-permissions")).toBeTruthy();
  });
});
