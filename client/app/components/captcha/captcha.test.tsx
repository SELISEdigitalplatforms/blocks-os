import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./reCaptcha", () => ({ ReCaptcha: () => <div data-testid="recaptcha" /> }));
vi.mock("./hCaptcha", () => ({ HCaptcha: () => <div data-testid="hcaptcha" /> }));

import { Captcha } from "./captcha";

describe("Captcha", () => {
  it("renders the reCAPTCHA implementation", () => {
    render(<Captcha type="reCaptcha-v2-checkbox" siteKey="s" />);
    expect(screen.getByTestId("recaptcha")).toBeTruthy();
  });

  it("renders the hCaptcha implementation", () => {
    render(<Captcha type="hCaptcha" siteKey="s" />);
    expect(screen.getByTestId("hcaptcha")).toBeTruthy();
  });

  it("throws when no type is passed", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Captcha type={undefined as never} />)).toThrow("Captcha type is not passed");
    spy.mockRestore();
  });

  it("throws for an unsupported type", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Captcha type={"unknown" as never} />)).toThrow(
      "Captcha type is not supported",
    );
    spy.mockRestore();
  });
});
