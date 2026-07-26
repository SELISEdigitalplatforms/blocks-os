import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false, ok: vi.fn(), err: vi.fn() }));

vi.mock("@/hooks/use-project", () => ({
  useValidateCNameProject: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@seliseblocks/blocks-kit/utils", () => ({
  showSuccessToast: (...a: unknown[]) => h.ok(...a),
  showErrorToast: (...a: unknown[]) => h.err(...a),
}));
vi.mock("@seliseblocks/blocks-kit/components", () => ({
  LoadingButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

import { CnameValidatorProject } from "./validator-project";

describe("CnameValidatorProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
  });

  it("validates the CNAME and shows a success toast", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    render(<CnameValidatorProject isDomainVerified={false} cookieDomain="x.com" />);
    await user.click(screen.getByRole("button", { name: "CNAME Lookup" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.ok).toHaveBeenCalledWith({ description: "CName is validated successfully" });
  });

  it("shows an error toast when validation reports failure", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: "nope" });
    const user = userEvent.setup();
    render(<CnameValidatorProject isDomainVerified={false} cookieDomain="x.com" />);
    await user.click(screen.getByRole("button", { name: "CNAME Lookup" }));
    await waitFor(() => expect(h.err).toHaveBeenCalledWith({ errors: "nope" }));
  });

  it("shows an error toast for structured thrown errors", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { domain: "bad" } });
    const user = userEvent.setup();
    render(<CnameValidatorProject isDomainVerified={false} cookieDomain="x.com" />);
    await user.click(screen.getByRole("button", { name: "CNAME Lookup" }));
    await waitFor(() => expect(h.err).toHaveBeenCalledWith({ errors: { domain: "bad" } }));
  });

  it("is disabled and does nothing when the domain is already verified", async () => {
    const user = userEvent.setup();
    render(<CnameValidatorProject isDomainVerified cookieDomain="x.com" />);
    const button = screen.getByRole("button", { name: "CNAME Lookup" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
