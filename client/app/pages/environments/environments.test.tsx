import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  selectedTenantGroup: "tg-1" as string | null,
  useGetProjects: vi.fn(),
  useGetPeople: vi.fn(),
  useGetMigrationStatus: vi.fn(),
  useProjectPermissions: vi.fn(),
  notificationListener: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedTenantGroup: h.selectedTenantGroup }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@/hooks/use-project", () => ({
  useGetProjects: (args: unknown) => h.useGetProjects(args),
  useGetMigrationStatus: (id: string) => h.useGetMigrationStatus(id),
}));
vi.mock("@/hooks/use-people", () => ({
  useGetPeople: (args: unknown) => h.useGetPeople(args),
}));
// Standing now comes from the project-access endpoint rather than People/Gets.
vi.mock("@/hooks/use-project-access", () => ({
  useProjectPermissions: () => h.useProjectPermissions(),
}));
vi.mock("@/cross-modules/communication/hooks/use-notification-listener", () => ({
  useNotificationListener: (...args: unknown[]) => h.notificationListener(...args),
}));
vi.mock("@/components/environment-card/environment-card", () => ({
  EnvironmentCard: ({ project }: { project: { name: string } }) => (
    <div data-testid="environment-card">{project.name}</div>
  ),
}));
vi.mock("@/components/environment-card/add-environment-modal", () => ({
  AddEnvironmentModal: () => <div data-testid="add-environment-modal" />,
}));
vi.mock("@/components/environment-migration/environment-migration-wizard", () => ({
  EnvironmentMigrationWizard: () => <div data-testid="migration-wizard" />,
}));
vi.mock("@/components/project-card/loading", () => ({
  ProjectCardLoading: () => <div data-testid="project-card-loading" />,
}));

import { EnvironmentsPage, EnvironmentMigrationPage } from "./environments";

const renderPage = () =>
  render(
    <MemoryRouter>
      <EnvironmentsPage />
    </MemoryRouter>,
  );

const makeProjects = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    itemId: `p-${i}`,
    name: `Project ${i}`,
    tenantId: `tenant-${i}`,
    environment: i === 0 ? "main" : `env-${i}`,
  }));

describe("EnvironmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedTenantGroup = "tg-1";
    h.useGetProjects.mockReturnValue({
      data: [{ projects: makeProjects(2), isShared: false, nonSharedProject: [] }],
      isLoading: false,
      isFetching: false,
    });
    h.useGetPeople.mockReturnValue({ data: { isOwner: true } });
    h.useProjectPermissions.mockReturnValue({ isOwner: true, can: () => true });
    h.useGetMigrationStatus.mockReturnValue({ data: [], refetch: vi.fn() });
  });

  it("renders the loading skeleton while projects load", () => {
    h.useGetProjects.mockReturnValue({ data: undefined, isLoading: true, isFetching: false });
    renderPage();
    expect(screen.getAllByTestId("project-card-loading").length).toBeGreaterThan(0);
  });

  it("renders an environment card per project", () => {
    renderPage();
    expect(screen.getByText("Environments")).toBeTruthy();
    expect(screen.getAllByTestId("environment-card")).toHaveLength(2);
  });

  it("shows the New Environment action for an owner under the project cap", async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = screen.getByRole("button", { name: /New Environment/i });
    await user.click(btn);
    expect(await screen.findByTestId("add-environment-modal")).toBeTruthy();
  });

  it("hides the New Environment action when the viewer is not an owner", () => {
    // Creating an environment is owner-only and absent from the grant catalog, so a
    // contributor never sees it however much else they have been granted.
    h.useProjectPermissions.mockReturnValue({ isOwner: false, can: () => true });
    renderPage();
    expect(screen.queryByRole("button", { name: /New Environment/i })).toBeNull();
  });

  it("keeps a contributor without the migrate grant off the wizard page", () => {
    // /app/data-migration sits outside the project routes, so the gated button is not the
    // only way in — a bookmark reaches the wizard directly.
    h.useProjectPermissions.mockReturnValue({ isLoading: false, isOwner: false, can: () => false });
    render(
      <MemoryRouter initialEntries={["/app/data-migration"]}>
        <Routes>
          <Route path="/app/data-migration" element={<EnvironmentMigrationPage />} />
          <Route path="/app/console" element={<div>console page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("console page")).toBeTruthy();
  });

  it("hides Start Migration when the viewer has not been granted it", () => {
    h.useProjectPermissions.mockReturnValue({ isOwner: false, can: () => false });
    renderPage();
    expect(screen.queryByRole("button", { name: /Start Migration/i })).toBeNull();
  });

  it("hides the New Environment action once the project cap is reached", () => {
    h.useGetProjects.mockReturnValue({
      data: [{ projects: makeProjects(8), isShared: false, nonSharedProject: [] }],
      isLoading: false,
      isFetching: false,
    });
    renderPage();
    expect(screen.queryByRole("button", { name: /New Environment/i })).toBeNull();
  });

  it("renders shared and others sections when the group is shared", () => {
    h.useGetProjects.mockReturnValue({
      data: [
        {
          projects: makeProjects(1),
          isShared: true,
          nonSharedProject: [
            { itemId: "o-1", name: "Other Project", tenantId: "t-o", environment: "dev" },
          ],
        },
      ],
      isLoading: false,
      isFetching: false,
    });
    renderPage();
    expect(screen.getByText("Shared with you")).toBeTruthy();
    expect(screen.getByText("Others")).toBeTruthy();
    expect(screen.getByText("Other Project")).toBeTruthy();
  });

  it("registers a migration notification listener", () => {
    renderPage();
    expect(h.notificationListener).toHaveBeenCalledWith(
      "EnvironmentDataMigration",
      expect.any(Function),
    );
  });
});

describe("EnvironmentMigrationPage", () => {
  it("renders the migration wizard", () => {
    render(<EnvironmentMigrationPage />);
    expect(screen.getByTestId("migration-wizard")).toBeTruthy();
  });
});
