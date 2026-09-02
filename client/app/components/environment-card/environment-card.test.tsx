import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isOwner: true,
  navigate: vi.fn(),
  setSelectedProject: vi.fn(),
  startImpersonation: vi.fn(),
  restoreProject: vi.fn(),
  projectStatus: undefined as boolean | undefined,
  isRestoring: false,
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ setSelectedProject: h.setSelectedProject }),
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useStartImpersonation: () => ({ mutateAsync: h.startImpersonation }),
}));
vi.mock("@/hooks/use-project-access", () => ({
  useProjectPermissions: () => ({ isOwner: h.isOwner ?? true, can: () => true, menus: [] }),
}));
vi.mock("@/hooks/use-project", () => ({
  useGetProjectStatus: () => ({ data: h.projectStatus }),
  useRestoreProject: () => ({ mutateAsync: h.restoreProject, isPending: h.isRestoring }),
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
  createdDate: "2026-03-15T17:05:00Z",
  applications: [
    { domain: "https://dcumfk.dev.seliseblocks.com" },
    { domain: "https://dev.studio-ai.com" },
  ],
} as unknown as IProject;

describe("EnvironmentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.startImpersonation.mockResolvedValue(undefined);
    h.restoreProject.mockResolvedValue({ isSuccess: true });
    h.projectStatus = undefined;
    h.isOwner = true;
    h.isRestoring = false;
  });

  it("renders the environment label and masks the key", () => {
    render(<EnvironmentCard project={project} />);
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText("X-Blocks-Key")).toBeTruthy();
    // Project Settings already masked this same value; the card printed it in full.
    expect(screen.queryByText("tenant-abc")).toBeNull();
    expect(screen.getByText("ten")).toBeTruthy();
    expect(screen.getByText("abc")).toBeTruthy();
  });

  it("hides Repair from a contributor", () => {
    // Restore re-runs the whole provisioning routine and is owner-only, absent from the grant
    // catalog. The warning still shows; the action does not.
    h.isOwner = false;
    h.projectStatus = false;
    render(<EnvironmentCard project={project} />);
    expect(screen.queryByRole("button", { name: /Repair/i })).toBeNull();
  });

  it("shows the primary domain and counts the rest", () => {
    // An environment carries a generated domain plus any custom ones.
    render(<EnvironmentCard project={project} />);
    expect(screen.getByText("dcumfk.dev.seliseblocks.com")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
  });

  it("does not show a setup indicator while the status is unknown or complete", () => {
    h.projectStatus = undefined;
    const { rerender } = render(<EnvironmentCard project={project} />);
    expect(screen.queryByLabelText("Setup pending")).toBeNull();
    expect(screen.queryByLabelText("Repair environment")).toBeNull();

    h.projectStatus = true;
    rerender(<EnvironmentCard project={project} />);
    expect(screen.queryByLabelText("Setup pending")).toBeNull();
    expect(screen.queryByLabelText("Repair environment")).toBeNull();
  });

  it("shows a compact setup indicator and repair action when setup is pending", () => {
    h.projectStatus = false;
    render(<EnvironmentCard project={project} />);
    expect(screen.getByLabelText("Setup pending")).toBeTruthy();
    expect(screen.getByLabelText("Repair environment")).toBeTruthy();
    expect(screen.getByText("Repair")).toBeTruthy();
  });

  it("does not navigate to the dashboard while setup is pending", () => {
    h.projectStatus = false;
    render(<EnvironmentCard project={project} />);
    fireEvent.click(screen.getByText("Development"));
    expect(h.startImpersonation).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
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
