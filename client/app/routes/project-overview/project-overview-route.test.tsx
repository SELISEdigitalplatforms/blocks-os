import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectOverviewRoute } from "./project-overview-route";

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
  menuIdsPassedToLayout: [] as string[],
  params: { tenantGroupId: "grp-1" } as Record<string, string | undefined>,
  user: { sub: "owner-1" } as { sub?: string } | null,
  projects: {
    data: [
      { projects: [{ itemId: "p-1", tenantGroupId: "grp-1", createdBy: "owner-1" }] },
    ] as unknown,
    isLoading: false,
    isError: false,
  },
  access: {
    isLoading: false,
    isOwner: true,
    hasAnyAccess: true,
    menuIds: ["environments", "people", "repositories", "settings"],
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
// The gate is now "owner, or granted at least one menu", read from the project-access
// endpoint rather than inferred from the projects response.
vi.mock("@/hooks/use-project-access", () => ({
  useProjectPermissions: () => h.access,
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
  SidebarMenuDesktop: () => <div>sidebar menu</div>,
  DashboardHeader: () => <div>dashboard header</div>,
}));

vi.mock("@/layouts/project-overview/project-overview-layout", () => ({
  ProjectOverviewLayout: ({
    children,
    navigationMenus,
  }: {
    children: React.ReactNode;
    navigationMenus: { id: string }[];
  }) => {
    // Captured so a test can assert which menus survived the grant filter.
    h.menuIdsPassedToLayout = (navigationMenus ?? []).map((menu) => menu.id);
    return (
      <div>
        <span>overview layout</span>
        {children}
      </div>
    );
  },
}));

// A cut-down copy of the real menu shape: one menu outside the project subtree, which the
// grant filter must never touch, and the four inside it that it filters.
const MENUS = [
  { type: "menu", id: "overview-project", name: "Overview", path: "/app/dashboard" },
  { type: "separator", id: "separator-overview" },
  { type: "menu", id: "environments", name: "Environments", path: "/app/project/environments" },
  { type: "menu", id: "people", name: "People", path: "/app/project/people" },
  { type: "menu", id: "repositories", name: "Repositories", path: "/app/project/repositories" },
  { type: "menu", id: "settings", name: "Project Settings", path: "/app/project/settings" },
] as never;

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={["/app/project/grp-1/environments"]}>
      <Routes>
        <Route
          path="/app/project/:tenantGroupId/*"
          element={
            <ProjectOverviewRoute
              navigationMenus={MENUS}
              redirectPaths={{ "/app/iam/*": "/app/iam" }}
            />
          }
        >
          <Route path="environments" element={<div>overview child</div>} />
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
      data: [{ projects: [{ itemId: "p-1", tenantGroupId: "grp-1", createdBy: "owner-1" }] }],
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

  it("redirects to the console when the viewer has no access at all", () => {
    // Not an owner and holding no granted menu: an empty sidebar reads as a broken page
    // rather than as a permissions boundary, so the shell is not opened at all.
    h.access = { isLoading: false, isOwner: false, hasAnyAccess: false, menuIds: [] };
    renderRoute();
    expect(screen.getByText("console page")).toBeTruthy();
  });

  it("redirects a contributor away from a menu they were not granted", () => {
    // The sidebar link is hidden, but a bookmark or typed URL is not, and every request the
    // page makes would be refused. Send them to a page they can actually use.
    h.access = { isLoading: false, isOwner: false, hasAnyAccess: true, menuIds: ["people"] };
    render(
      <MemoryRouter initialEntries={["/app/project/grp-1/overview"]}>
        <Routes>
          <Route
            path="/app/project/:tenantGroupId/*"
            element={
              <ProjectOverviewRoute
                navigationMenus={MENUS}
                redirectPaths={{ "/app/iam/*": "/app/iam" }}
              />
            }
          >
            <Route path="overview" element={<div>overview child</div>} />
          </Route>
          <Route path="/app/project/grp-1/people" element={<div>people page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("people page")).toBeTruthy();
  });

  it("lets a contributor in and keeps only the menus they were granted", () => {
    h.access = {
      isLoading: false,
      isOwner: false,
      hasAnyAccess: true,
      menuIds: ["environments"],
    };
    renderRoute();
    expect(screen.getByText("overview layout")).toBeTruthy();
    expect(h.menuIdsPassedToLayout).toEqual(
      expect.arrayContaining(["overview-project", "environments"]),
    );
    expect(h.menuIdsPassedToLayout).not.toContain("people");
    expect(h.menuIdsPassedToLayout).not.toContain("settings");
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
