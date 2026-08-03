import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ onAdd: undefined as ((s: string[]) => void) | undefined }));

vi.mock("@blocks-idp/iam/utils/role-stub", () => ({
  toRoleStubs: (slugs: string[]) => slugs.map((slug) => ({ slug, name: slug })),
}));
vi.mock("@blocks-idp/authentication/components/sso-initial-roles/sso-roles-list", () => ({
  SSORolesList: ({ roles, onDelete }: { roles: Array<{ slug: string }>; onDelete: (r: unknown) => void }) => (
    <div>
      {roles.map((r) => (
        <button key={r.slug} data-testid={`del-${r.slug}`} onClick={() => onDelete(r)}>
          {r.slug}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./add-client-credential-role", () => ({
  AddClientCredentialRole: ({ onAdd }: { onAdd: (s: string[]) => void }) => {
    h.onAdd = onAdd;
    return <div data-testid="add-role" />;
  },
}));
vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: () => <div data-testid="pagination" />,
}));

import { ClientCredentialRolesSection } from "./client-credential-roles-section";

describe("ClientCredentialRolesSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty state when there are no roles", () => {
    render(<ClientCredentialRolesSection selectedSlugs={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No roles added")).toBeTruthy();
  });

  it("lists selected roles with a count and no pagination under the page size", () => {
    render(<ClientCredentialRolesSection selectedSlugs={["admin", "viewer"]} onChange={vi.fn()} />);
    expect(screen.getByText("admin")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByTestId("pagination")).toBeNull();
  });

  it("paginates when there are more roles than the page size", () => {
    const slugs = Array.from({ length: 7 }, (_, i) => `role-${i}`);
    render(<ClientCredentialRolesSection selectedSlugs={slugs} onChange={vi.fn()} />);
    expect(screen.getByTestId("pagination")).toBeTruthy();
  });

  it("removes a role through the list delete action", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ClientCredentialRolesSection selectedSlugs={["admin", "viewer"]} onChange={onChange} />);
    await user.click(screen.getByTestId("del-admin"));
    expect(onChange).toHaveBeenCalledWith(["viewer"]);
  });

  it("merges added roles without duplicates", () => {
    const onChange = vi.fn();
    render(<ClientCredentialRolesSection selectedSlugs={["admin"]} onChange={onChange} />);
    h.onAdd?.(["admin", "editor"]);
    expect(onChange).toHaveBeenCalledWith(["admin", "editor"]);
  });
});
