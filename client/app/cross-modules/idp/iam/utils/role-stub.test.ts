import { describe, expect, it } from "vitest";
import { createRoleStub, toRoleStubs } from "./role-stub";

describe("createRoleStub", () => {
  it("fills every field from the slug when only a slug is given", () => {
    const role = createRoleStub({ slug: "admin" });
    expect(role.itemId).toBe("admin");
    expect(role.name).toBe("admin");
    expect(role.slug).toBe("admin");
    expect(role.description).toBe("");
    expect(role.ancestorRoleSlugs).toEqual([]);
    expect(role.parentRoleSlug).toBeNull();
    expect(role.canCreateOwn).toBe(false);
    expect(role.count).toBe(0);
    expect(role.createdFromDefault).toBe(false);
    expect(role.organizationId).toBe("default");
    expect(role.tags).toEqual([]);
    expect(role.language).toBeNull();
  });

  it("prefers explicitly provided fields over slug-derived defaults", () => {
    const role = createRoleStub({
      slug: "editor",
      itemId: "role-1",
      name: "Editor",
      description: "Can edit",
      count: 3,
      organizationId: "org-9",
      ancestorRoleSlugs: ["admin"],
      canCreateOwn: true,
    });
    expect(role.itemId).toBe("role-1");
    expect(role.name).toBe("Editor");
    expect(role.description).toBe("Can edit");
    expect(role.count).toBe(3);
    expect(role.organizationId).toBe("org-9");
    expect(role.ancestorRoleSlugs).toEqual(["admin"]);
    expect(role.canCreateOwn).toBe(true);
  });

  it("omits projectKey unless it is explicitly provided", () => {
    const withoutKey = createRoleStub({ slug: "viewer" });
    expect("projectKey" in withoutKey).toBe(false);

    const withKey = createRoleStub({ slug: "viewer", projectKey: "pk-1" });
    expect(withKey.projectKey).toBe("pk-1");
  });
});

describe("toRoleStubs", () => {
  it("maps a list of slugs into role stubs", () => {
    const roles = toRoleStubs(["a", "b"]);
    expect(roles).toHaveLength(2);
    expect(roles.map((r) => r.slug)).toEqual(["a", "b"]);
    expect(roles[0].name).toBe("a");
  });

  it("returns an empty array for no slugs", () => {
    expect(toRoleStubs([])).toEqual([]);
  });
});
