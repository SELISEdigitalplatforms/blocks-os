import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  selectedProject: { itemId: "p-1", name: "Acme" } as { itemId: string; name: string } | null,
  selectedTenantGroup: "tg-1" as string | null,
  setSelectedProject: vi.fn(),
  projectsData: undefined as unknown,
  isLoading: false,
  updateTenantGroup: vi.fn(),
  isUpdating: false,
  toast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({
    selectedProject: h.selectedProject,
    selectedTenantGroup: h.selectedTenantGroup,
    setSelectedProject: h.setSelectedProject,
  }),
}));
vi.mock("@/hooks/use-project-access", () => ({
  useProjectPermissions: () => ({ isOwner: true, can: () => true, menus: [] }),
}));
vi.mock("@/hooks/use-project", () => ({
  useGetProjects: () => ({ data: h.projectsData, isLoading: h.isLoading }),
  useUpdateTenantGroup: () => ({ mutateAsync: h.updateTenantGroup, isPending: h.isUpdating }),
  useGetEnvRepositories: () => ({ data: { data: [] }, isLoading: false, isFetching: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));

import { SettingsPage } from "./settings";

const projects = () => [
  {
    projects: [
      {
        itemId: "p-1",
        name: "Acme",
        environment: "prod",
        isDisabled: false,
        createdDate: "2024-01-01T00:00:00Z",
        tenantId: "tenant-prod-0001",
        applications: [{ domain: "https://acme.example.com" }],
      },
      {
        itemId: "p-2",
        name: "Acme Dev",
        environment: "dev",
        isDisabled: false,
        createdDate: "2024-01-01T00:00:00Z",
        tenantId: "tenant-dev-0001",
        applications: [],
      },
    ],
  },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedProject = { itemId: "p-1", name: "Acme" };
    h.selectedTenantGroup = "tg-1";
    h.projectsData = projects();
    h.isLoading = false;
    h.isUpdating = false;
    h.updateTenantGroup.mockResolvedValue({ errors: null });
  });

  it("renders the loading skeleton while projects load", () => {
    h.isLoading = true;
    const { container } = render(<SettingsPage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("Project Settings")).toBeNull();
  });

  it("renders general project information", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Project Settings")).toBeTruthy();
    expect(screen.getByText("General Information")).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getAllByText("Environments").length).toBeGreaterThan(0);
  });

  it("saves an edited project name and shows a success toast", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /Edit project name/i }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Project name");
    await user.clear(input);
    await user.type(input, "Acme Corp");
    await user.click(within(dialog).getByRole("button", { name: "Update" }));

    await waitFor(() =>
      expect(h.updateTenantGroup).toHaveBeenCalledWith({
        name: "Acme Corp",
        tenantGroupId: "tg-1",
      }),
    );
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Project name updated successfully" }),
    );
  });

  it("blocks saving when the name is too short", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /Edit project name/i }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Project name");
    await user.clear(input);
    await user.type(input, "ab");

    expect(await screen.findByText("Project name must be at least 3 characters")).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Update" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("shows an error toast when the update returns errors", async () => {
    const user = userEvent.setup();
    h.updateTenantGroup.mockResolvedValue({ errors: { name: "taken" } });
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /Edit project name/i }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Project name");
    await user.clear(input);
    await user.type(input, "Acme Corp");
    await user.click(within(dialog).getByRole("button", { name: "Update" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "Failed to update project name" }),
      ),
    );
  });

  it("shows an error toast when the update throws", async () => {
    const user = userEvent.setup();
    h.updateTenantGroup.mockRejectedValue(new Error("network"));
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /Edit project name/i }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Project name");
    await user.clear(input);
    await user.type(input, "Acme Corp");
    await user.click(within(dialog).getByRole("button", { name: "Update" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "An unexpected error occurred" }),
      ),
    );
  });
});
