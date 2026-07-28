import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";

const { getPermissions, useGetPermissions } = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  useGetPermissions: vi.fn(),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/iam/services/permission.service", () => ({
  permissionService: { getPermissions },
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({ useGetPermissions }));

import { PermissionSelection } from "./permission-selection";

const groupPerms = [
  {
    itemId: "fa1",
    name: "Manage Users",
    type: 2,
    resource: "users:manage",
    resourceGroup: "Users",
    dependentPermissions: ["users:view", "users:edit"],
  },
  {
    itemId: "view1",
    name: "View Users",
    type: 1,
    resource: "users:view",
    resourceGroup: "Users",
    dependentPermissions: [],
  },
  {
    itemId: "edit1",
    name: "Edit Users",
    type: 1,
    resource: "users:edit",
    resourceGroup: "Users",
    dependentPermissions: [],
  },
  {
    itemId: "ind1",
    name: "Delete Users",
    type: 3,
    resource: "users:delete",
    resourceGroup: "Users",
    dependentPermissions: [],
  },
];

const resourceGroups = [{ resourceGroup: "Users", count: 4 }];

const renderComponent = (ref?: React.Ref<unknown>) =>
  render(<PermissionSelection ref={ref as never} slug="admin" resourceGroups={resourceGroups} />, {
    wrapper: createWrapper(),
  });

describe("PermissionSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPermissions.mockResolvedValue({ data: [] });
    useGetPermissions.mockReturnValue({ data: { data: groupPerms }, isLoading: false });
  });

  it("shows the loading skeleton while role permissions are loading", () => {
    getPermissions.mockReturnValue(new Promise(() => {}));
    const { container } = renderComponent();
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("renders the resource group with its total and selected counts", async () => {
    renderComponent();
    expect(await screen.findByText("Users")).toBeTruthy();
    expect(screen.getByText(/Total Permissions: 4/)).toBeTruthy();
  });

  it("loads and lists permissions when a group is expanded", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByText("Users"));
    expect(await screen.findByText("Manage Users")).toBeTruthy();
    expect(screen.getByText("View Users")).toBeTruthy();
    expect(screen.getByText("Delete Users")).toBeTruthy();
    expect(screen.getByText("FE Action")).toBeTruthy();
  });

  it("selecting an FE action selects its dependents and reports them via handleSave", async () => {
    const ref = createRef<{ handleSave: () => { addedPermissions: { itemId: string }[]; removedPermissions: { itemId: string }[] } }>();
    const user = userEvent.setup();
    renderComponent(ref);
    await user.click(await screen.findByText("Users"));
    await screen.findByText("Manage Users");

    await user.click(screen.getByLabelText("Manage Users"));

    let result: { addedPermissions: { itemId: string }[]; removedPermissions: { itemId: string }[] };
    act(() => {
      result = ref.current!.handleSave();
    });
    const addedIds = result!.addedPermissions.map((p) => p.itemId).sort();
    expect(addedIds).toEqual(["edit1", "fa1", "view1"]);
  });

  it("toggles the entire group with the group checkbox", async () => {
    const ref = createRef<{ handleSave: () => { addedPermissions: { itemId: string }[] } }>();
    const user = userEvent.setup();
    renderComponent(ref);
    const { container } = { container: document.body };
    await user.click(await screen.findByText("Users"));
    await screen.findByText("Manage Users");

    await user.click(container.querySelector("#group-Users") as HTMLElement);

    let result: { addedPermissions: { itemId: string }[] };
    act(() => {
      result = ref.current!.handleSave();
    });
    expect(result!.addedPermissions.length).toBeGreaterThanOrEqual(4);
  });

  it("reports removed permissions when a pre-selected permission is unchecked", async () => {
    // role already grants ind1, so it starts selected
    getPermissions.mockResolvedValue({ data: [groupPerms[3]] });
    const ref = createRef<{ handleSave: () => { removedPermissions: { itemId: string }[] } }>();
    const user = userEvent.setup();
    renderComponent(ref);
    await user.click(await screen.findByText("Users"));
    await screen.findByText("Delete Users");

    await user.click(screen.getByLabelText("Delete Users"));

    let result: { removedPermissions: { itemId: string }[] };
    act(() => {
      result = ref.current!.handleSave();
    });
    expect(result!.removedPermissions.map((p) => p.itemId)).toContain("ind1");
  });
});
