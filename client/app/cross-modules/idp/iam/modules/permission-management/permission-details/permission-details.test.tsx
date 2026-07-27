import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  permissionData: undefined as unknown,
  isLoading: false,
  isPending: false,
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  formProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissionById: () => ({ data: h.permissionData, isLoading: h.isLoading }),
  useUpdatePermission: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <nav /> }));
// Isolate the form; expose its onSave so submit paths can be driven.
vi.mock("../permission-form", () => ({
  PermissionForm: (props: Record<string, unknown>) => {
    h.formProps = props;
    return (
      <button onClick={() => (props.onSave as (d: unknown) => void)({ type: "2", dependentPermissions: ["dp"] })}>
        save-form
      </button>
    );
  },
}));

import { PermissionDetails } from "./permission-details";

describe("PermissionDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isPending = false;
    h.permissionData = { data: { name: "Read", isBuiltIn: false, type: 2, resource: "r" } };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the skeleton while loading", () => {
    h.isLoading = true;
    const { container } = render(<PermissionDetails id="p1" />);
    expect(container.querySelector(".grid")).toBeTruthy();
    expect(screen.queryByText("save-form")).toBeNull();
  });

  it("shows the Custom badge for a non built-in permission", () => {
    render(<PermissionDetails id="p1" />);
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText("save-form")).toBeTruthy();
  });

  it("shows the Built In badge and passes built-in flags to the form", () => {
    h.permissionData = { data: { name: "Sys", isBuiltIn: true, type: 1, resource: "r" } };
    render(<PermissionDetails id="p1" />);
    expect(screen.getByText("Built In")).toBeTruthy();
    expect(h.formProps?.isBuiltIn).toBe(true);
  });

  it("updates the permission and reports success on save", async () => {
    render(<PermissionDetails id="p1" />);
    fireEvent.click(screen.getByText("save-form"));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ type: 2, itemId: "p1" });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("does not mutate when the permission is built-in", async () => {
    h.permissionData = { data: { name: "Sys", isBuiltIn: true, type: 1, resource: "r" } };
    render(<PermissionDetails id="p1" />);
    fireEvent.click(screen.getByText("save-form"));
    await Promise.resolve();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows an error toast when the update reports failure", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    render(<PermissionDetails id="p1" />);
    fireEvent.click(screen.getByText("save-form"));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
