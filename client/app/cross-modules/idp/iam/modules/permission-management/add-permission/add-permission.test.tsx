import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => import("@/test-utils/__mocks__/grant-scope.mock"));

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  isPending: false,
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  formProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useAddPermission: () => ({ isPending: h.isPending, mutateAsync: h.mutateAsync }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <nav /> }));
vi.mock("../permission-form", () => ({
  PermissionForm: (props: Record<string, unknown>) => {
    h.formProps = props;
    return (
      <div>
        <button
          onClick={() =>
            (props.onSave as (d: unknown) => void)({
              type: "2",
              permissionSeverity: 1,
              dependentPermissions: ["dp"],
            })
          }
        >
          save-valid
        </button>
        <button
          onClick={() =>
            (props.onSave as (d: unknown) => void)({
              type: "1",
              permissionSeverity: undefined,
              dependentPermissions: [],
            })
          }
        >
          save-missing-severity
        </button>
      </div>
    );
  },
}));

import { AddPermission } from "./add-permission";
import { grant, resetGrant } from "@/test-utils/__mocks__/grant-scope.mock";


describe("AddPermission", () => {
  beforeEach(() => {
    resetGrant();
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the new permission heading and form", () => {
    render(<AddPermission />);
    expect(screen.getByText("New Permission")).toBeTruthy();
    expect(screen.getByText("save-valid")).toBeTruthy();
  });

  it("rejects submission when severity is missing", async () => {
    render(<AddPermission />);
    fireEvent.click(screen.getByText("save-missing-severity"));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Severity is required" }),
    );
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("creates the permission then navigates and reports success", async () => {
    render(<AddPermission />);
    fireEvent.click(screen.getByText("save-valid"));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      type: 2,
      isBuiltIn: false,
      dependentPermissions: ["dp"],
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledWith("/app/proj/iam/permissions");
  });

  it("shows an error toast when the create response fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    render(<AddPermission />);
    fireEvent.click(screen.getByText("save-valid"));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("is read-only for a caller who is not the system user, and never saves", () => {
    grant.systemOnlyReason = "Only the system user can change this.";
    render(<AddPermission />);
    expect(h.formProps?.readOnlyReason).toBe("Only the system user can change this.");
    fireEvent.click(screen.getByText("save-valid"));
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("leaves the form editable for the system user", () => {
    render(<AddPermission />);
    expect(h.formProps?.readOnlyReason).toBeUndefined();
  });
});
