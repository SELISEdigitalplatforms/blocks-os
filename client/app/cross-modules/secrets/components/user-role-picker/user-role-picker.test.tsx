import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import type { SecretAccess } from "@/cross-modules/secrets/models/secret.model";

const hoisted = vi.hoisted(() => ({
  users: [
    { itemId: "u-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    { itemId: "u-2", firstName: "", lastName: "", email: "grace@example.com" },
  ],
  roles: [
    { itemId: "r-1", slug: "admin", name: "Administrator" },
    { itemId: "r-2", slug: "developer", name: "Developer" },
  ],
  lastUsersPayload: undefined as unknown,
  lastRolesPayload: undefined as unknown,
}));

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUsers: (payload: unknown) => {
    hoisted.lastUsersPayload = payload;
    return { data: { data: hoisted.users, totalCount: hoisted.users.length }, isLoading: false };
  },
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (payload: unknown) => {
    hoisted.lastRolesPayload = payload;
    return { data: { data: hoisted.roles, totalCount: hoisted.roles.length }, isLoading: false };
  },
}));
vi.mock("@/cross-modules/secrets/hooks/use-access-labels", () => ({
  userDisplayName: (user: { firstName?: string; lastName?: string; email?: string; itemId: string }) =>
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || user.itemId,
  useResolvedUserNames: (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, id === "u-1" ? "Ada Lovelace" : id])),
  useResolvedRoleNames: (slugs: string[]) =>
    Object.fromEntries(slugs.map((slug) => [slug, slug === "admin" ? "Administrator" : slug])),
}));

import { UserRolePicker } from "./user-role-picker";

const renderPicker = (value: SecretAccess = { userIds: [], roles: [] }) => {
  const onChange = vi.fn();
  render(<UserRolePicker value={value} onChange={onChange} />);
  return { onChange };
};

const openDialog = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog");
};

describe("UserRolePicker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("warns that an empty list means the creator and root, not everyone", () => {
    renderPicker();
    expect(
      screen.getByText(/Leave both empty and only you and platform administrators/),
    ).toBeTruthy();
  });

  it("drops the warning once something is allowed", () => {
    renderPicker({ userIds: ["u-1"], roles: [] });
    expect(screen.queryByText(/Leave both empty and only you/)).toBeNull();
  });

  it("shows resolved names on the chips", () => {
    renderPicker({ userIds: ["u-1"], roles: ["admin"] });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Administrator")).toBeTruthy();
  });

  it("stores role slugs, not display names", async () => {
    // The JWT `roles` claim carries slugs, and that is what SecretAuthorizationService compares
    // against. Storing "Administrator" would match nobody, silently.
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    const dialog = await openDialog(user, /Add roles/);
    await user.click(within(dialog).getByRole("checkbox", { name: "Administrator" }));
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ userIds: [], roles: ["admin"] }),
    );
  });

  it("stores user ids, not emails", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    const dialog = await openDialog(user, /Add people/);
    await user.click(within(dialog).getByRole("checkbox", { name: "Ada Lovelace" }));
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ userIds: ["u-1"], roles: [] }));
  });

  it("offers no free-text entry — a typo would silently match nobody", async () => {
    const user = userEvent.setup();
    renderPicker();
    const dialog = await openDialog(user, /Add roles/);

    // The only text input is the search box; there is no "type a role name" field.
    const textboxes = within(dialog).getAllByRole("textbox");
    expect(textboxes).toHaveLength(1);
    expect(textboxes[0].getAttribute("placeholder")).toMatch(/search/i);
  });

  it("cannot add the same entry twice", async () => {
    const user = userEvent.setup();
    renderPicker({ userIds: [], roles: ["admin"] });

    const dialog = await openDialog(user, /Add roles/);
    const checkbox = within(dialog).getByRole("checkbox", { name: "Administrator" });

    expect(checkbox.getAttribute("data-state")).toBe("checked");
    expect(checkbox.hasAttribute("disabled")).toBe(true);
  });

  it("removes an entry from the chips", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker({ userIds: ["u-1"], roles: ["admin"] });

    await user.click(screen.getByRole("button", { name: "Remove Administrator" }));

    expect(onChange).toHaveBeenCalledWith({ userIds: ["u-1"], roles: [] });
  });

  it("scopes the user lookup to the active tenant", async () => {
    const user = userEvent.setup();
    renderPicker();
    await openDialog(user, /Add people/);

    expect(hoisted.lastUsersPayload).toMatchObject({ projectKey: "test-tenant-id-123" });
  });

  it("searches roles by name", async () => {
    const user = userEvent.setup();
    renderPicker();
    const dialog = await openDialog(user, /Add roles/);

    await user.type(within(dialog).getByRole("textbox"), "dev");

    await waitFor(() =>
      expect(hoisted.lastRolesPayload).toMatchObject({ filter: { search: "dev" } }),
    );
  });
});
