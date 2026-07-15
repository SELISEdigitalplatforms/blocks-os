import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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

// Guards and structural chrome are covered by their own suites; here we only
// verify the layout wires an <Outlet /> through its provider stack.
vi.mock("@/guards/protected-guard", () => ({
  ProtectedGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/dashboard-layout-provider", () => ({
  DashboardLayoutProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/layouts/sidebar-menu-desktop/sidebar-menu-desktop", () => ({
  SidebarMenuDesktop: () => <nav>sidebar</nav>,
}));

vi.mock("@/layouts/dashboard-header/dashboard-header", () => ({
  DashboardHeader: () => <header>header</header>,
}));

import { DashboardLayout } from "./admin-layout";

describe("admin DashboardLayout", () => {
  it("renders its chrome and routed outlet content", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<div>routed page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("sidebar")).toBeTruthy();
    expect(screen.getByText("header")).toBeTruthy();
    expect(screen.getByText("routed page")).toBeTruthy();
  });
});
