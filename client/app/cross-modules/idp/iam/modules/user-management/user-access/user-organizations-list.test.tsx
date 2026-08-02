import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ removeProps: null as Record<string, unknown> | null }));

vi.mock("../user-memberships/remove-membership", () => ({
  RemoveMembership: (props: Record<string, unknown>) => {
    h.removeProps = props;
    return <div data-testid="remove-membership" />;
  },
}));

import { UserOrganizationsList, type UserOrganizationRow } from "./user-organizations-list";

const rows: UserOrganizationRow[] = [
  { organizationId: "default", name: "Default", isEnabled: true, roleCount: 1, permissionCount: 2 },
  { organizationId: "acme", name: "Acme", isEnabled: true, roleCount: 0, permissionCount: 1 },
];

const renderList = (over: Partial<Parameters<typeof UserOrganizationsList>[0]> = {}) => {
  const onSelect = vi.fn();
  render(
    <UserOrganizationsList
      organizations={over.organizations ?? rows}
      selectedOrgId={over.selectedOrgId ?? "default"}
      onSelect={over.onSelect ?? onSelect}
      onManageClick={over.onManageClick ?? vi.fn()}
      isLoading={over.isLoading ?? false}
      userId={over.userId ?? "u1"}
      projectKey={over.projectKey ?? "tenant-1"}
      revokeTarget={over.revokeTarget ?? null}
      onRevokeRequest={over.onRevokeRequest ?? vi.fn()}
      onRevokeDialogChange={over.onRevokeDialogChange ?? vi.fn()}
      onRevokeSuccess={over.onRevokeSuccess ?? vi.fn()}
    />,
  );
  return { onSelect };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.removeProps = null;
});

describe("UserOrganizationsList", () => {
  it("lists every organization", () => {
    renderList();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it("pluralises the role and permission counts", () => {
    renderList();
    expect(screen.getByText(/1 role\b/)).toBeTruthy();
    expect(screen.getByText(/0 roles/)).toBeTruthy();
  });

  it("calls onSelect with the clicked organization id", () => {
    const { onSelect } = renderList();
    fireEvent.click(screen.getByText("Acme"));
    expect(onSelect).toHaveBeenCalledWith("acme");
  });

  it("renders skeletons while loading", () => {
    const { container } = render(
      <UserOrganizationsList
        organizations={[]}
        selectedOrgId=""
        onSelect={vi.fn()}
        onManageClick={vi.fn()}
        isLoading
        userId="u1"
        projectKey="tenant-1"
        revokeTarget={null}
        onRevokeRequest={vi.fn()}
        onRevokeDialogChange={vi.fn()}
        onRevokeSuccess={vi.fn()}
      />,
    );
    expect(screen.queryByText("No organizations found")).toBeNull();
    expect(container.querySelectorAll(".rounded-md").length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no organizations", () => {
    renderList({ organizations: [] });
    expect(screen.getByText("No organizations found")).toBeTruthy();
  });

  it("renders the revoke dialog only when a target is set", () => {
    renderList();
    expect(screen.queryByTestId("remove-membership")).toBeNull();
    renderList({ revokeTarget: rows[1] });
    expect(screen.getByTestId("remove-membership")).toBeTruthy();
    expect(h.removeProps?.organizationName).toBe("Acme");
    expect(h.removeProps?.userId).toBe("u1");
  });
});
