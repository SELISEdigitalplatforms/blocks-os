import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  navigate: vi.fn(),
  selectedProject: null as { tenantId: string } | null,
  selectedTenantGroup: "grp-1" as string | null,
  environmentList: [{ itemId: "p-1" }] as unknown[] | undefined,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({
    selectedProject: h.selectedProject,
    selectedTenantGroup: h.selectedTenantGroup,
  }),
}));

vi.mock("@/hooks/use-project", () => ({
  useGetProjects: () => ({ data: h.environmentList }),
}));

import { ProjectGuard } from "./project-guard";

const renderGuard = () =>
  render(
    <MemoryRouter>
      <ProjectGuard>
        <div>project scoped content</div>
      </ProjectGuard>
    </MemoryRouter>,
  );

describe("ProjectGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedProject = null;
    h.selectedTenantGroup = "grp-1";
    h.environmentList = [{ itemId: "p-1" }];
  });

  it("renders nothing and redirects to /console without a selected project", async () => {
    h.selectedProject = null;
    renderGuard();
    expect(screen.queryByText("project scoped content")).toBeNull();
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith("/console", { replace: true }),
    );
  });

  it("renders children when a project is selected and environments exist", async () => {
    h.selectedProject = { tenantId: "t-1" };
    h.environmentList = [{ itemId: "p-1" }];
    renderGuard();
    expect(screen.getByText("project scoped content")).toBeTruthy();
    await waitFor(() => expect(h.navigate).not.toHaveBeenCalled());
  });

  it("redirects to /console when the environment list is empty", async () => {
    h.selectedProject = { tenantId: "t-1" };
    h.environmentList = [];
    renderGuard();
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith("/console", { replace: true }),
    );
  });
});
