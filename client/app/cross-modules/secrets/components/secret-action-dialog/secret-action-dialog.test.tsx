import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SECRET_STATUS } from "@/cross-modules/secrets/models/secret.model";
import {
  FakeHttpError,
  SECRET_ID,
  makeSecret,
} from "@/cross-modules/secrets/test-utils/secret.fixtures";

const hoisted = vi.hoisted(() => ({
  lock: vi.fn(),
  unlock: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useLockSecret: () => ({ mutateAsync: hoisted.lock, isPending: false }),
  useUnlockSecret: () => ({ mutateAsync: hoisted.unlock, isPending: false }),
  useDeleteSecret: () => ({ mutateAsync: hoisted.remove, isPending: false }),
  useRestoreSecret: () => ({ mutateAsync: hoisted.restore, isPending: false }),
}));

import { SecretActionDialog, type SecretLifecycleAction } from "./secret-action-dialog";

const renderDialog = (action: SecretLifecycleAction, secret = makeSecret()) => {
  const onOpenChange = vi.fn();
  render(
    <SecretActionDialog open onOpenChange={onOpenChange} secret={secret} action={action} />,
  );
  return { onOpenChange };
};

describe("SecretActionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => fn.mockResolvedValue({ isSuccess: true }));
  });

  it.each([
    ["lock", "Lock", hoisted.lock],
    ["unlock", "Unlock", hoisted.unlock],
    ["delete", "Delete", hoisted.remove],
    ["restore", "Restore", hoisted.restore],
  ] as const)("requires a click on %s before anything happens", async (action, label, fn) => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(action);

    expect(fn).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(fn).toHaveBeenCalledWith(SECRET_ID));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancels without calling anything", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog("delete");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(hoisted.remove).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("describes delete as reversible, because the backend keeps the value", () => {
    renderDialog("delete");
    expect(screen.getByText(/soft delete/i)).toBeTruthy();
    expect(screen.getByText(/restore it later/i)).toBeTruthy();
    expect(screen.queryByText(/cannot be undone/i)).toBeNull();
  });

  it("names the secret it is about to act on", () => {
    renderDialog("restore", makeSecret({ status: SECRET_STATUS.Deleted }));
    expect(screen.getByText("Restore payment-gateway-key?")).toBeTruthy();
  });

  it("keeps the dialog open and explains a refused action", async () => {
    const user = userEvent.setup();
    hoisted.remove.mockRejectedValue(new FakeHttpError(403, {}));
    const { onOpenChange } = renderDialog("delete");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((el) => /do not have permission/i.test(el.textContent ?? "")),
      ).toBe(true),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("explains a conflict as a stale view", async () => {
    const user = userEvent.setup();
    hoisted.lock.mockRejectedValue(new FakeHttpError(409, { reason: "STATUS_DELETED" }));
    renderDialog("lock");

    await user.click(screen.getByRole("button", { name: "Lock" }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((el) => /status has changed/i.test(el.textContent ?? "")),
      ).toBe(true),
    );
  });
});
