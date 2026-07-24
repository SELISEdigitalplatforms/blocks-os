import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  saveSecret: vi.fn(),
  isPending: false,
}));

vi.mock("../../hooks/use-secrets", () => ({
  useSaveSecret: () => ({ mutate: h.saveSecret, isPending: h.isPending }),
}));

import { AddSecretModal } from "./add-secret-modal";

describe("AddSecretModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    // Invoke the success callback so open-state side effects run.
    h.saveSecret.mockImplementation((_payload, opts) => opts?.onSuccess?.());
  });

  it("renders the trigger and opens the create dialog", async () => {
    const user = userEvent.setup();
    render(<AddSecretModal />);
    await user.click(screen.getByRole("button", { name: /Add Secret/i }));
    expect(await screen.findByRole("heading", { name: "Add Secret" })).toBeTruthy();
    expect(screen.getByText(/No properties yet/)).toBeTruthy();
  });

  it("validates the required secret name before saving", async () => {
    const user = userEvent.setup();
    render(<AddSecretModal />);
    await user.click(screen.getByRole("button", { name: /Add Secret/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Secret name is required")).toBeTruthy();
    expect(h.saveSecret).not.toHaveBeenCalled();
  });

  it("saves a new secret with an added key-value property", async () => {
    const user = userEvent.setup();
    render(<AddSecretModal />);
    await user.click(screen.getByRole("button", { name: /Add Secret/i }));
    await user.type(screen.getByPlaceholderText("Enter secret name"), "db-creds");
    await user.click(screen.getByRole("button", { name: /Add Property/i }));
    await user.type(screen.getByPlaceholderText("Key"), "username");
    await user.type(screen.getByPlaceholderText("Value"), "admin");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.saveSecret).toHaveBeenCalledTimes(1));
    const payload = h.saveSecret.mock.calls[0][0];
    expect(payload.secretKey).toBe("my-secret");
    expect(payload.keyValuePairs).toEqual({ secretName: "db-creds", username: "admin" });
    expect(payload.itemId).toBeUndefined();
  });

  it("removes a property row", async () => {
    const user = userEvent.setup();
    render(<AddSecretModal />);
    await user.click(screen.getByRole("button", { name: /Add Secret/i }));
    await user.click(screen.getByRole("button", { name: /Add Property/i }));
    expect(screen.getByPlaceholderText("Key")).toBeTruthy();
    const trash = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"));
    await user.click(trash as HTMLElement);
    expect(screen.queryByPlaceholderText("Key")).toBeNull();
  });

  it("prefills fields in edit mode and includes the itemId on save", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AddSecretModal
        mode="edit"
        editItem={{
          itemId: "secret-1",
          keyValuePairs: { secretName: "api-keys", token: "abc" },
        } as any}
        open
        onOpenChange={onOpenChange}
        hideTrigger
      />,
    );
    expect(screen.getByRole("heading", { name: "Edit Secret" })).toBeTruthy();
    await waitFor(() => expect(screen.getByDisplayValue("api-keys")).toBeTruthy());
    expect(screen.getByDisplayValue("token")).toBeTruthy();
    expect(screen.getByDisplayValue("abc")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.saveSecret).toHaveBeenCalledTimes(1));
    const payload = h.saveSecret.mock.calls[0][0];
    expect(payload.itemId).toBe("secret-1");
    expect(payload.keyValuePairs).toMatchObject({ secretName: "api-keys", token: "abc" });
  });

  it("closes via cancel without saving", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<AddSecretModal open onOpenChange={onOpenChange} hideTrigger />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.saveSecret).not.toHaveBeenCalled();
  });
});
