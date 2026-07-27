import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useSaveOrganization: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { UpdateOrganization } from "./update-organization";
import type { IOrganization } from "@blocks-idp/iam/models/organization";

const organization = { itemId: "org-1", name: "Acme", isEnable: true } as IOrganization;

const renderUpdate = () =>
  render(
    <Dialog open>
      <UpdateOrganization organization={organization} isOpen />
    </Dialog>,
  );

describe("UpdateOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the current organization name", () => {
    renderUpdate();
    expect(screen.getByText("Rename Organization")).toBeTruthy();
    expect((screen.getByPlaceholderText("Enter organization name") as HTMLInputElement).value).toBe(
      "Acme",
    );
  });

  it("keeps Save disabled until the name changes", () => {
    renderUpdate();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Enter organization name"), {
      target: { value: "Acme Corp" },
    });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("renames the organization and reports success", async () => {
    renderUpdate();
    fireEvent.change(screen.getByPlaceholderText("Enter organization name"), {
      target: { value: "Acme Corp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      projectKey: "tenant-1",
      name: "Acme Corp",
      itemId: "org-1",
      isEnable: true,
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the rename response fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    renderUpdate();
    fireEvent.change(screen.getByPlaceholderText("Enter organization name"), {
      target: { value: "Acme Corp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
