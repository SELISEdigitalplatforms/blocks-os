import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDomain } from "@seliseblocks/genesis-os/models";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@/hooks/use-project", () => ({
  useUpdateProject: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("@seliseblocks/genesis-os/utils", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
}));
vi.mock("@/components/ui-kits/dialog/dialog", () => ({
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { DomainForm } from "./domain-form";

describe("DomainForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: true });
  });

  it("auto-fills the cookie domain and adds a new application", async () => {
    const user = userEvent.setup();
    const onAfterSubmit = vi.fn();
    render(<DomainForm onAfterSubmit={onAfterSubmit} />);

    await user.type(screen.getAllByPlaceholderText("your-domain.com")[0], "app.example.com");
    const addButton = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
    await waitFor(() => expect(addButton.disabled).toBe(false));
    await user.click(addButton);

    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 0,
          application: expect.objectContaining({
            domain: "https://app.example.com",
            cookieDomain: "example.com",
            isDomainVerified: false,
          }),
        }),
      ),
    );
    expect(h.showSuccessToast).toHaveBeenCalledTimes(1);
    expect(onAfterSubmit).toHaveBeenCalledTimes(1);
  });

  it("edits an existing application preserving verification state", async () => {
    const user = userEvent.setup();
    const application = {
      domain: "https://old.example.com",
      cookieDomain: "example.com",
      isDomainVerified: true,
    } as IDomain;
    render(<DomainForm application={application} onAfterSubmit={vi.fn()} />);

    const update = screen.getByRole("button", { name: "Update" });
    await user.click(update);

    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 1,
          applicationDomain: "https://old.example.com",
          application: expect.objectContaining({ isDomainVerified: true }),
        }),
      ),
    );
  });

  it("shows an error toast when the update is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: false, errors: "boom" });
    render(<DomainForm onAfterSubmit={vi.fn()} />);
    await user.type(screen.getAllByPlaceholderText("your-domain.com")[0], "app.example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("surfaces thrown field errors through the error toast", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockRejectedValue({ errors: "server-error" });
    render(<DomainForm onAfterSubmit={vi.fn()} />);
    await user.type(screen.getAllByPlaceholderText("your-domain.com")[0], "app.example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "server-error" }),
    );
  });
});
