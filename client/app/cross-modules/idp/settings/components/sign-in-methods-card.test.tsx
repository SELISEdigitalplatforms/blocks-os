import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/authentication/hooks/use-login-policy", () => ({
  useGetTenantLoginPolicy: () => h.query,
  useSaveTenantLoginPolicy: () => ({ mutateAsync: h.save, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { SignInMethodsCard } from "./sign-in-methods-card";

const EMBEDDED = "Embedded login";
const SERVER_ERRORS = { login_policy_locks_everyone: "Nobody could sign in." };
const LOCKED = "At least one place (Embedded or OIDC) and one method (Password or Social) must stay on.";

const loaded = (overrides: Record<string, boolean> = {}) => ({
  isPending: false,
  isError: false,
  data: {
    isSuccess: true,
    loginPolicy: {
      allowEmbedded: true,
      allowOidc: true,
      allowPassword: true,
      allowSocial: true,
      ...overrides,
    },
  },
});

const toggle = (name: string) => screen.getByRole("switch", { name });
const isOn = (name: string) => toggle(name).getAttribute("aria-checked") === "true";
const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("SignInMethodsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.query = loaded();
    h.save.mockResolvedValue({ isSuccess: true });
  });

  it("loads the saved values into the switches", () => {
    h.query = loaded({ allowEmbedded: false, allowSocial: false });
    render(<SignInMethodsCard />);
    expect(isOn(EMBEDDED)).toBe(false);
    expect(isOn("OIDC login")).toBe(true);
    expect(isOn("Password")).toBe(true);
    expect(isOn("Social")).toBe(false);
    expect(screen.getByText("Choose how users of this project can sign in.")).toBeTruthy();
    expect(screen.queryByText(LOCKED)).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it("blocks Save and warns when no place is on", async () => {
    const user = userEvent.setup();
    render(<SignInMethodsCard />);
    await user.click(toggle(EMBEDDED));
    await user.click(toggle("OIDC login"));
    expect(screen.getByText(LOCKED)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    await user.click(saveButton());
    expect(h.save).not.toHaveBeenCalled();
  });

  it("blocks Save and warns when no method is on, and frees it again", async () => {
    const user = userEvent.setup();
    render(<SignInMethodsCard />);
    await user.click(toggle("Password"));
    await user.click(toggle("Social"));
    expect(screen.getByText(LOCKED)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    await user.click(toggle("Social"));
    expect(screen.queryByText(LOCKED)).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it("saves the four values and shows a success toast", async () => {
    const user = userEvent.setup();
    render(<SignInMethodsCard />);
    await user.click(toggle(EMBEDDED));
    await user.click(toggle("Social"));
    await user.click(saveButton());
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save).toHaveBeenCalledWith({
      allowEmbedded: false,
      allowOidc: true,
      allowPassword: true,
      allowSocial: false,
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows the server errors when the save is refused", async () => {
    h.save.mockResolvedValue({
      isSuccess: false,
      errors: SERVER_ERRORS,
    });
    const user = userEvent.setup();
    render(<SignInMethodsCard />);
    await user.click(saveButton());
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: SERVER_ERRORS,
      }),
    );
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows the errors of a rejected request (HTTP 400)", async () => {
    h.save.mockRejectedValue({ errors: SERVER_ERRORS });
    const user = userEvent.setup();
    render(<SignInMethodsCard />);
    await user.click(saveButton());
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: SERVER_ERRORS,
      }),
    );
  });

  it("shows a load error and no switches when the policy cannot be read", () => {
    h.query = { isPending: false, isError: true, data: undefined };
    render(<SignInMethodsCard />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
