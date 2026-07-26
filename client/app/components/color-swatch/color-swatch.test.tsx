import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorSwatch, validHexaColorReg } from "./color-swatch";

describe("ColorSwatch", () => {
  it("renders the current value in the text input, uppercased", () => {
    render(<ColorSwatch value="#abcdef" />);
    const text = screen.getByPlaceholderText("#FFFFFF") as HTMLInputElement;
    expect(text.value).toBe("#ABCDEF");
  });

  it("sanitizes typed input and collapses duplicate hashes", () => {
    const onChange = vi.fn();
    render(<ColorSwatch value="#000000" onChange={onChange} />);
    const text = screen.getByPlaceholderText("#FFFFFF");
    fireEvent.change(text, { target: { value: "#1z2#3g" } });
    // invalid chars removed, leading single hash preserved
    expect(onChange).toHaveBeenCalledWith("#123");
  });

  it("emits the picked color from the native color input", () => {
    const onChange = vi.fn();
    const { container } = render(<ColorSwatch value="#000000" onChange={onChange} />);
    const color = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(color, { target: { value: "#aabbcc" } });
    expect(onChange).toHaveBeenCalledWith("#AABBCC");
  });

  it("opens the native color picker when the swatch is clicked", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const { container } = render(<ColorSwatch value="#123456" />);
    const swatch = container.querySelector('[title="Pick a color"]') as HTMLElement;
    fireEvent.click(swatch);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("applies the error border when hasError is true", () => {
    const { container } = render(<ColorSwatch value="#123456" hasError />);
    expect(container.querySelector(".border-destructive")).toBeTruthy();
  });

  it("exposes a hex color validation regex", () => {
    expect(validHexaColorReg.test("#fff")).toBe(true);
    expect(validHexaColorReg.test("#aabbcc")).toBe(true);
    expect(validHexaColorReg.test("nope")).toBe(false);
  });
});
