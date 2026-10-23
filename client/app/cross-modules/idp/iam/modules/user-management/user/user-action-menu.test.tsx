import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => import("@/test-utils/__mocks__/grant-scope.mock"));
vi.mock("@blocks-idp/iam/hooks/use-user-manageability", () => import("@/test-utils/__mocks__/user-manageability.mock"));

// Tooltip re-exports blocks-kit (process.env at load); passthrough keeps it renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

const h = vi.hoisted(() => ({
  user: { data: { data: { active: true } } } as { data: { data: { active: boolean } } | undefined },
  resetProps: null as Record<string, unknown> | null,
  resendProps: null as Record<string, unknown> | null,
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.user.data }),
}));
vi.mock("./user-reset-password", () => ({
  UserResetPassword: (props: Record<string, unknown>) => {
    h.resetProps = props;
    return <div data-testid="reset-modal">{String(props.open)}</div>;
  },
}));
vi.mock("./user-resend-activation/user-resend-activation", () => ({
  UserResendActivationMail: (props: Record<string, unknown>) => {
    h.resendProps = props;
    return <div data-testid="resend-modal">{String(props.open)}</div>;
  },
}));

import { UserActionMenu } from "./user-action-menu";
import { manageability, resetManageability } from "@/test-utils/__mocks__/user-manageability.mock";


beforeEach(() => {
  vi.clearAllMocks();
  resetManageability();
  h.user.data = { data: { active: true } };
});

describe("UserActionMenu", () => {
  it("shows reset-password controls for an active user and opens the reset modal", () => {
    render(<UserActionMenu id="u1" projectKey="p1" />);
    const resetButtons = screen.getAllByRole("button", { name: "Reset Password" });
    expect(resetButtons.length).toBeGreaterThan(0);
    fireEvent.click(resetButtons[0]);
    expect(h.resetProps?.open).toBe(true);
  });

  it("shows resend-activation controls for an inactive user and opens the resend modal", () => {
    h.user.data = { data: { active: false } };
    render(<UserActionMenu id="u1" projectKey="p1" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Resend Activation" })[0]);
    expect(h.resendProps?.open).toBe(true);
  });

  it("treats a missing user as inactive", () => {
    h.user.data = undefined;
    render(<UserActionMenu id="u1" projectKey="p1" />);
    expect(screen.getAllByText("Resend Activation").length).toBeGreaterThan(0);
  });

  it("turns the action off, with the reason, for a user the caller cannot manage", () => {
    manageability.blockedIds.add("u1");
    h.user.data = { data: { itemId: "u1", active: true } } as never;
    render(<UserActionMenu id="u1" projectKey="p1" />);
    const button = screen.getByRole("button", { name: "Reset Password" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId("disabled-reason")).toBeTruthy();
    expect(screen.queryByTestId("reset-modal")).toBeNull();
  });

  it("offers Resend Activation, off, for an inactive user the caller cannot manage", () => {
    manageability.blockedIds.add("u1");
    h.user.data = { data: { itemId: "u1", active: false } } as never;
    render(<UserActionMenu id="u1" projectKey="p1" />);
    expect((screen.getByRole("button", { name: "Resend Activation" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
