import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSelectedProject: vi.fn(),
  startImpersonation: vi.fn(),
  restoreProject: vi.fn(),
  projectStatus: undefined as boolean | undefined,
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ setSelectedProject: h.setSelectedProject }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useStartImpersonation: () => ({ mutateAsync: h.startImpersonation }),
}));
vi.mock("@/hooks/use-project", () => ({
  useGetProjectStatus: () => ({ data: h.projectStatus }),
  useRestoreProject: () => ({ mutateAsync: h.restoreProject, isPending: false }),
}));
// The tooltip ui-kit re-exports blocks-kit, which touches process.env via
// motion-utils at module load; a passthrough keeps the tree renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { EnvironmentCard } from "./environment-card";
import type { IProject } from "@/models/project.model";

const project = {
  itemId: "proj-1",
  tenantId: "tenant-abc",
  environment: "dev",
  name: "Test",
} as unknown as IProject;

describe("EnvironmentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.startImpersonation.mockResolvedValue(undefined);
    h.restoreProject.mockResolvedValue({ isSuccess: true });
    h.projectStatus = undefined;
  });

  it("renders the environment label and the tenant id", () => {
    render(<EnvironmentCard project={project} />);
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText("tenant-abc")).toBeTruthy();
    expect(screen.getByText("X-Blocks-Key:")).toBeTruthy();
  });

  it("does not show a setup indicator while the status is unknown or complete", () => {
    h.projectStatus = undefined;
    const { rerender } = render(<EnvironmentCard project={project} />);
    expect(screen.queryByLabelText("Setup pending")).toBeNull();
    expect(screen.queryByLabelText("Restore environment")).toBeNull();

    h.projectStatus = true;
    rerender(<EnvironmentCard project={project} />);
    expect(screen.queryByLabelText("Setup pending")).toBeNull();
    expect(screen.queryByLabelText("Restore environment")).toBeNull();
  });

  it("shows a compact setup indicator and restore action when setup is pending", () => {
    h.projectStatus = false;
    render(<EnvironmentCard project={project} />);
    expect(screen.getByLabelText("Setup pending")).toBeTruthy();
    expect(screen.getByLabelText("Restore environment")).toBeTruthy();
  });

  it("impersonates, selects the project and navigates on click when no migration", async () => {
    render(<EnvironmentCard project={project} />);
    fireEvent.click(screen.getByText("Development"));
    await waitFor(() =>
      expect(h.startImpersonation).toHaveBeenCalledWith({ targeted_tenant_id: "tenant-abc" }),
    );
    expect(h.setSelectedProject).toHaveBeenCalledWith(project);
    expect(h.navigate).toHaveBeenCalledWith("/app/proj-1/dashboard");
  });

  it("logs and does not navigate when impersonation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    h.startImpersonation.mockRejectedValueOnce(new Error("boom"));
    render(<EnvironmentCard project={project} />);
    fireEvent.click(screen.getByText("Development"));
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(h.navigate).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("shows a confirmation before switching while a migration is ongoing", async () => {
    render(<EnvironmentCard project={project} isMigrationOngoing />);
    fireEvent.click(screen.getByText("Development"));
    // Migration path opens the confirmation instead of switching immediately.
    expect(await screen.findByText("Environment Migration in Progress")).toBeTruthy();
    expect(h.startImpersonation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Continue Anyway"));
    await waitFor(() => expect(h.startImpersonation).toHaveBeenCalled());
  });
});
