import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

// The tooltip ui-kit re-exports blocks-kit, which touches process.env via
// motion-utils at module load; a passthrough keeps the tree renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { DesktopMenuItem } from "./desktop-menu-item";
import type { Menu } from "@/models/menu-models";

type MenuItem = Extract<Menu, { type: "menu" }>;

const leaf: MenuItem = {
  type: "menu",
  id: "dash",
  name: "Dashboard",
  path: "/app/dashboard",
  icon: Home,
  badge: "new",
};

const parent: MenuItem = {
  type: "menu",
  id: "idp",
  name: "Identity",
  path: "/app/idp",
  icon: Home,
  children: [
    { type: "menu", id: "roles", name: "Roles", path: "/app/idp/roles" },
    { type: "menu", id: "off", name: "Disabled", path: "/app/idp/off", disabled: true },
  ],
};

const renderAt = (ui: React.ReactElement, path = "/") =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe("DesktopMenuItem", () => {
  it("renders a leaf menu link with its badge when the sidebar is open", () => {
    renderAt(<DesktopMenuItem menu={leaf} isSidebarOpen />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("new")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/app/dashboard");
  });

  it("hides the label text when the sidebar is collapsed", () => {
    renderAt(<DesktopMenuItem menu={leaf} isSidebarOpen={false} />);
    // Collapsed leaf still renders a link but the label span is not shown.
    expect(screen.queryByText("new")).toBeNull();
  });

  it("marks the leaf active when the current path matches", () => {
    renderAt(<DesktopMenuItem menu={leaf} isSidebarOpen />, "/app/dashboard/anything");
    const link = screen.getByRole("link");
    expect(link.closest("div")?.className).toContain("text-primary");
  });

  it("renders a parent with only its enabled children", () => {
    renderAt(<DesktopMenuItem menu={parent} isSidebarOpen />);
    expect(screen.getByText("Identity")).toBeTruthy();
    expect(screen.getByText("Roles")).toBeTruthy();
    // The disabled child is filtered out of the flyout list.
    expect(screen.queryByText("Disabled")).toBeNull();
  });

  it("treats role-detail as active for the roles child path", () => {
    renderAt(<DesktopMenuItem menu={parent} isSidebarOpen />, "/app/idp/role-detail/1");
    expect(screen.getByText("Identity")).toBeTruthy();
  });
});
