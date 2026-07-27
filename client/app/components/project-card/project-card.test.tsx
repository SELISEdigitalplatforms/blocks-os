import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IProject } from "@/models/project.model";

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
  setTenantGroup: vi.fn(),
  setSelectedProject: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("@seliseblocks/blocks-kit", async () => {
  const React = await import("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    useProjectStore: () => ({
      setTenantGroup: h.setTenantGroup,
      setSelectedProject: h.setSelectedProject,
    }),
    // ui-kits/tooltip re-exports these from blocks-kit; provide passthroughs.
    Tooltip: Pass,
    TooltipTrigger: Pass,
    TooltipContent: Pass,
    TooltipProvider: Pass,
  };
});

import { ProjectCard } from "./project-card";

const proj = (over: Partial<IProject> = {}): IProject =>
  ({
    itemId: "p-1",
    name: "My Project",
    tenantGroupId: "grp-1",
    environment: "dev",
    ...over,
  }) as IProject;

const renderCard = (project: IProject, projects: IProject[]) =>
  render(
    <MemoryRouter>
      <ProjectCard project={project} projects={projects} />
    </MemoryRouter>,
  );

describe("ProjectCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the project name and a no-environments badge when empty", () => {
    renderCard(proj(), []);
    expect(screen.getByText("My Project")).toBeTruthy();
    expect(screen.getByText("No environments")).toBeTruthy();
  });

  it("configures the project group and navigates on the settings action", async () => {
    const user = userEvent.setup();
    const { container } = renderCard(proj(), []);
    // The settings action is the only (icon-only) button when there are no envs.
    await user.click(container.querySelector("button") as HTMLButtonElement);
    expect(h.setTenantGroup).toHaveBeenCalledWith("grp-1");
    expect(h.navigate).toHaveBeenCalledWith("/app/project/grp-1/environments");
  });

  it("renders an environment chip and navigates into the environment when clicked", async () => {
    const user = userEvent.setup();
    const env = proj({ itemId: "env-1", environment: "dev", tenantGroupId: "grp-9" });
    renderCard(proj(), [env]);
    await user.click(screen.getByText("Development"));
    expect(h.setTenantGroup).toHaveBeenCalledWith("grp-9");
    expect(h.setSelectedProject).toHaveBeenCalledWith(env);
    expect(h.navigate).toHaveBeenCalledWith("/app/env-1/dashboard");
  });

  it("collapses environments beyond the inline limit into an overflow popover", async () => {
    const user = userEvent.setup();
    const envs = [
      proj({ itemId: "e1", environment: "dev" }),
      proj({ itemId: "e2", environment: "staging" }),
      proj({ itemId: "e3", environment: "uat" }),
      proj({ itemId: "e4", environment: "production" }),
    ];
    renderCard(proj(), envs);
    // Only the inline limit (3) chips plus an overflow control are shown.
    expect(screen.getByText("+1 more")).toBeTruthy();
    await user.click(screen.getByText("+1 more"));
    expect(screen.getByText("All environments")).toBeTruthy();
  });
});
