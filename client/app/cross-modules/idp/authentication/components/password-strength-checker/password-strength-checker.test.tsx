import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { PasswordStrengthChecker } from "./password-strength-checker";

const STRONG = "Abcdef1!";

describe("PasswordStrengthChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the requirement list", () => {
    render(<PasswordStrengthChecker password="" confirmPassword="" onRequirementsMet={vi.fn()} />);

    expect(screen.getByText("Password Requirements")).toBeTruthy();
    expect(screen.getByText("Between 8 and 30 characters")).toBeTruthy();
    expect(screen.getByText("At least 1 uppercase and 1 lowercase letter")).toBeTruthy();
    expect(screen.getByText("At least 1 digit")).toBeTruthy();
    expect(screen.getByText("At least 1 special character")).toBeTruthy();
    expect(screen.getByText("Passwords match")).toBeTruthy();
  });

  it("reports all requirements met for a strong, matching password", async () => {
    const onRequirementsMet = vi.fn();
    render(
      <PasswordStrengthChecker
        password={STRONG}
        confirmPassword={STRONG}
        onRequirementsMet={onRequirementsMet}
      />,
    );

    await waitFor(() => {
      expect(onRequirementsMet).toHaveBeenLastCalledWith(true);
    });
  });

  it("reports requirements unmet when passwords do not match", async () => {
    const onRequirementsMet = vi.fn();
    render(
      <PasswordStrengthChecker
        password={STRONG}
        confirmPassword="something-else"
        onRequirementsMet={onRequirementsMet}
      />,
    );

    await waitFor(() => {
      expect(onRequirementsMet).toHaveBeenLastCalledWith(false);
    });
  });

  it("shows the exclude-password requirement and fails it when reused", async () => {
    const onRequirementsMet = vi.fn();
    render(
      <PasswordStrengthChecker
        password={STRONG}
        confirmPassword={STRONG}
        excludePassword={STRONG}
        excludePasswordLabel="New password must differ from current"
        onRequirementsMet={onRequirementsMet}
      />,
    );

    expect(screen.getByText("New password must differ from current")).toBeTruthy();
    await waitFor(() => {
      expect(onRequirementsMet).toHaveBeenLastCalledWith(false);
    });
  });
});
