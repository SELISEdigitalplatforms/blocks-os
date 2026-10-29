import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => import("@/test-utils/__mocks__/grant-scope.mock"));
vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));
vi.mock("@blocks-idp/iam/hooks/use-user-manageability", () => import("@/test-utils/__mocks__/user-manageability.mock"));

const h = vi.hoisted(() => ({
  userById: {} as Record<string, unknown>,
  me: {} as Record<string, unknown>,
  update: vi.fn(),
  isPending: false,
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => h.userById,
  useGetMe: () => h.me,
  useUpdateUser: () => ({ isPending: h.isPending, mutateAsync: h.update }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (a: unknown) => h.showError(a),
  showSuccessToast: (a: unknown) => h.showSuccess(a),
}));

import { UpdateUser } from "./update-user";
import { manageability, resetManageability } from "@/test-utils/__mocks__/user-manageability.mock";


beforeEach(() => {
  vi.clearAllMocks();
  resetManageability();
  h.isPending = false;
  h.userById = {
    data: { data: { firstName: "Ada", lastName: "Lovelace" } },
    isLoading: false,
    isFetching: false,
  };
  h.me = { data: { data: { firstName: "Ada", lastName: "Lovelace" } } };
});

describe("UpdateUser", () => {
  it("opens the edit dialog prefilled from the user record", async () => {
    render(<UpdateUser id="u1" projectKey="p1" />);
    fireEvent.click(screen.getByText("Edit User"));
    await waitFor(() => expect(screen.getByPlaceholderText("Enter first name")).toBeTruthy());
    expect((screen.getByPlaceholderText("Enter first name") as HTMLInputElement).value).toBe("Ada");
  });

  it("saves updated names and shows a success toast", async () => {
    h.update.mockResolvedValue({ isSuccess: true });
    render(<UpdateUser id="u1" projectKey="p1" />);
    fireEvent.click(screen.getByText("Edit User"));
    await waitFor(() => expect(screen.getByPlaceholderText("Enter first name")).toBeTruthy());
    fireEvent.input(screen.getByPlaceholderText("Enter first name"), { target: { value: "Grace" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "u1", firstName: "Grace" }),
      ),
    );
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalled());
  });

  it("shows an error toast when the update fails", async () => {
    h.update.mockResolvedValue({ isSuccess: false, errors: "nope" });
    render(<UpdateUser id="u1" projectKey="p1" />);
    fireEvent.click(screen.getByText("Edit User"));
    await waitFor(() => expect(screen.getByPlaceholderText("Enter first name")).toBeTruthy());
    fireEvent.input(screen.getByPlaceholderText("Enter first name"), { target: { value: "Grace" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith({ errors: "nope" }));
  });

  it("is disabled, with the reason, for a user the caller cannot manage", () => {
    manageability.blockedIds.add("u1");
    h.userById = {
      data: { data: { itemId: "u1", firstName: "Ada", lastName: "Lovelace" } },
      isLoading: false,
      isFetching: false,
    };
    render(<UpdateUser id="u1" projectKey="p1" iconOnly />);
    expect((screen.getByRole("button", { name: "Edit user" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByTestId("disabled-reason")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Enter first name")).toBeNull();
  });
});
