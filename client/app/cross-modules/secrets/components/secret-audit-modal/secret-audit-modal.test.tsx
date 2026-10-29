import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAuditLog, makeSecret } from "@/cross-modules/secrets/test-utils/secret.fixtures";
import type { SecretAuditListResult } from "@/cross-modules/secrets/models/secret.model";

const hoisted = vi.hoisted(() => ({
  state: {
    data: undefined as SecretAuditListResult | undefined,
    isLoading: false,
    isFetching: false,
    error: null as unknown,
  },
  lastFilter: undefined as unknown,
}));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useSecretAuditLogs: (filter: unknown) => {
    hoisted.lastFilter = filter;
    return hoisted.state;
  },
}));

import { SecretAuditModal } from "./secret-audit-modal";

const renderModal = () =>
  render(<SecretAuditModal open onOpenChange={vi.fn()} secret={makeSecret()} />);

describe("SecretAuditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.state = { data: undefined, isLoading: false, isFetching: false, error: null };
  });

  it("requests the first page for this secret", () => {
    hoisted.state.data = { data: [], totalCount: 0 };
    renderModal();
    expect(hoisted.lastFilter).toEqual({
      secretId: "0123456789abcdef0123456789abcdef",
      pageNumber: 1,
      pageSize: 10,
    });
  });

  it("renders actions, actors and outcomes", () => {
    hoisted.state.data = {
      data: [
        makeAuditLog({ auditId: "a-1", action: "Rotate", outcome: "Success" }),
        makeAuditLog({ auditId: "a-2", action: "GetValue", outcome: "Denied" }),
      ],
      totalCount: 2,
    };

    renderModal();

    expect(screen.getByText("Rotate")).toBeTruthy();
    expect(screen.getByText("GetValue")).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
    expect(screen.getByText("Denied")).toBeTruthy();
  });

  it("styles Denied and Failed distinctly from Success", () => {
    hoisted.state.data = {
      data: [
        makeAuditLog({ auditId: "a-1", outcome: "Success" }),
        makeAuditLog({ auditId: "a-2", outcome: "Denied" }),
        makeAuditLog({ auditId: "a-3", outcome: "Failed" }),
      ],
      totalCount: 3,
    };

    renderModal();

    const classOf = (text: string) => screen.getByText(text).className;
    expect(classOf("Success")).not.toBe(classOf("Denied"));
    expect(classOf("Denied")).toBe(classOf("Failed"));
  });

  it("translates a reason code into readable text", () => {
    hoisted.state.data = {
      data: [makeAuditLog({ outcome: "Denied", reason: "NOT_IN_ACCESS_LIST" })],
      totalCount: 1,
    };

    renderModal();

    expect(screen.getByText("Not in the access list")).toBeTruthy();
  });

  it("marks a root override as an admin action", () => {
    hoisted.state.data = { data: [makeAuditLog({ isRootOverride: true })], totalCount: 1 };
    renderModal();
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("has no Versions tab — the API stores no version history", () => {
    hoisted.state.data = { data: [], totalCount: 0 };
    renderModal();
    expect(screen.queryByText(/version/i)).toBeNull();
  });

  it("shows an empty state when there is nothing recorded", () => {
    hoisted.state.data = { data: [], totalCount: 0 };
    renderModal();
    expect(screen.getByText("No audit entries yet.")).toBeTruthy();
  });

  it("explains a permission failure instead of showing an empty log", () => {
    // ::audit defaults to admin-only in the seeded permissions, so 403 is a routine outcome.
    hoisted.state.error = Object.assign(new Error("denied"), { status: 403, errors: {} });
    renderModal();
    expect(screen.getByRole("alert").textContent).toMatch(/do not have permission/i);
  });
});
