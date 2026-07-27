import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const h = vi.hoisted(() => ({
  params: { tenantGroupId: "grp-1" } as Record<string, string | undefined>,
  user: { sub: "owner-1" } as { sub?: string } | null,
  projects: {
    data: [
      { projects: [{ itemId: "p-1", tenantGroupId: "grp-1", createdBy: "owner-1" }] },
    ] as unknown,
    isLoading: false,
    isError: false,
  },
  setTenantGroup: vi.fn(),
  setSelectedProject: vi.fn(),
}));

// The route param is the source of the tenant-group id (the source reads it via
// useParams). Mock only useParams so Navigate/Outlet/MemoryRouter stay real.
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useParams: () => h.params };
});

vi.mock("@/hooks/use-project", () => ({
  useGetProjects: () => h.projects,
}));

// Lightweight stand-in for the shared zustand store, supporting the selector
// call form `useProjectStore((s) => s.setTenantGroup)` the source uses.
vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ user: h.user }),
  useProjectStore: (selector: (s: unknown) => unknown) =>
    selector({
      setTenantGroup: h.setTenantGroup,
      setSelectedProject: h.setSelectedProject,
    }),
}));

vi.mock("@seliseblocks/genesis-os/components", () => ({
  AppLoadingSpinner: () => <div>loading spinner</div>,
}));

vi.mock("./project-overview-layout", () => ({
  ProjectOverviewLayout: ({ children }: { children: React.ReactNode }) => (
    <div>
      <span>overview layout</span>
      {children}
    </div>
  ),
}));

import { ProjectOverviewRoute } from "./project-overview-route";

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={["/app/project/grp-1/overview"]}>
      <Routes>
        <Route
          path="/app/project/:tenantGroupId/*"
          element={<ProjectOverviewRoute navigationMenus={[]} />}
        >
          <Route path="overview" element={<div>overview child</div>} />
        </Route>
        <Route path="/app/console" element={<div>console page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("ProjectOverviewRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.params = { tenantGroupId: "grp-1" };
    h.user = { sub: "owner-1" };
    h.projects = {
      data: [
        { projects: [{ itemId: "p-1", tenantGroupId: "grp-1", createdBy: "owner-1" }] },
      ],
      isLoading: false,
      isError: false,
    };
  });

  it("redirects to the console when no tenant-group id is present", () => {
    h.params = {};
    renderRoute();
    expect(screen.getByText("console page")).toBeTruthy();
  });

  it("shows the loading spinner while projects load", () => {
    h.projects = { data: undefined, isLoading: true, isError: false };
    renderRoute();
    expect(screen.getByText("loading spinner")).toBeTruthy();
  });

  it("renders the layout and outlet for a valid tenant group", () => {
    renderRoute();
    expect(screen.getByText("overview layout")).toBeTruthy();
    expect(screen.getByText("overview child")).toBeTruthy();
  });

  it("hydrates the store from the URL tenant-group id (deep-link/refresh)", () => {
    renderRoute();
    expect(h.setTenantGroup).toHaveBeenCalledWith("grp-1");
    expect(h.setSelectedProject).toHaveBeenCalledWith({
      itemId: "p-1",
      tenantGroupId: "grp-1",
      createdBy: "owner-1",
    });
  });

  it("lets the owner in even when the store selection is empty (console navigation)", () => {
    // The console resets the store selection and the Configure button never sets it,
    // so ownership must be resolved from the URL-scoped project, not the store.
    renderRoute();
    expect(screen.getByText("overview layout")).toBeTruthy();
  });

  it("redirects to the console when the viewer is not the project owner", () => {
    h.user = { sub: "someone-else" };
    renderRoute();
    expect(screen.getByText("console page")).toBeTruthy();
  });

  it("does not hydrate the store when the id resolves to no projects", () => {
    h.projects = { data: [], isLoading: false, isError: false };
    renderRoute();
    expect(h.setTenantGroup).not.toHaveBeenCalled();
    expect(h.setSelectedProject).not.toHaveBeenCalled();
  });

  it("redirects to the console when the tenant group resolves to no projects", () => {
    h.projects = { data: [], isLoading: false, isError: false };
    renderRoute();
    expect(screen.getByText("console page")).toBeTruthy();
  });

  it("redirects to the console when the projects query errors", () => {
    h.projects = { data: undefined, isLoading: false, isError: true };
    renderRoute();
    expect(screen.getByText("console page")).toBeTruthy();
  });
});
