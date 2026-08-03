import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ onAdd: undefined as ((r: string[]) => void) | undefined }));

vi.mock("@blocks-idp/authentication/components/identity-provider/identity-provider-form.util", () => ({
  toPermissionStubs: (resources: string[]) => resources.map((resource) => ({ resource, name: resource })),
}));
vi.mock("@blocks-idp/authentication/components/sso-initial-permissions/sso-permissions-list", () => ({
  SSOPermissionsList: ({
    permissions,
    onDelete,
  }: {
    permissions: Array<{ resource: string }>;
    onDelete: (p: unknown) => void;
  }) => (
    <div>
      {permissions.map((p) => (
        <button key={p.resource} data-testid={`del-${p.resource}`} onClick={() => onDelete(p)}>
          {p.resource}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./add-client-credential-permission", () => ({
  AddClientCredentialPermission: ({ onAdd }: { onAdd: (r: string[]) => void }) => {
    h.onAdd = onAdd;
    return <div data-testid="add-permission" />;
  },
}));

import { ClientCredentialPermissionsSection } from "./client-credential-permissions-section";

describe("ClientCredentialPermissionsSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty state when there are no permissions", () => {
    render(<ClientCredentialPermissionsSection selectedResources={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No permissions added")).toBeTruthy();
  });

  it("lists selected permissions with a count", () => {
    render(
      <ClientCredentialPermissionsSection selectedResources={["a::b::c"]} onChange={vi.fn()} />,
    );
    expect(screen.getByText("a::b::c")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("removes a permission through the list delete action", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ClientCredentialPermissionsSection
        selectedResources={["a", "b"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("del-a"));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("merges added permissions and caps them at the maximum", () => {
    const onChange = vi.fn();
    render(
      <ClientCredentialPermissionsSection
        selectedResources={["a"]}
        onChange={onChange}
        maxPermissions={2}
      />,
    );
    h.onAdd?.(["b", "c"]);
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });

  it("shows the max-reached message when the limit is hit", () => {
    render(
      <ClientCredentialPermissionsSection
        selectedResources={["a", "b"]}
        onChange={vi.fn()}
        maxPermissions={2}
      />,
    );
    expect(screen.getByText(/Maximum of 2 permissions reached/)).toBeTruthy();
  });
});
