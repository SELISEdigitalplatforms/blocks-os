import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const mutate = vi.fn();
let isErrorState = false;

vi.mock("@blocks-idp/iam/hooks/use-activity", () => ({
  useGeneratePats: () => ({
    mutate,
    isPending: false,
    isError: isErrorState,
  }),
}));

import { GenerateTokenModal } from "./generate-pat-modal";

describe("GenerateTokenModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isErrorState = false;
  });

  it("renders the dialog heading and description when open", () => {
    render(
      <GenerateTokenModal isOpen onClose={vi.fn()} id="user-1" />,
    );
    expect(screen.getByText("Generate Token")).toBeTruthy();
    expect(
      screen.getByText(
        "Create a secure access token for authentication and API use.",
      ),
    ).toBeTruthy();
  });

  it("disables Generate until a PAT name is entered", async () => {
    const user = userEvent.setup();
    render(<GenerateTokenModal isOpen onClose={vi.fn()} id="user-1" />);

    const generate = screen.getByRole("button", {
      name: "Generate",
    }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);

    await user.type(screen.getByPlaceholderText("Write here ..."), "CI token");
    expect(generate.disabled).toBe(false);
  });

  it("generates a token with the expected payload and closes on success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(
      <GenerateTokenModal
        isOpen
        onClose={onClose}
        id="user-1"
        onSuccess={onSuccess}
      />,
    );

    await user.type(screen.getByPlaceholderText("Write here ..."), "CI token");
    await user.click(screen.getByRole("button", { name: "Generate" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [payload, callbacks] = mutate.mock.calls[0];
    expect(payload).toMatchObject({
      note: "CI token",
      // default expiration of 30 days expressed in minutes
      codeTtlInMinute: 30 * 24 * 60,
    });
    expect(typeof payload.clientId).toBe("string");

    // Simulate the mutation succeeding.
    callbacks.onSuccess({ token: "abc" });
    expect(onSuccess).toHaveBeenCalledWith({ token: "abc" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not submit when the name is only whitespace", async () => {
    const user = userEvent.setup();
    render(<GenerateTokenModal isOpen onClose={vi.fn()} id="user-1" />);
    // Button stays disabled for whitespace-only input, so no mutation fires.
    await user.type(screen.getByPlaceholderText("Write here ..."), "   ");
    const generate = screen.getByRole("button", {
      name: "Generate",
    }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows an error banner when the mutation is in an error state", () => {
    isErrorState = true;
    render(<GenerateTokenModal isOpen onClose={vi.fn()} id="user-1" />);
    expect(
      screen.getByText("Failed to generate token. Please try again."),
    ).toBeTruthy();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GenerateTokenModal isOpen onClose={onClose} id="user-1" />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
