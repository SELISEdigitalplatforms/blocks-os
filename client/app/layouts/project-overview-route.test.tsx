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
  tenantGroupId: "grp-1" as string,
  projects: {
    data: [{ itemId: "p-1" }] as unknown,
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useSyncTenantGroupFromRoute: () => h.tenantGroupId,
  useGetProjects: () => h.projects,
}));

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
    h.tenantGroupId = "grp-1";
    h.projects = { data: [{ itemId: "p-1" }], isLoading: false, isError: false };
  });

  it("redirects to the console when no tenant-group id is present", () => {
    h.tenantGroupId = "";
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
