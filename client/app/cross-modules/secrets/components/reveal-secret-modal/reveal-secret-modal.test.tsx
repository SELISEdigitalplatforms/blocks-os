import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  FakeHttpError,
  SECRET_ID,
  makeSecret,
} from "@/cross-modules/secrets/test-utils/secret.fixtures";

const hoisted = vi.hoisted(() => ({ revealMutate: vi.fn() }));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useRevealSecret: () => ({ mutateAsync: hoisted.revealMutate, isPending: false }),
}));

import { RevealSecretModal } from "./reveal-secret-modal";

const secret = makeSecret();

const renderModal = (onOpenChange = vi.fn()) => {
  // A real client so the test can prove the plaintext never lands in the query cache.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RevealSecretModal open onOpenChange={onOpenChange} secret={secret} />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient, onOpenChange };
};

describe("RevealSecretModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.revealMutate.mockResolvedValue({ secretId: SECRET_ID, value: "super-secret-value" });
  });

  it("reads the value exactly once per open", async () => {
    renderModal();
    await waitFor(() => expect(hoisted.revealMutate).toHaveBeenCalledTimes(1));
    expect(hoisted.revealMutate).toHaveBeenCalledWith(SECRET_ID);
  });

  it("masks the value until the user asks to see it", async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => expect(screen.getByRole("button", { name: "Show value" })).toBeTruthy());
    expect(screen.queryByTestId("secret-value")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show value" }));
    expect(screen.getByTestId("secret-value").textContent).toBe("super-secret-value");

    await user.click(screen.getByRole("button", { name: "Hide value" }));
    expect(screen.queryByTestId("secret-value")).toBeNull();
  });

  it("never puts the plaintext in the query cache", async () => {
    // A useQuery here would cache the value and refetch it on window focus, writing GetValue
    // audit rows nobody asked for.
    const { queryClient } = renderModal();
    await waitFor(() => expect(hoisted.revealMutate).toHaveBeenCalled());

    const cached = JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data));
    expect(cached).not.toContain("super-secret-value");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("copies the value to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    renderModal();
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy value" })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "Copy value" }));

    expect(writeText).toHaveBeenCalledWith("super-secret-value");
  });

  it("tells the caller to close, so the value is dropped with the component", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderModal(onOpenChange);

    await waitFor(() => expect(hoisted.revealMutate).toHaveBeenCalled());
    // `selector` picks the footer button over the dialog's own sr-only close affordance.
    await user.click(screen.getByText("Close", { selector: "button" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the conflict message when the secret is locked", async () => {
    hoisted.revealMutate.mockRejectedValue(
      new FakeHttpError(409, { invalid_state: "locked", reason: "STATUS_LOCKED" }),
    );

    renderModal();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/status has changed/i));
    expect(screen.queryByTestId("secret-value")).toBeNull();
  });

  it("shows a permission message on 403 without offering the value", async () => {
    hoisted.revealMutate.mockRejectedValue(new FakeHttpError(403, {}));

    renderModal();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/do not have permission/i),
    );
  });

  it("says the read was audited", async () => {
    renderModal();
    expect(screen.getByText(/recorded in the audit log/i)).toBeTruthy();
  });
});
