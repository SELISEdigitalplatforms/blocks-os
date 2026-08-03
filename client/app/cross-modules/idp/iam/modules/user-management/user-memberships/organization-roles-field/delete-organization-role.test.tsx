import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRole } from "@blocks-idp/iam/models/role";

import { DeleteOrganizationRole } from "./delete-organization-role";

const role = { itemId: "r1", name: "Admin", slug: "admin" } as unknown as IRole;

const open = () => fireEvent.click(screen.getByRole("button", { name: "Remove Admin" }));

beforeEach(() => vi.clearAllMocks());

describe("DeleteOrganizationRole", () => {
  it("renders a labelled remove trigger", () => {
    render(<DeleteOrganizationRole role={role} onDelete={vi.fn(() => true)} />);
    expect(screen.getByRole("button", { name: "Remove Admin" })).toBeTruthy();
  });

  it("opens the confirmation dialog", () => {
    render(<DeleteOrganizationRole role={role} onDelete={vi.fn(() => true)} />);
    open();
    expect(screen.getByText("Remove Role")).toBeTruthy();
    expect(screen.getByText("Are you sure you want to remove this role?")).toBeTruthy();
  });

  it("closes without deleting when cancelled", () => {
    const onDelete = vi.fn(() => true);
    render(<DeleteOrganizationRole role={role} onDelete={onDelete} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes the role and defers the save when confirmed", async () => {
    const onDelete = vi.fn(() => true);
    const onSave = vi.fn();
    render(<DeleteOrganizationRole role={role} onDelete={onDelete} onSave={onSave} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onDelete).toHaveBeenCalledWith(role);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("skips the save when the parent refused the removal", async () => {
    const onSave = vi.fn();
    render(
      <DeleteOrganizationRole role={role} onDelete={vi.fn(() => false)} onSave={onSave} />,
    );
    open();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(onSave).not.toHaveBeenCalled();
  });
});
