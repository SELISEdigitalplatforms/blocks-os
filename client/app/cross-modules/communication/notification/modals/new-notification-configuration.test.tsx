import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { INotificationConfigRow } from "../models/notification-config.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("../hooks/use-notification-config", () => ({
  useSaveNotificationConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

const { default: NewNotificationConfiguration } = await import("./new-notification-configuration");

const renderModal = (
  props: Partial<React.ComponentProps<typeof NewNotificationConfiguration>> = {},
) =>
  render(
    <Dialog open>
      <NewNotificationConfiguration
        dialogTitle="Add Configuration"
        onClose={vi.fn()}
        isEdit={false}
        {...props}
      />
    </Dialog>,
  );

const fillValid = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText("Enter name"), "Broadcast Alerts");
  await user.type(screen.getByPlaceholderText("Enter notify method"), "push-notify");
};

describe("NewNotificationConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("keeps Save disabled until the required fields are valid", () => {
    renderModal();
    expect(screen.getByText("Add Configuration")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits a new configuration and reports success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await fillValid(user);
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "Broadcast Alerts",
      notifyMethod: "push-notify",
      projectKey: "tenant-1",
      itemId: undefined,
    });
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "New configuration added" }),
    );
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("captures the chosen notification type", async () => {
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    // The notification-type select is the only enabled combobox.
    await user.click(screen.getByRole("combobox", { name: /notification type/i }));
    await user.click(await screen.findByRole("option", { name: "UserSpecificReceiverType" }));

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].notificationType).toBe(2);
  });

  it("shows a validation message for a too-short name", async () => {
    const user = userEvent.setup();
    renderModal();

    const name = screen.getByPlaceholderText("Enter name");
    await user.type(name, "ab");
    await user.tab();

    expect(
      await screen.findByText("Configuration name must be at least 3 characters"),
    ).toBeTruthy();
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { name: "taken" } });
    renderModal();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { name: "taken" } }));
  });

  it("maps structured errors thrown by the save", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ errors: { notifyMethod: "bad" } });
    renderModal();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { notifyMethod: "bad" } }),
    );
  });

  it("falls back to a generic error for an unstructured throw", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderModal();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("prefills and disables the name in edit mode and labels the update toast", async () => {
    const user = userEvent.setup();
    const previousData: INotificationConfigRow = {
      itemId: "cfg-7",
      name: "Existing Config",
      channelToNotify: 0,
      notificationType: 1,
      enablePersistence: true,
      notifyMethod: "existing-method",
    } as INotificationConfigRow;
    renderModal({ isEdit: true, previousData, dialogTitle: "Edit Configuration" });

    expect((screen.getByPlaceholderText("Enter name") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByDisplayValue("Existing Config")).toBeTruthy();

    // Editing the notify method keeps the form valid before saving.
    const method = screen.getByPlaceholderText("Enter notify method");
    await user.clear(method);
    await user.type(method, "updated-method");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].itemId).toBe("cfg-7");
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Configuration updated" }),
    );
  });

  it("renders a loading placeholder for an edit target without an id", () => {
    const previousData = { itemId: "" } as INotificationConfigRow;
    renderModal({ isEdit: true, previousData });
    expect(screen.getByText("loading")).toBeTruthy();
  });
});
