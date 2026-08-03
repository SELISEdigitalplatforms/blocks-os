import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
}));

vi.mock("@blocks-idp/iam/security/hooks/use-generate-pats", () => ({
  useGeneratePats: () => ({
    mutate: h.mutate,
    isPending: h.isPending,
    isError: h.isError,
  }),
}));

import { GenerateTokenModal } from "./generate-pat-modal";

const renderModal = (props: Partial<Parameters<typeof GenerateTokenModal>[0]> = {}) =>
  render(
    <GenerateTokenModal
      isOpen={props.isOpen ?? true}
      onClose={props.onClose ?? vi.fn()}
      id={props.id ?? "user-1"}
      onSuccess={props.onSuccess}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
  h.isError = false;
});

describe("GenerateTokenModal", () => {
  it("renders the title and inputs when open", () => {
    renderModal();
    expect(screen.getByText("Generate Token")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write here ...")).toBeTruthy();
  });

  it("does not generate a token when the name is empty", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("generates a token with the entered name and computed ttl", () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("Write here ..."), {
      target: { value: "ci token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(h.mutate).toHaveBeenCalledTimes(1);
    const [payload] = h.mutate.mock.calls[0];
    expect(payload).toMatchObject({ note: "ci token", codeTtlInMinute: 30 * 24 * 60 });
    expect(typeof payload.clientId).toBe("string");
  });

  it("invokes onClose and onSuccess when the mutation resolves", () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const generated = { id: "pat-1" };
    h.mutate.mockImplementation((_payload, opts) => opts.onSuccess([generated]));
    renderModal({ onClose, onSuccess });
    fireEvent.change(screen.getByPlaceholderText("Write here ..."), {
      target: { value: "token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(onSuccess).toHaveBeenCalledWith(generated);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes without generating when cancel is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("shows the error banner when the mutation errored", () => {
    h.isError = true;
    renderModal();
    expect(
      screen.getByText("Failed to generate token. Please try again."),
    ).toBeTruthy();
  });

  it("shows the pending label while generating", () => {
    h.isPending = true;
    renderModal();
    expect(screen.getByText("Generating...")).toBeTruthy();
  });

  it("reads the client id from the configured IAM client", () => {
    vi.stubEnv("BLOCKS_IAM_CLIENT_ID", "iam-client-1");
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("Write here ..."), { target: { value: "tok" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(h.mutate.mock.calls[0][0].clientId).toBe("iam-client-1");
    vi.unstubAllEnvs();
  });

  it("falls back to an empty client id when none is configured", () => {
    vi.stubEnv("BLOCKS_IAM_CLIENT_ID", "");
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("Write here ..."), { target: { value: "tok" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(h.mutate.mock.calls[0][0].clientId).toBe("");
    vi.unstubAllEnvs();
  });

  it("does not generate when the name is only whitespace", () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("Write here ..."), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(h.mutate).not.toHaveBeenCalled();
  });
});
