import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pathname: "/app/p1/idp/role-detail",
  segments: [] as Array<{ href: string; label: string }>,
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useLocation: () => ({ pathname: h.pathname }) };
});

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  usePathSegments: () => h.segments,
}));

import PageBreadcrumb from "./breadcrumb";

const renderCrumb = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <PageBreadcrumb {...props} />
    </MemoryRouter>,
  );

describe("PageBreadcrumb", () => {
  beforeEach(() => {
    h.segments = [
      { href: "/app/p1/idp/role-detail", label: "Role default" },
      { href: "/app/p1/idp/permission-detail", label: "Permission default" },
      { href: "/app/p1/dashboard", label: "Dashboard" },
    ];
  });

  it("applies custom titles and rewrites detail links to their list route", () => {
    renderCrumb();
    // Custom titles from BREADCRUMB_CUSTOM_TITLES replace the defaults.
    const rolesLink = screen.getByRole("link", { name: "Roles" }) as HTMLAnchorElement;
    expect(rolesLink.getAttribute("href")).toContain("/app/p1/idp/roles");
    const permsLink = screen.getByRole("link", { name: "Permissions" }) as HTMLAnchorElement;
    expect(permsLink.getAttribute("href")).toContain("/app/p1/idp/permissions");
  });

  it("renders the last segment as the current page rather than a link", () => {
    renderCrumb();
    const current = screen.getByText("Dashboard");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("renders a disabled segment as a page instead of a link", () => {
    renderCrumb({ disabledHrefs: ["/app/p1/idp/permission-detail"] });
    // The disabled middle segment renders as a BreadcrumbPage span, not an anchor.
    const perms = screen.getByText("Permissions");
    expect(perms.tagName).toBe("SPAN");
    expect(perms.getAttribute("aria-disabled")).toBe("true");
  });

  it("slices the trail when a breadcrumbIndex is supplied", () => {
    renderCrumb({ breadcrumbIndex: 3 });
    // breadcrumbIndex 3 keeps segments from index 2 onward.
    expect(screen.queryByRole("link", { name: "Roles" })).toBeNull();
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });
});
