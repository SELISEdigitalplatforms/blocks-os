import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  userData: undefined as unknown,
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.userData }),
  useUpdateUser: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { RemoveMembership } from "./remove-membership";
import type { IMembership } from "@blocks-idp/iam/models/user";

const membership = { organizationId: "org-2" } as unknown as IMembership;

const setup = (overrides: Partial<React.ComponentProps<typeof RemoveMembership>> = {}) => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  render(
    <RemoveMembership
      open
      onOpenChange={onOpenChange}
      membership={membership}
      organizationName="Acme"
      userId="user-1"
      projectKey="tenant-1"
      onSuccess={onSuccess}
      {...overrides}
    />,
  );
  return { onOpenChange, onSuccess };
};

describe("RemoveMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.userData = {
      data: {
        organizationIds: ["org-1", "org-2"],
        roles: { "org-1": ["admin"], "org-2": ["viewer"] },
        permissions: { "org-1": ["read"], "org-2": ["write"] },
      },
    };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the confirmation copy with the organization name", () => {
    setup();
    expect(screen.getByText("Remove organization membership")).toBeTruthy();
    expect(screen.getByText(/Acme/)).toBeTruthy();
  });

  it("removes the org and its roles/permissions then reports success", async () => {
    const { onOpenChange, onSuccess } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.organizationIds).toEqual(["org-1"]);
    // Roles/permissions for the removed org are dropped, keeping org-1's.
    expect(payload.roles).toEqual(["admin"]);
    expect(payload.permissions).toEqual(["read"]);
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows an error toast when the update is not successful", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "nope" } });
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("surfaces thrown errors with an error toast", async () => {
    h.mutateAsync.mockRejectedValueOnce(new Error("boom"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }));
  });

  it("closes without mutating when cancel is clicked", () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
