import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeHttpError,
  SECRET_ID,
  makeSecret,
} from "@/cross-modules/secrets/test-utils/secret.fixtures";

const hoisted = vi.hoisted(() => ({ rotate: vi.fn() }));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useRotateSecret: () => ({ mutateAsync: hoisted.rotate, isPending: false }),
}));

import { RotateSecretModal } from "./rotate-secret-modal";

const renderModal = (onOpenChange = vi.fn()) => {
  render(<RotateSecretModal open onOpenChange={onOpenChange} secret={makeSecret()} />);
  return { onOpenChange };
};

const confirmStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Continue" }));
};

describe("RotateSecretModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.rotate.mockResolvedValue({ isSuccess: true });
  });

  it("warns that consumers on the old value will fail", () => {
    renderModal();
    expect(screen.getByText(/start failing until it picks up the new one/i)).toBeTruthy();
  });

  it("requires a confirmation step before offering the value field", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByLabelText(/new value/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Rotate" })).toBeNull();

    await confirmStep(user);
    expect(screen.getByLabelText(/new value/i)).toBeTruthy();
  });

  it("keeps Rotate disabled until a value is entered", async () => {
    const user = userEvent.setup();
    renderModal();
    await confirmStep(user);

    const rotate = screen.getByRole("button", { name: "Rotate" });
    expect(rotate.hasAttribute("disabled")).toBe(true);

    await user.type(screen.getByLabelText(/new value/i), "next-value");
    expect(screen.getByRole("button", { name: "Rotate" }).hasAttribute("disabled")).toBe(false);
  });

  it("never generates a value for the user", async () => {
    // The reference mock-up offers a generate button; a browser inventing a credential the
    // consuming system never agreed to is not something to carry over.
    const user = userEvent.setup();
    renderModal();
    await confirmStep(user);

    expect(screen.queryByRole("button", { name: /generate/i })).toBeNull();
    expect((screen.getByLabelText(/new value/i) as HTMLInputElement).value).toBe("");
  });

  it("submits the entered value and closes", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();
    await confirmStep(user);

    await user.type(screen.getByLabelText(/new value/i), "next-value");
    await user.click(screen.getByRole("button", { name: "Rotate" }));

    await waitFor(() =>
      expect(hoisted.rotate).toHaveBeenCalledWith({ secretId: SECRET_ID, value: "next-value" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows no size counter and leaves the length limit to the server", async () => {
    const user = userEvent.setup();
    renderModal();
    await confirmStep(user);

    expect(screen.queryByText(/KB of/i)).toBeNull();

    await user.click(screen.getByLabelText(/new value/i));
    await user.paste("a".repeat(30_000));
    await user.click(screen.getByRole("button", { name: "Rotate" }));

    await waitFor(() => expect(hoisted.rotate).toHaveBeenCalled());
  });

  it("surfaces a server-side size rejection", async () => {
    const user = userEvent.setup();
    hoisted.rotate.mockRejectedValue(new FakeHttpError(400, { reason: "VALUE_TOO_LARGE" }));
    renderModal();
    await confirmStep(user);

    await user.type(screen.getByLabelText(/new value/i), "next-value");
    await user.click(screen.getByRole("button", { name: "Rotate" }));

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((el) => /larger than the 25 KB limit/i.test(el.textContent ?? "")),
      ).toBe(true),
    );
  });

  it("keeps the dialog open and explains a failure", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();
    hoisted.rotate.mockRejectedValue(new FakeHttpError(403, {}));
    await confirmStep(user);

    await user.type(screen.getByLabelText(/new value/i), "next-value");
    await user.click(screen.getByRole("button", { name: "Rotate" }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((el) => /do not have permission/i.test(el.textContent ?? "")),
      ).toBe(true),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
