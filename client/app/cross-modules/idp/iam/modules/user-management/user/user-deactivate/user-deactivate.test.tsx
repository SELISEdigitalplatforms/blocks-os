import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAccountDeactivate: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (a: unknown) => h.showError(a),
  showSuccessToast: (a: unknown) => h.showSuccess(a),
}));

import { HttpError } from "@seliseblocks/genesis-os/lib";
import { UserDeactivate } from "./user-deactivate";

const FORBIDDEN = "You don't have permission to change this user's status.";
const confirmButton = () => screen.getByRole("button", { name: "Deactivate account" });

const renderDialog = (setOpen = vi.fn()) => {
  render(<UserDeactivate userId="u1" open={true} setOpen={setOpen} />);
  return setOpen;
};

const confirmAndSettle = async (setOpen = vi.fn()) => {
  renderDialog(setOpen);
  fireEvent.click(confirmButton());
  await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
});

describe("UserDeactivate", () => {
  it("asks to confirm with the sign-out warning and no reason field", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Deactivate account?" })).toBeTruthy();
    expect(
      screen.getByText(
        "This user will be signed out of every session immediately and can't sign in until the account is activated again.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(confirmButton().className).toContain("bg-destructive");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("sends exactly the user id, shows the success toast and closes", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true, errors: null });
    const setOpen = vi.fn();
    await confirmAndSettle(setOpen);
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.mutateAsync).toHaveBeenCalledWith({ userId: "u1" });
    expect(h.showSuccess).toHaveBeenCalledWith({
      description: "User has been deactivated successfully.",
    });
    expect(h.showError).not.toHaveBeenCalled();
  });

  it("sends one request when confirm is clicked again before the first settles", async () => {
    let settle: (value: unknown) => void = () => undefined;
    h.mutateAsync.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const setOpen = renderDialog();
    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    settle({ isSuccess: true });
    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("locks both buttons, shows a spinner and cannot be dismissed while pending", () => {
    h.isPending = true;
    const setOpen = renderDialog();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(confirmButton().querySelector(".animate-spin")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("shows the server's messages for a 400 and closes", async () => {
    const errors = { user_not_found: "No user found with id u1" };
    h.mutateAsync.mockRejectedValue(new HttpError(400, { errors }));
    await confirmAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors });
  });

  it.each([
    ["an empty body", {}],
    ["the access-grant refusal", { Access_Grant_Not_Allowed: "Access_Grant_Not_Allowed" }],
  ])("shows the forbidden message for a 403 with %s", async (_label, errors) => {
    h.mutateAsync.mockRejectedValue(new HttpError(403, { errors }));
    await confirmAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors: FORBIDDEN });
  });

  it("shows the forbidden message for a grant refusal reported without a status", async () => {
    h.mutateAsync.mockResolvedValue({
      isSuccess: false,
      errors: { Access_Grant_Not_Allowed: "Access_Grant_Not_Allowed" },
    });
    await confirmAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors: FORBIDDEN });
  });

  // The HTTP client turns a request that got no response into status 500 carrying the Error.
  it.each([
    ["no response", new HttpError(500, { errors: new TypeError("Failed to fetch") as never })],
    ["an error without errors", new Error("boom")],
    ["an empty errors object", new HttpError(500, { errors: {} })],
    [
      "a server error with a problem details body",
      new HttpError(500, {
        errors: { type: "https://tools.ietf.org/html/rfc9110", title: "Error", traceId: "00-1" },
      }),
    ],
    [
      "a client error whose body has no errors",
      new HttpError(400, { errors: { isSuccess: "false", itemId: "u1" } as never }),
    ],
  ])("shows the generic message for %s", async (_label, rejection) => {
    h.mutateAsync.mockRejectedValue(rejection);
    await confirmAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors: "Something went wrong" });
  });

  it("shows the server's messages when the answer is not a success", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { UserId: "bad" } });
    await confirmAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors: { UserId: "bad" } });
  });

  it("shows the generic message for a failed answer without messages", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: null });
    await confirmAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors: "Something went wrong" });
  });

  it("cancels without deactivating", () => {
    const setOpen = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
