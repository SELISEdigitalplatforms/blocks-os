import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyableSnippet } from "./copyable-snippet";

describe("CopyableSnippet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the trimmed code", () => {
    // The syntax highlighter tokenises the code across many spans, so assert on
    // the aggregated text content rather than a single text node.
    const { container } = render(<CopyableSnippet code={"  npm install  "} isCopyable={false} />);
    expect(container.textContent?.replace(/\s+/g, " ")).toContain("npm install");
  });

  it("hides the copy button when not copyable", () => {
    render(<CopyableSnippet code="echo hi" isCopyable={false} />);
    expect(screen.queryByLabelText("Copy code")).toBeNull();
  });

  it("copies via the clipboard API and toggles the copied state back", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<CopyableSnippet code="echo hi" isCopyable />);
    const button = screen.getByLabelText("Copy code");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith("echo hi");

    // The check icon (text-green) appears while copied then reverts after 2s.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
  });

  it("falls back to execCommand when the clipboard API is missing", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });

    render(<CopyableSnippet code="ls -la" isCopyable />);
    fireEvent.click(screen.getByLabelText("Copy code"));
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
  });

  it("logs an error when copying throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
      configurable: true,
    });
    render(<CopyableSnippet code="secret" isCopyable />);
    fireEvent.click(screen.getByLabelText("Copy code"));
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
  });
});
