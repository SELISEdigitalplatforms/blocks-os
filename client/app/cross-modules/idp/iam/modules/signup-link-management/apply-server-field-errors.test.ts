import { describe, expect, it, vi } from "vitest";
import { UseFormReturn } from "react-hook-form";
import { applyServerFieldErrors } from "./apply-server-field-errors";
import { SignupLinkConfigurationFormValues } from "./configuration-form-schema";

const makeForm = () => {
  const setError = vi.fn();
  const setFocus = vi.fn();
  const form = {
    setError,
    setFocus,
  } as unknown as UseFormReturn<SignupLinkConfigurationFormValues>;
  return { form, setError, setFocus };
};

describe("applyServerFieldErrors", () => {
  it("routes DefaultMaxRedemptions onto its field and focuses it (C4)", () => {
    const { form, setError, setFocus } = makeForm();
    const result = applyServerFieldErrors(form, { DefaultMaxRedemptions: "Bad" });
    expect(setError).toHaveBeenCalledWith("defaultMaxRedemptions", {
      type: "server",
      message: "Bad",
    });
    expect(setFocus).toHaveBeenCalledWith("defaultMaxRedemptions");
    expect(result).toEqual({ formLevelError: null, routedAField: true });
  });

  it("routes RequireExistingUserPassword onto the switch and focuses it (C4)", () => {
    const { form, setError, setFocus } = makeForm();
    applyServerFieldErrors(form, { RequireExistingUserPassword: ["Not allowed", "here"] });
    expect(setError).toHaveBeenCalledWith("requireExistingUserPassword", {
      type: "server",
      message: "Not allowed here",
    });
    expect(setFocus).toHaveBeenCalledWith("requireExistingUserPassword");
  });

  it("focuses the earliest field in form order", () => {
    const { form, setFocus } = makeForm();
    applyServerFieldErrors(form, {
      DefaultMaxRedemptions: "Bad",
      RequireExistingUserPassword: "Bad",
      Name: "Taken",
    });
    expect(setFocus).toHaveBeenCalledTimes(1);
    expect(setFocus).toHaveBeenCalledWith("name");
  });

  it("returns ItemId and unmapped keys as a form-level error without focusing", () => {
    const { form, setError, setFocus } = makeForm();
    const result = applyServerFieldErrors(form, { ItemId: "Missing", Other: "Odd" });
    expect(setError).not.toHaveBeenCalled();
    expect(setFocus).not.toHaveBeenCalled();
    expect(result).toEqual({ formLevelError: "Missing Odd", routedAField: false });
  });

  it("handles no errors", () => {
    const { form } = makeForm();
    expect(applyServerFieldErrors(form, undefined)).toEqual({
      formLevelError: null,
      routedAField: false,
    });
  });
});
