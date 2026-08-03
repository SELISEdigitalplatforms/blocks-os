import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRole } from "@blocks-idp/iam/models/role";

const h = vi.hoisted(() => ({ deleteProps: [] as Record<string, unknown>[] }));

vi.mock("./delete-organization-role", () => ({
  DeleteOrganizationRole: (props: Record<string, unknown>) => {
    h.deleteProps.push(props);
    return <button type="button" data-testid="delete-role" />;
  },
}));

import { OrganizationRolesList } from "./organization-roles-list";

const roles = [
  { itemId: "r1", name: "Admin", slug: "admin" },
  { itemId: "r2", name: "Viewer", slug: "viewer" },
] as unknown as IRole[];

beforeEach(() => {
  vi.clearAllMocks();
  h.deleteProps = [];
});

describe("OrganizationRolesList", () => {
  it("renders the Roles and Slug headers", () => {
    render(<OrganizationRolesList roles={roles} onDelete={vi.fn(() => true)} />);
    expect(screen.getByText("Roles")).toBeTruthy();
    expect(screen.getByText("Slug")).toBeTruthy();
  });

  it("renders a row per role with its name and slug", () => {
    render(<OrganizationRolesList roles={roles} onDelete={vi.fn(() => true)} />);
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(screen.getByText("viewer")).toBeTruthy();
  });

  it("renders a delete control per row", () => {
    render(<OrganizationRolesList roles={roles} onDelete={vi.fn(() => true)} />);
    expect(screen.getAllByTestId("delete-role")).toHaveLength(2);
  });

  it("forwards the row's role and the save handler to the delete control", () => {
    const onSave = vi.fn();
    render(<OrganizationRolesList roles={roles} onDelete={vi.fn(() => true)} onSave={onSave} />);
    expect(h.deleteProps[0].role).toBe(roles[0]);
    expect(h.deleteProps[0].onSave).toBe(onSave);
  });

  it("delegates deletion to the onDelete prop", () => {
    const onDelete = vi.fn(() => true);
    render(<OrganizationRolesList roles={roles} onDelete={onDelete} />);
    const handler = h.deleteProps[0].onDelete as (role: IRole) => boolean;
    expect(handler(roles[0])).toBe(true);
    expect(onDelete).toHaveBeenCalledWith(roles[0]);
  });

  it("shows the empty state when there are no roles", () => {
    render(<OrganizationRolesList roles={[]} onDelete={vi.fn(() => true)} />);
    expect(screen.getByText("No roles found")).toBeTruthy();
  });
});
