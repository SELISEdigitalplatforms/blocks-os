import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  buildPasswordPolicyRegex,
  PasswordPolicyRegexBuilder,
  RECOMMENDED_PASSWORD_POLICY,
} from "./password-policy-regex-builder";

describe("PasswordPolicyRegexBuilder", () => {
  it("opens the builder in a modal without the optional-helper badge", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordPolicyRegexBuilder onChange={onChange} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Build password policy" }));

    expect(screen.getByRole("dialog", { name: "Build with common password rules" })).toBeTruthy();
    expect(screen.queryByText("Optional helper")).toBeNull();
    expect(screen.getByTestId("generated-password-regex").textContent).toBe(
      buildPasswordPolicyRegex(RECOMMENDED_PASSWORD_POLICY),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("builds a regex from selected visual requirements only when applied", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordPolicyRegexBuilder onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Build password policy" }));
    const minimum = screen.getByLabelText("Minimum length");
    await user.clear(minimum);
    await user.type(minimum, "12");
    await user.click(screen.getByRole("checkbox", { name: /Uppercase letter/ }));

    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Use generated regex" }));

    expect(onChange).toHaveBeenCalledWith(
      "^(?=.*[a-z])(?=.*\\d)(?=.*[\\W_])[A-Za-z\\d\\W_]{12,30}$",
    );
  });

  it("offers the recommended baseline as a one-click choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordPolicyRegexBuilder onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Build password policy" }));
    await user.click(screen.getByRole("button", { name: "Use recommended policy" }));

    expect(onChange).toHaveBeenCalledWith(buildPasswordPolicyRegex(RECOMMENDED_PASSWORD_POLICY));
  });

  it("keeps invalid builder values advisory and disables only the apply helper", async () => {
    const user = userEvent.setup();
    render(<PasswordPolicyRegexBuilder onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Build password policy" }));
    const maximum = screen.getByLabelText("Maximum length");
    await user.clear(maximum);
    await user.type(maximum, "2");

    expect(screen.getByText(/Maximum length must be/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Use generated regex" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/remains fully editable afterward/)).toBeTruthy();
  });

  it("previews whether a sample password meets the safe visual builder choices", async () => {
    const user = userEvent.setup();
    render(<PasswordPolicyRegexBuilder onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Build password policy" }));
    const sample = screen.getByLabelText("Try the builder policy");
    await user.type(sample, "Test42");
    expect(
      screen.getByText("The sample password does not meet every builder choice."),
    ).toBeTruthy();

    await user.clear(sample);
    await user.type(sample, "TestPassword42!");
    expect(screen.getByText("The sample password meets the builder choices.")).toBeTruthy();
  });
});
