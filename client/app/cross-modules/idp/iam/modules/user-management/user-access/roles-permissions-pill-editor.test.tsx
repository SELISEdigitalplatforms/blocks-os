import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRole } from "@blocks-idp/iam/models/role";
import type { IPermission } from "@blocks-idp/iam/models/permission";

const h = vi.hoisted(() => ({
  rolesFieldProps: null as Record<string, unknown> | null,
  permissionsFieldProps: null as Record<string, unknown> | null,
}));

vi.mock("../user-memberships/organization-roles-field/organization-roles-field", () => ({
  OrganizationRolesField: (props: Record<string, unknown>) => {
    h.rolesFieldProps = props;
    return <div data-testid="roles-field" />;
  },
}));
vi.mock("../user-memberships/organization-permissions-field/organization-permissions-field", () => ({
  OrganizationPermissionsField: (props: Record<string, unknown>) => {
    h.permissionsFieldProps = props;
    return <div data-testid="permissions-field" />;
  },
}));

import { RolesPermissionsPillEditor } from "./roles-permissions-pill-editor";

const roles = [{ itemId: "r1", name: "Admin", slug: "admin" }] as unknown as IRole[];
const permissions = [{ itemId: "p1", name: "Read", resource: "read" }] as unknown as IPermission[];

const renderEditor = (organizationId?: string) => {
  const onSave = vi.fn();
  const onRolesChange = vi.fn();
  const onPermissionsChange = vi.fn();
  render(
    <RolesPermissionsPillEditor
      roles={roles}
      permissions={permissions}
      onRolesChange={onRolesChange}
      onPermissionsChange={onPermissionsChange}
      rolesDescription="Roles copy"
      permissionsDescription="Permissions copy"
      onSave={onSave}
      organizationId={organizationId}
    />,
  );
  return { onSave, onRolesChange, onPermissionsChange };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.rolesFieldProps = null;
  h.permissionsFieldProps = null;
});

describe("RolesPermissionsPillEditor", () => {
  it("renders both editors", () => {
    renderEditor();
    expect(screen.getByTestId("roles-field")).toBeTruthy();
    expect(screen.getByTestId("permissions-field")).toBeTruthy();
  });

  it("passes the roles and their description down", () => {
    renderEditor();
    expect(h.rolesFieldProps?.roles).toBe(roles);
    expect(h.rolesFieldProps?.description).toBe("Roles copy");
  });

  it("passes the permissions and their description down", () => {
    renderEditor();
    expect(h.permissionsFieldProps?.permissions).toBe(permissions);
    expect(h.permissionsFieldProps?.description).toBe("Permissions copy");
  });

  it("shares the same onSave handler with both editors", () => {
    const { onSave } = renderEditor();
    expect(h.rolesFieldProps?.onSave).toBe(onSave);
    expect(h.permissionsFieldProps?.onSave).toBe(onSave);
  });

  it("threads the organization scope into both pickers", () => {
    renderEditor("org-7");
    expect(h.rolesFieldProps?.organizationId).toBe("org-7");
    expect(h.permissionsFieldProps?.organizationId).toBe("org-7");
  });

  it("leaves the organization scope undefined when not provided", () => {
    renderEditor();
    expect(h.rolesFieldProps?.organizationId).toBeUndefined();
    expect(h.permissionsFieldProps?.organizationId).toBeUndefined();
  });
});
