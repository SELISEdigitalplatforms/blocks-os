import { navigationMenus } from "./navigation-menus";

describe("navigationMenus Identity & Access section", () => {
  const section = navigationMenus.find(
    (menu) => menu.type === "menu" && menu.id === "service-identity__authentication",
  );

  it("labels the section Identity & Access and anchors it at /app/iam", () => {
    expect(section).toBeDefined();
    if (section?.type !== "menu") throw new Error("section is not a menu");
    expect(section.name).toBe("Identity & Access");
    expect(section.path).toBe("/app/iam");
  });

  it("orders the children with One-Click Signup last", () => {
    if (section?.type !== "menu") throw new Error("section is not a menu");
    const names = (section.children ?? [])
      .filter((child) => child.type === "menu")
      .map((child) => (child.type === "menu" ? child.name : ""));
    expect(names).toEqual([
      "Settings",
      "Users",
      "Organizations",
      "Roles",
      "Permissions",
      "One-Click Signup",
    ]);
  });

  it("points One-Click Signup at the configurations route", () => {
    if (section?.type !== "menu") throw new Error("section is not a menu");
    const paths = (section.children ?? [])
      .filter((child) => child.type === "menu")
      .map((child) => (child.type === "menu" ? child.path : ""));

    expect(paths).toContain("/app/iam/signup-link-configurations");
  });

  it("keeps the signup-link activity screen out of the sidebar", () => {
    if (section?.type !== "menu") throw new Error("section is not a menu");
    // Hidden deliberately: the route still resolves, it is only unlinked. If this ever
    // fails, the entry came back -- which is fine, but the sibling paths share the
    // "/app/iam/signup-link" prefix and expansion is pathname.startsWith(menu.path), so
    // check that neither path is a prefix of the other before shipping it.
    const paths = (section.children ?? [])
      .filter((child) => child.type === "menu")
      .map((child) => (child.type === "menu" ? child.path : ""));

    expect(paths).not.toContain("/app/iam/signup-link-activity");
  });

  it("uses startsWith-safe singular path prefixes for entries with detail pages", () => {
    if (section?.type !== "menu") throw new Error("section is not a menu");
    const paths = Object.fromEntries(
      (section.children ?? [])
        .filter((child) => child.type === "menu")
        .map((child) => (child.type === "menu" ? [child.name, child.path] : ["", ""])),
    );
    expect(paths.Settings).toBe("/app/iam/settings");
    expect(paths.Users).toBe("/app/iam/user");
    expect(paths.Organizations).toBe("/app/iam/organization");
    expect(paths.Roles).toBe("/app/iam/role");
    expect(paths.Permissions).toBe("/app/iam/permission");
  });

  it("keeps every authored menu path outside the retired /app/idp prefix", () => {
    const collectPaths = (menus: typeof navigationMenus): string[] =>
      menus.flatMap((menu) =>
        menu.type === "menu"
          ? [menu.path, ...(menu.children ? collectPaths(menu.children) : [])]
          : [],
      );
    const offenders = collectPaths(navigationMenus).filter((path) => path.startsWith("/app/idp"));
    expect(offenders).toEqual([]);
  });
});
