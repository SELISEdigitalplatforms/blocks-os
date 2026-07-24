import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  projects: {
    data: [{ projects: [{ itemId: "p-1", tenantGroupId: "grp-1" }] }] as unknown,
    isLoading: false,
    isError: false,
  },
  setTenantGroup: vi.fn(),
  setSelectedProject: vi.fn(),
}));

// The route param is the source of the tenant-group id (the source reads it via
// useParams). Mock only useParams so Navigate/Outlet/MemoryRouter stay real.
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => h.params };
});

vi.mock("@/hooks/use-project", () => ({
  useGetProjects: () => h.projects,
}));

// Lightweight stand-in for the shared zustand store. The source calls
// useProjectStore both bare (`const { selectedProject } = useProjectStore()`)
// and with a selector (`useProjectStore((s) => s.setTenantGroup)`), so support
// both forms. useAuthStore drives the ownership check; the current user owns the
// selected project so the layout renders for a valid tenant group.
vi.mock("@seliseblocks/blocks-kit/store", () => {
  const state = {
    selectedProject: { itemId: "p-1", createdBy: "owner-1" },
    setTenantGroup: h.setTenantGroup,
    setSelectedProject: h.setSelectedProject,
  };
  return {
    useAuthStore: () => ({ user: { sub: "owner-1" } }),
    useProjectStore: (selector?: (s: unknown) => unknown) =>
      selector ? selector(state) : state,
  };
});

vi.mock("@seliseblocks/blocks-kit/components", () => ({
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
    h.projects = {
      data: [{ projects: [{ itemId: "p-1", tenantGroupId: "grp-1" }] }],
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
    });
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
