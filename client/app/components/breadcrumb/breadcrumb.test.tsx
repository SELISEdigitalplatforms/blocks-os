import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pathname: "/app/p1/iam/role-detail",
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
      { href: "/app/p1/iam/role-detail", label: "Role default" },
      { href: "/app/p1/iam/permission-detail", label: "Permission default" },
      { href: "/app/p1/dashboard", label: "Dashboard" },
    ];
  });

  it("applies custom titles and rewrites detail links to their list route", () => {
    renderCrumb();
    // Custom titles from BREADCRUMB_CUSTOM_TITLES replace the defaults.
    const rolesLink = screen.getByRole("link", { name: "Roles" }) as HTMLAnchorElement;
    expect(rolesLink.getAttribute("href")).toContain("/app/p1/iam/roles");
    const permsLink = screen.getByRole("link", { name: "Permissions" }) as HTMLAnchorElement;
    expect(permsLink.getAttribute("href")).toContain("/app/p1/iam/permissions");
  });

  it("renders the last segment as the current page rather than a link", () => {
    renderCrumb();
    const current = screen.getByText("Dashboard");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("uses the standard 14px (text-sm) size on the list and current segment, current segment is font-medium", () => {
    renderCrumb();
    const list = document.querySelector("ol");
    expect(list?.className).toContain("text-sm");
    expect(list?.className).not.toContain("text-base");
    expect(list?.className).not.toContain("text-lg");
    const current = screen.getByText("Dashboard");
    expect(current.className).toContain("font-medium");
    expect(current.className).not.toContain("text-low-emphasis");
  });

  it("renders non-current links in muted-foreground with hover/focus styling", () => {
    renderCrumb();
    const rolesLink = screen.getByRole("link", { name: "Roles" });
    expect(rolesLink.className).toContain("text-muted-foreground");
    expect(rolesLink.className).toContain("hover:text-foreground");
    expect(rolesLink.className).toContain("focus-visible:ring-ring");
  });

  it("renders the separator chevron at size-4 (16px)", () => {
    renderCrumb();
    const separators = document.querySelectorAll('[role="presentation"]');
    expect(separators.length).toBeGreaterThan(0);
    separators.forEach((sep) => {
      expect(sep.className).toContain("[&>svg]:size-4");
    });
  });

  it("keeps the breadcrumb hidden on small viewports (hidden md:flex)", () => {
    renderCrumb();
    const nav = screen.getByLabelText("breadcrumb");
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("md:flex");
  });

  it("renders a disabled segment as a page instead of a link", () => {
    renderCrumb({ disabledHrefs: ["/app/p1/iam/permission-detail"] });
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
