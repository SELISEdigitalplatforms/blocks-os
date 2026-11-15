import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAccountActivateByAdmin: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (a: unknown) => h.showError(a),
  showSuccessToast: (a: unknown) => h.showSuccess(a),
}));

import { HttpError } from "@seliseblocks/genesis-os/lib";
import { UserActivate } from "./user-activate";

const TOO_SHORT = "Enter a reason of at least 3 characters.";
const TOO_LONG = "Keep the reason to 500 characters or fewer.";
const reasonField = () => screen.getByRole("textbox", { name: "Reason" }) as HTMLTextAreaElement;
const confirmButton = () => screen.getByRole("button", { name: "Activate account" });

const renderDialog = (setOpen = vi.fn()) => {
  const view = render(<UserActivate userId="u1" open={true} setOpen={setOpen} />);
  return { ...view, setOpen };
};

const submitReason = async (reason: string, setOpen = vi.fn()) => {
  const user = userEvent.setup();
  renderDialog(setOpen);
  await user.type(reasonField(), reason);
  await user.click(confirmButton());
  return { user, setOpen };
};

const submitAndSettle = async (reason = "Back from leave") => {
  const { setOpen } = await submitReason(reason);
  await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
});

describe("UserActivate", () => {
  it("asks for a labelled, empty reason limited to 500 characters", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Activate account?" })).toBeTruthy();
    expect(
      screen.getByText(
        "This user will be able to sign in again. Your reason is saved in their activity history.",
      ),
    ).toBeTruthy();
    expect(reasonField().value).toBe("");
    expect(reasonField().maxLength).toBe(500);
    expect(reasonField().placeholder).toBe("Why is this account being activated?");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(confirmButton()).toBeTruthy();
  });

  it("sends the trimmed reason once, shows the success toast and closes", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true, itemId: "u1", errors: null });
    await submitAndSettle("  Rejoined the team ");
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.mutateAsync).toHaveBeenCalledWith({ userId: "u1", reason: "Rejoined the team" });
    expect(h.showSuccess).toHaveBeenCalledWith({
      description: "User has been activated successfully.",
    });
  });

  it.each(["  ok  ", "   ", "ab"])(
    "keeps the dialog open and sends nothing for the reason %j",
    async (reason) => {
      const { setOpen } = await submitReason(reason);
      expect(await screen.findByText(TOO_SHORT)).toBeTruthy();
      expect(reasonField().getAttribute("aria-invalid")).toBe("true");
      expect(reasonField().getAttribute("aria-describedby")).toContain("form-item-message");
      expect(h.mutateAsync).not.toHaveBeenCalled();
      expect(setOpen).not.toHaveBeenCalled();
    },
  );

  it("shows the error for an empty reason too", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(confirmButton());
    expect(await screen.findByText(TOO_SHORT)).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("re-checks on change once the error is shown", async () => {
    const { user } = await submitReason("ab");
    expect(await screen.findByText(TOO_SHORT)).toBeTruthy();
    await user.type(reasonField(), "c");
    await waitFor(() => expect(screen.queryByText(TOO_SHORT)).toBeNull());
  });

  it("keeps at most 500 characters of a pasted reason and sends them trimmed", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    const setOpen = vi.fn();
    renderDialog(setOpen);
    await user.click(reasonField());
    await user.paste(` ${"x".repeat(519)}`);
    expect(reasonField().value).toHaveLength(500);
    await user.click(confirmButton());
    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    expect(h.mutateAsync).toHaveBeenCalledWith({ userId: "u1", reason: "x".repeat(499) });
  });

  it("rejects a reason longer than 500 characters that bypasses the field limit", async () => {
    renderDialog();
    fireEvent.change(reasonField(), { target: { value: "y".repeat(501) } });
    fireEvent.submit(reasonField().closest("form") as HTMLFormElement);
    expect(await screen.findByText(TOO_LONG)).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("sends one request when the form is submitted again before the first settles", async () => {
    let settle: (value: unknown) => void = () => undefined;
    h.mutateAsync.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const user = userEvent.setup();
    const setOpen = vi.fn();
    renderDialog(setOpen);
    await user.type(reasonField(), "Back from leave");
    const form = reasonField().closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    settle({ isSuccess: true });
    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("locks both buttons, shows a spinner and cannot be dismissed while pending", () => {
    h.isPending = true;
    const { setOpen } = renderDialog();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(confirmButton().querySelector(".animate-spin")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("shows IAM's message when the user is already active and closes", async () => {
    const errors = { UserId: "User is already active" };
    h.mutateAsync.mockRejectedValue(new HttpError(400, { errors }));
    await submitAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors });
  });

  it.each([
    ["an empty body", {}],
    ["the access-grant refusal", { Access_Grant_Not_Allowed: "Access_Grant_Not_Allowed" }],
  ])("shows the forbidden message for a 403 with %s", async (_label, errors) => {
    h.mutateAsync.mockRejectedValue(new HttpError(403, { errors }));
    await submitAndSettle();
    expect(h.showError).toHaveBeenCalledWith({
      errors: "You don't have permission to change this user's status.",
    });
  });

  it.each([
    ["no response", new HttpError(500, { errors: new TypeError("Failed to fetch") as never })],
    ["an error without errors", new Error("boom")],
  ])("shows the generic message for %s", async (_label, rejection) => {
    h.mutateAsync.mockRejectedValue(rejection);
    await submitAndSettle();
    expect(h.showError).toHaveBeenCalledWith({ errors: "Something went wrong" });
  });

  it("cancels without sending and starts empty when opened again", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    const { rerender } = renderDialog(setOpen);
    await user.type(reasonField(), "half typed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(h.mutateAsync).not.toHaveBeenCalled();

    rerender(<UserActivate userId="u1" open={false} setOpen={setOpen} />);
    rerender(<UserActivate userId="u1" open={true} setOpen={setOpen} />);
    expect(reasonField().value).toBe("");
  });

  it("closes on Escape without sending while nothing is pending", async () => {
    const user = userEvent.setup();
    const { setOpen } = renderDialog();
    await user.keyboard("{Escape}");
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
