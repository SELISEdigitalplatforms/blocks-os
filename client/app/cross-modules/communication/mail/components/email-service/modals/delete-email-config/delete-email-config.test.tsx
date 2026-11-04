import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  toast: vi.fn(),
  usage: { data: 0 } as { data?: number; isLoading?: boolean; isError?: boolean },
  usageIds: [] as string[],
}));

vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => h.toast(...a) }));
vi.mock("../../../../hooks/use-email-config", () => ({
  useDeleteEmailConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
  useGetEmailConfigUsage: (configurationId: string) => {
    h.usageIds.push(configurationId);
    return h.usage;
  },
}));

import DeleteEmailConfig from "./delete-email-config";

const renderModal = (onClose = vi.fn()) => {
  render(
    <Dialog open>
      <DeleteEmailConfig configId="cfg-1" onClose={onClose} />
    </Dialog>,
  );
  return onClose;
};

describe("DeleteEmailConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.usage = { data: 0 };
    h.usageIds = [];
  });

  it("deletes the configuration and closes on success", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    const onClose = renderModal();
    await userEvent.setup().click(screen.getByRole("button", { name: "Delete Configuration" }));
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith({ configurationId: "cfg-1" }),
    );
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a destructive toast when the request reports failure", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { x: "bad" } });
    const onClose = renderModal();
    await userEvent.setup().click(screen.getByRole("button", { name: "Delete Configuration" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a destructive toast when the request throws", async () => {
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderModal();
    await userEvent.setup().click(screen.getByRole("button", { name: "Delete Configuration" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("says how many templates use the configuration and that they fall back (C9)", () => {
    h.usage = { data: 2 };
    renderModal();
    expect(h.usageIds).toContain("cfg-1");
    expect(
      screen.getByText("Used by 2 templates; they'll use the organization default or the project default."),
    ).toBeTruthy();
  });

  it("uses the singular for one template", () => {
    h.usage = { data: 1 };
    renderModal();
    expect(
      screen.getByText("Used by 1 template; it'll use the organization default or the project default."),
    ).toBeTruthy();
  });

  it("still deletes when the usage can't be loaded (C8)", async () => {
    h.usage = { isError: true };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    renderModal();
    expect(screen.getByText("Couldn't load how many templates use this configuration.")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Delete Configuration" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledWith({ configurationId: "cfg-1" }));
  });
});
