import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Table, TableBody } from "@/components/ui-kits/table/table";
import {
  SECRET_NAME_DISPLAY_MAX_LENGTH,
  SECRET_STATUS,
  SECRET_TYPE,
} from "@/cross-modules/secrets/models/secret.model";
import {
  FakeHttpError,
  SECRET_ID,
  makeSecret,
} from "@/cross-modules/secrets/test-utils/secret.fixtures";

const hoisted = vi.hoisted(() => ({
  revealMutate: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  tagCatalogue: [{ key: "iam", label: "Blocks Iam" }],
}));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useRevealSecret: () => ({ mutateAsync: hoisted.revealMutate, isPending: false }),
  useSecretTags: () => ({ data: hoisted.tagCatalogue, isLoading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: hoisted.showSuccessToast,
  showErrorToast: hoisted.showErrorToast,
}));
// The tooltip ui-kit re-exports blocks-kit, which touches process.env at module load; a
// passthrough keeps the tree renderable. The reason string is asserted via `title` anyway.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The row's job is choosing which actions exist; the panels themselves are tested separately.
vi.mock("../secret-detail/secret-detail", () => ({
  SecretDetail: () => <div data-testid="secret-detail" />,
}));
vi.mock("../reveal-secret-modal/reveal-secret-modal", () => ({
  RevealSecretModal: () => <div data-testid="reveal-modal" />,
}));
vi.mock("../rotate-secret-modal/rotate-secret-modal", () => ({
  RotateSecretModal: () => <div data-testid="rotate-modal" />,
}));
vi.mock("../secret-form-modal/secret-form-modal", () => ({
  SecretFormModal: () => <div data-testid="form-modal" />,
}));
vi.mock("../secret-audit-modal/secret-audit-modal", () => ({
  SecretAuditModal: () => <div data-testid="audit-modal" />,
}));
vi.mock("../secret-action-dialog/secret-action-dialog", () => ({
  SecretActionDialog: ({ action }: { action: string }) => (
    <div data-testid="action-dialog">{action}</div>
  ),
}));

import { SecretRow } from "./secret-row";

const renderRow = (secret = makeSecret()) =>
  render(
    <Table>
      <TableBody>
        <SecretRow secret={secret} />
      </TableBody>
    </Table>,
  );

const openMenu = async (user: ReturnType<typeof userEvent.setup>, name = "payment-gateway-key") => {
  await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  return screen.findByRole("menu");
};

