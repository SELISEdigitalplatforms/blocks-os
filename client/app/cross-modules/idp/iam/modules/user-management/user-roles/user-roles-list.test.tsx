import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { UserRolesList } from "./user-roles-list";
import { IRole } from "@blocks-idp/iam/models/role";

const makeRole = (over: Partial<IRole>): IRole =>
  ({
    itemId: "role-1",
    name: "Administrator",
    slug: "administrator",
    description: "",
    ancestorRoleSlugs: [],
    parentRoleSlug: null,
    canCreateOwn: true,
    count: 0,
    createdFromDefault: false,
    createdDate: "",
    lastUpdatedDate: "",
    createdBy: "",
    language: null,
    lastUpdatedBy: "",
    organizationId: "",
    tags: [],
    ...over,
  }) as IRole;

const baseProps = {
  userId: "user-1",
  projectKey: "p1",
  onRemoveRole: vi.fn(),
};

describe("UserRolesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons and no role names while loading", () => {
    render(<UserRolesList roles={[]} isLoading {...baseProps} />);
    expect(screen.queryByText("No roles found")).toBeNull();
    expect(screen.queryByLabelText("Remove role")).toBeNull();
  });

  it("shows the empty-state message when there are no roles", () => {
    render(<UserRolesList roles={[]} isLoading={false} {...baseProps} />);
    expect(screen.getByText("No roles found")).toBeTruthy();
  });

  it("renders role name and slug for each role", () => {
    render(
      <UserRolesList
        roles={[makeRole({ name: "Administrator", slug: "administrator" })]}
        isLoading={false}
        {...baseProps}
      />,
    );
    expect(screen.getByText("Administrator")).toBeTruthy();
    expect(screen.getByText("administrator")).toBeTruthy();
  });

  it("invokes onRemoveRole with the role slug when remove is clicked", async () => {
    const user = userEvent.setup();
    const onRemoveRole = vi.fn();
    render(
      <UserRolesList
        roles={[makeRole({ slug: "editor" })]}
        isLoading={false}
        userId="user-1"
        projectKey="p1"
        onRemoveRole={onRemoveRole}
      />,
    );
    await user.click(screen.getByLabelText("Remove role"));
    expect(onRemoveRole).toHaveBeenCalledWith("editor");
  });
});
