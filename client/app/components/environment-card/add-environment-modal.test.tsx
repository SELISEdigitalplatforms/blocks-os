import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createProject: vi.fn(),
  isPending: false,
}));

vi.mock("@/hooks/use-project", () => ({
  useCreateProject: () => ({ mutateAsync: h.createProject, isPending: h.isPending }),
}));

import { AddEnvironmentModal } from "./add-environment-modal";

describe("AddEnvironmentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.createProject.mockResolvedValue({ isSuccess: true });
  });

  it("hides environments that are already provisioned", () => {
    render(<AddEnvironmentModal preSelectedEnvironments={["dev"]} tenantGroupId="tg-1" />);
    expect(screen.queryByText("Development")).toBeNull();
    expect(screen.getByText("Testing")).toBeTruthy();
  });

  // Checkboxes render in the same order as environmentOptions: dev(0), test(1), stg(2)...
  const checkbox = (index: number) => screen.getAllByRole("checkbox")[index];

  it("keeps the Add button disabled until an environment is chosen", async () => {
    const user = userEvent.setup();
    render(<AddEnvironmentModal tenantGroupId="tg-1" onClose={vi.fn()} />);
    const add = screen.getByRole("button", { name: "Add" });
    expect(add.hasAttribute("disabled")).toBe(true);
    await user.click(checkbox(1));
    await waitFor(() => expect(add.hasAttribute("disabled")).toBe(false));
  });

  it("creates a project with sorted contexts and closes on save", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AddEnvironmentModal tenantGroupId="tg-1" projectName="My Project" onClose={onClose} />,
    );
    // Select in reverse index order to exercise the sort: staging(2) then development(0).
    await user.click(checkbox(2));
    await user.click(checkbox(0));
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(h.createProject).toHaveBeenCalledTimes(1));
    const payload = h.createProject.mock.calls[0][0];
    expect(payload.name).toBe("My Project");
    expect(payload.tenantGroupId).toBe("tg-1");
    expect(payload.applicationContexts.map((c: { environment: string }) => c.environment)).toEqual([
      "dev",
      "stg",
    ]);
    expect(onClose).toHaveBeenCalledWith(["dev", "stg"]);
  });

  it("does not create a project when no tenant group is present", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddEnvironmentModal onClose={onClose} />);
    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(h.createProject).not.toHaveBeenCalled();
  });

  it("closes with an empty selection from the cancel button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddEnvironmentModal tenantGroupId="tg-1" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledWith([]);
    expect(h.createProject).not.toHaveBeenCalled();
  });
});
