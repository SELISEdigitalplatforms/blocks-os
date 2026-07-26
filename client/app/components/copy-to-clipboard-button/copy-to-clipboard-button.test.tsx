import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyToClipboardButton } from "./copy-to-clipboard-button";

describe("CopyToClipboardButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  });

  it("renders its children alongside the copy button", () => {
    render(
      <CopyToClipboardButton textToCopy="secret-value">
        <span>label</span>
      </CopyToClipboardButton>,
    );
    expect(screen.getByText("label")).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("copies via the clipboard API in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(
      <CopyToClipboardButton textToCopy="secret-value">
        <span>label</span>
      </CopyToClipboardButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("secret-value"));
  });

  it("falls back to execCommand outside a secure context", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    render(
      <CopyToClipboardButton textToCopy="secret-value">
        <span>label</span>
      </CopyToClipboardButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
  });

  it("resets the copying state after the timeout", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(
      <CopyToClipboardButton textToCopy="x">
        <span>label</span>
      </CopyToClipboardButton>,
    );
    const button = screen.getByRole("button") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.disabled).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(button.disabled).toBe(false);
  });
});