describe("SecretRow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the name and the type/status badges", () => {
    renderRow(makeSecret({ status: SECRET_STATUS.Locked }));
    expect(screen.getByText("payment-gateway-key")).toBeTruthy();
    expect(screen.getByText("Application")).toBeTruthy();
    expect(screen.getByText("Locked")).toBeTruthy();
  });

  it("caps a long name and keeps the full one reachable", () => {
    const name = "testhujioasdjoias_napoijdaopsij_paojidapoijd_aokkjasndkaj_adoiaso";
    renderRow(makeSecret({ name }));

    const shown = screen.getByTitle(name);
    expect(shown.textContent).toBe(`${name.slice(0, SECRET_NAME_DISPLAY_MAX_LENGTH)}…`);
    // The untruncated name must not be in the row, or the column stretches anyway.
    expect(screen.queryByText(name)).toBeNull();
  });

  it("keeps the description out of the row — it belongs to the expanded panel", () => {
    renderRow();
    expect(screen.queryByText("Used by the checkout service")).toBeNull();
  });

  it("expands to the detail panel", async () => {
    const user = userEvent.setup();
    renderRow();
    expect(screen.queryByTestId("secret-detail")).toBeNull();
    await user.click(screen.getByText("payment-gateway-key"));
    expect(screen.getByTestId("secret-detail")).toBeTruthy();
  });

  describe("value actions", () => {
    it("offers reveal and copy on an active api secret the caller may read", () => {
      renderRow();
      expect(screen.getByRole("button", { name: "Reveal value" }).getAttribute("aria-disabled")).not.toBe(
        "true",
      );
      expect(screen.getByRole("button", { name: "Copy value" })).toBeTruthy();
    });

    it("disables them with a reason when canReadValue is false", async () => {
      // Driven by the backend's per-row evaluation, not by a client-side role guess.
      const user = userEvent.setup();
      renderRow(makeSecret({ canReadValue: false }));

      const reveal = screen.getByRole("button", { name: "Reveal value" });
      expect(reveal.getAttribute("aria-disabled")).toBe("true");
      expect(reveal.getAttribute("title")).toBe("You do not have permission to read this value");

      await user.click(reveal);
      expect(screen.queryByTestId("reveal-modal")).toBeNull();
    });

    it("shows no reveal or copy affordance on a service secret", () => {
      renderRow(makeSecret({ type: SECRET_TYPE.Service, access: null }));
      expect(screen.queryByRole("button", { name: "Reveal value" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Copy value" })).toBeNull();
    });

    it("shows no reveal or copy affordance on a locked secret", () => {
      renderRow(makeSecret({ status: SECRET_STATUS.Locked }));
      expect(screen.queryByRole("button", { name: "Reveal value" })).toBeNull();
    });

    it("opens the reveal modal on click", async () => {
      const user = userEvent.setup();
      renderRow();
      await user.click(screen.getByRole("button", { name: "Reveal value" }));
      expect(screen.getByTestId("reveal-modal")).toBeTruthy();
    });

    it("copies through the audited endpoint exactly once per click", async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      // jsdom exposes navigator.clipboard as a getter-only property.
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      hoisted.revealMutate.mockResolvedValue({ secretId: SECRET_ID, value: "shh" });

      renderRow();
      await user.click(screen.getByRole("button", { name: "Copy value" }));

      expect(hoisted.revealMutate).toHaveBeenCalledTimes(1);
      expect(hoisted.revealMutate).toHaveBeenCalledWith(SECRET_ID);
      expect(writeText).toHaveBeenCalledWith("shh");
      expect(hoisted.showSuccessToast).toHaveBeenCalled();
    });

    it("reports a failed copy without crashing", async () => {
      const user = userEvent.setup();
      hoisted.revealMutate.mockRejectedValue(new FakeHttpError(403, {}));

      renderRow();
      await user.click(screen.getByRole("button", { name: "Copy value" }));

      expect(hoisted.showErrorToast).toHaveBeenCalled();
    });
  });

  describe("menu actions by state", () => {
    it("offers edit, rotate, lock, delete and audit on an active secret", async () => {
      const user = userEvent.setup();
      renderRow();
      const menu = await openMenu(user);

      for (const label of ["Edit", "Rotate", "Lock", "Delete", "Audit"]) {
        expect(within(menu).getByText(label)).toBeTruthy();
      }
      expect(within(menu).queryByText("Unlock")).toBeNull();
      expect(within(menu).queryByText("Restore")).toBeNull();
    });

    it("swaps lock for unlock on a locked secret", async () => {
      const user = userEvent.setup();
      renderRow(makeSecret({ status: SECRET_STATUS.Locked }));
      const menu = await openMenu(user);

      expect(within(menu).getByText("Unlock")).toBeTruthy();
      expect(within(menu).queryByText("Lock")).toBeNull();
      expect(within(menu).getByText("Rotate")).toBeTruthy();
    });

    it("offers only restore and audit on a deleted secret", async () => {
      const user = userEvent.setup();
      renderRow(makeSecret({ status: SECRET_STATUS.Deleted, deletedDate: "2026-03-01T00:00:00Z" }));
      const menu = await openMenu(user);

      expect(within(menu).getByText("Restore")).toBeTruthy();
      expect(within(menu).getByText("Audit")).toBeTruthy();
      for (const label of ["Edit", "Rotate", "Lock", "Unlock", "Delete"]) {
        expect(within(menu).queryByText(label)).toBeNull();
      }
    });

    it("keeps rotate available on a service secret", async () => {
      const user = userEvent.setup();
      renderRow(makeSecret({ type: SECRET_TYPE.Service, access: null }));
      const menu = await openMenu(user);

      expect(within(menu).getByText("Rotate")).toBeTruthy();
      expect(within(menu).getByText("Edit")).toBeTruthy();
    });

    it("opens the confirmation dialog for a lifecycle action", async () => {
      const user = userEvent.setup();
      renderRow();
      const menu = await openMenu(user);
      await user.click(within(menu).getByText("Delete"));

      expect(screen.getByTestId("action-dialog").textContent).toBe("delete");
    });

    it("opens the audit modal", async () => {
      const user = userEvent.setup();
      renderRow();
      const menu = await openMenu(user);
      await user.click(within(menu).getByText("Audit"));

      expect(screen.getByTestId("audit-modal")).toBeTruthy();
    });
  });
});
