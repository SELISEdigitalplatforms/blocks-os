import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MaskedText } from "./masked-text";

describe("MaskedText", () => {
  it("masks the whole string by default", () => {
    const { container } = render(<MaskedText text="secret" />);
    expect(container.textContent).toBe("******");
  });

  it("reveals the first and last N characters", () => {
    const { container } = render(
      <MaskedText text="1234567890" showFirstN={2} showLastN={2} />,
    );
    expect(container.textContent).toBe("12******90");
  });

  it("uses a custom masking character", () => {
    const { container } = render(<MaskedText text="abcd" char="•" />);
    expect(container.textContent).toBe("••••");
  });

  it("honors an explicit length override", () => {
    const { container } = render(<MaskedText text="ab" length={5} char="#" />);
    expect(container.textContent).toBe("#####");
  });

  it("never produces a negative mask count", () => {
    const { container } = render(
      <MaskedText text="ab" showFirstN={5} showLastN={5} />,
    );
    // firstVisible = "ab", lastVisible = "ab", masked count clamped to 0
    expect(container.textContent).toBe("abab");
  });

  it("handles empty text without throwing", () => {
    const { container } = render(<MaskedText text="" />);
    expect(container.textContent).toBe("");
  });
});
