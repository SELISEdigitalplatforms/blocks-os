import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  userData: undefined as unknown,
  isLoading: false,
  isFetching: false,
  isPending: false,
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  selectedSetter: undefined as ((n: number) => void) | undefined,
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useConfigureUserMFA: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.userData, isLoading: h.isLoading, isFetching: h.isFetching }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
vi.mock("./user-mfa-methods-list", () => ({
  UserMFAMethodList: ({ setSelected }: { setSelected: (n: number) => void }) => {
    h.selectedSetter = setSelected;
    return <button data-testid="pick" onClick={() => setSelected(2)}>pick</button>;
  },
}));
vi.mock("../user-mfa", async () => {
  const react = await import("react");
  return {
    userMfaContext: react.createContext({ projectKey: "tenant-1", userId: "user-1" }),
  };
});

import { UserMFAConfigManage } from "./user-mfa-config-manage";

describe("UserMFAConfigManage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.userData = { data: { userMfaType: 1 } };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the method list", () => {
    render(<UserMFAConfigManage />);
    expect(screen.getByTestId("pick")).toBeTruthy();
  });

  it("hides Save until the selected type differs from the current one", () => {
    render(<UserMFAConfigManage />);
    // Current type is 1; nothing changed yet so no Save button.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    fireEvent.click(screen.getByTestId("pick"));
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("saves the new configuration and reports success", async () => {
    render(<UserMFAConfigManage />);
    fireEvent.click(screen.getByTestId("pick"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      mfaEnabled: true,
      userId: "user-1",
      userMfaType: 2,
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when saving fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    render(<UserMFAConfigManage />);
    fireEvent.click(screen.getByTestId("pick"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
