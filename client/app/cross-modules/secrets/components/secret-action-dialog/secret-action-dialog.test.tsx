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
  purge: vi.fn(),
  dependents: vi.fn(),
}));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useLockSecret: () => ({ mutateAsync: hoisted.lock, isPending: false }),
  useUnlockSecret: () => ({ mutateAsync: hoisted.unlock, isPending: false }),
  useDeleteSecret: () => ({ mutateAsync: hoisted.remove, isPending: false }),
  useRestoreSecret: () => ({ mutateAsync: hoisted.restore, isPending: false }),
  usePurgeSecret: () => ({ mutateAsync: hoisted.purge, isPending: false }),
  useSecretDependents: (secretId: string, enabled: boolean) =>
    hoisted.dependents(secretId, enabled),
}));

type DependentsState = {
  isLoading?: boolean;
  isError?: boolean;
  data?: { secretId: string; dependents: { kind: string; id: string; name: string }[] };
};

const givenDependents = (state: DependentsState) =>
  hoisted.dependents.mockReturnValue({ isLoading: false, isError: false, ...state });

const TWO_DEPENDENTS = {
  secretId: SECRET_ID,
  dependents: [
    { kind: "captcha", id: "c1", name: "recaptcha" },
    { kind: "mail", id: "m2", name: "Support mailbox" },
  ],
};

import { SecretActionDialog, type SecretLifecycleAction } from "./secret-action-dialog";

const renderDialog = (action: SecretLifecycleAction, secret = makeSecret()) => {
  const onOpenChange = vi.fn();
  render(<SecretActionDialog open onOpenChange={onOpenChange} secret={secret} action={action} />);
  return { onOpenChange };
};

describe("SecretActionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => fn.mockResolvedValue({ isSuccess: true }));
    givenDependents({ data: { secretId: SECRET_ID, dependents: [] } });
  });

  it.each([
    ["lock", "Lock", hoisted.lock],
    ["unlock", "Unlock", hoisted.unlock],
    ["delete", "Archive", hoisted.remove],
    ["restore", "Restore", hoisted.restore],
    ["purge", "Purge", hoisted.purge],
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

  it("describes archive as reversible, because the backend keeps the value", () => {
    renderDialog("delete");
    expect(screen.getByText("Archive payment-gateway-key?")).toBeTruthy();
    expect(screen.getByText(/Archived filter/)).toBeTruthy();
    expect(screen.getByText(/restore it later/i)).toBeTruthy();
    expect(screen.queryByText(/cannot be undone/i)).toBeNull();
  });

  it("describes purge as irreversible", () => {
    renderDialog("purge", makeSecret({ status: SECRET_STATUS.Deleted }));
    expect(screen.getByText("Purge payment-gateway-key?")).toBeTruthy();
    expect(screen.getByText(/cannot be restored/i)).toBeTruthy();
  });

  it("keeps the dialog open and explains a refused purge", async () => {
    const user = userEvent.setup();
    hoisted.purge.mockRejectedValue(new FakeHttpError(409, {}));
    const { onOpenChange } = renderDialog("purge", makeSecret({ status: SECRET_STATUS.Deleted }));

    await user.click(screen.getByRole("button", { name: "Purge" }));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("names the secret it is about to act on", () => {
    renderDialog("restore", makeSecret({ status: SECRET_STATUS.Deleted }));
    expect(screen.getByText("Restore payment-gateway-key?")).toBeTruthy();
  });

  it("keeps the dialog open and explains a refused action", async () => {
    const user = userEvent.setup();
    hoisted.remove.mockRejectedValue(new FakeHttpError(403, {}));
    const { onOpenChange } = renderDialog("delete");

    await user.click(screen.getByRole("button", { name: "Archive" }));

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

  describe("dependents warning", () => {
    it.each(["lock", "unlock", "restore"] as const)(
      "never looks up dependents for %s",
      (action) => {
        renderDialog(action);
        expect(hoisted.dependents).toHaveBeenCalledWith(SECRET_ID, false);
        expect(screen.queryByText(/In use by/)).toBeNull();
      },
    );

    it.each(["delete", "purge"] as const)("looks up dependents for %s while open", (action) => {
      renderDialog(action, makeSecret({ status: SECRET_STATUS.Deleted }));
      expect(hoisted.dependents).toHaveBeenCalledWith(SECRET_ID, true);
    });

    it("shows a skeleton and holds confirm, natively disabled, while the lookup runs", () => {
      givenDependents({ isLoading: true });
      renderDialog("delete");

      expect(screen.getByRole("status").textContent).toMatch(/Checking which configurations/);
      expect((screen.getByRole("button", { name: "Archive" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      // Cancel is never held.
      expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    it("names every dependent with the archive copy, and still archives on confirm", async () => {
      const user = userEvent.setup();
      givenDependents({ data: TWO_DEPENDENTS });
      const { onOpenChange } = renderDialog("delete");

      const banner = screen.getByRole("alert");
      expect(banner.textContent).toMatch(/In use by 2 configurations/);
      const items = screen.getAllByRole("listitem").map((item) => item.textContent);
      expect(items).toEqual(["CAPTCHA — Google reCAPTCHA", "Mail — Support mailbox"]);
      expect(banner.textContent).toMatch(
        /They will stop working until you restore this secret or enter a new value in each configuration\./,
      );

      // Never blocked by dependents.
      await user.click(screen.getByRole("button", { name: "Archive" }));
      await waitFor(() => expect(hoisted.remove).toHaveBeenCalledWith(SECRET_ID));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("uses the purge copy for one dependent, and still purges on confirm", async () => {
      const user = userEvent.setup();
      givenDependents({
        data: {
          secretId: SECRET_ID,
          dependents: [{ kind: "mail", id: "m2", name: "Support mailbox" }],
        },
      });
      renderDialog("purge", makeSecret({ status: SECRET_STATUS.Deleted }));

      const banner = screen.getByRole("alert");
      expect(banner.textContent).toMatch(/In use by 1 configuration(?!s)/);
      expect(banner.textContent).toMatch(
        /They will stop working\. Purging can't be undone; each configuration will need a new value\./,
      );

      await user.click(screen.getByRole("button", { name: "Purge" }));
      await waitFor(() => expect(hoisted.purge).toHaveBeenCalledWith(SECRET_ID));
    });

    it("shows no notice when nothing uses the secret", () => {
      renderDialog("delete");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("explains a failed lookup and keeps confirm enabled", async () => {
      const user = userEvent.setup();
      givenDependents({ isError: true });
      renderDialog("delete");

      expect(screen.getByRole("alert").textContent).toBe(
        "Couldn't check whether any configuration uses this secret.",
      );
      const confirm = screen.getByRole("button", { name: "Archive" }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);

      await user.click(confirm);
      await waitFor(() => expect(hoisted.remove).toHaveBeenCalledWith(SECRET_ID));
    });

    it("adds nothing focusable, so the focus order stays body, Cancel, Confirm", () => {
      givenDependents({ data: TWO_DEPENDENTS });
      renderDialog("delete");

      expect(
        screen.getByRole("alert").querySelectorAll("button, a, input, [tabindex]"),
      ).toHaveLength(0);
      const buttons = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttons.indexOf("Cancel")).toBeGreaterThanOrEqual(0);
      expect(buttons.indexOf("Cancel")).toBeLessThan(buttons.indexOf("Archive"));
    });
  });
});
