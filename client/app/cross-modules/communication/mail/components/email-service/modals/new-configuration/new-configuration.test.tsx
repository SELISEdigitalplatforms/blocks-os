import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { MailServiceProvider, type IEmailConfig } from "../../../../models/email";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("../../../../hooks/use-email-config", () => ({
  useSaveEmailConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: h.toast,
  showErrorToast: h.showErrorToast,
}));

const { default: NewConfiguration } = await import("./new-configuration");

const renderModal = (props: Partial<React.ComponentProps<typeof NewConfiguration>> = {}) =>
  render(
    <Dialog open>
      <NewConfiguration dialogTitle="Add Configuration" onClose={vi.fn()} {...props} />
    </Dialog>,
  );

const fillValidOutbound = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText("Enter name"), "Primary Mailer");
  await user.type(screen.getByPlaceholderText("Enter Host"), "smtp.example.com");
  await user.type(screen.getByPlaceholderText("Enter port"), "587");
  await user.type(screen.getByPlaceholderText("Enter sender name"), "Support Team");
  await user.type(screen.getByPlaceholderText("Enter sender address"), "support@example.com");
  await user.type(screen.getByPlaceholderText("Enter sender username"), "smtp-user");
  await user.type(screen.getByPlaceholderText("Enter password"), "hunter2");
};

describe("NewConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the title and keeps Save disabled until the form is valid", () => {
    renderModal();
    expect(screen.getByText("Add Configuration")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits a valid outbound configuration and reports success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await fillValidOutbound(user);

    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.configurationName).toBe("Primary Mailer");
    expect(payload.host).toBe("smtp.example.com");
    expect(payload.port).toBe(587);
    expect(payload.senderAddress).toBe("support@example.com");
    expect(payload.configurationId).toBe("");
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        description: "Configuration created successfully.",
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a destructive toast when the backend rejects the save", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { host: "invalid" } });
    renderModal();

    await fillValidOutbound(user);
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", title: "Error" }),
      ),
    );
  });

  it("maps structured errors from a thrown HttpError", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ errors: { host: "duplicate" } });
    renderModal();

    await fillValidOutbound(user);
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { host: "duplicate" } }),
    );
  });

  it("shows validation messages for an incomplete form", async () => {
    const user = userEvent.setup();
    renderModal();

    const name = screen.getByPlaceholderText("Enter name");
    await user.type(name, "ab");
    await user.tab();

    expect(
      await screen.findByText("Configuration name must be at least 3 characters"),
    ).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides the sender fields when switching to inbound", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByPlaceholderText("Enter sender name")).toBeTruthy();

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Inbound" }));

    await waitFor(() => expect(screen.queryByPlaceholderText("Enter sender name")).toBeNull());
    expect(screen.getByPlaceholderText("Enter Server Name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter username")).toBeTruthy();
  });

  it("prefills the form in edit mode and labels the success toast as an update", async () => {
    const user = userEvent.setup();
    const previousData: IEmailConfig = {
      configurationId: "cfg-9",
      configurationName: "Existing Config",
      host: "mail.acme.io",
      port: 465,
      enableSSL: true,
      senderName: "Acme Sender",
      senderAddress: "no-reply@acme.io",
      senderUserName: "acme-user",
      accountPassword: "",
      itemId: "cfg-9",
      name: "Existing Config",
      isDefault: false,
      isInbound: false,
      provider: MailServiceProvider.Zoho,
    };
    renderModal({ isEdit: true, previousData, dialogTitle: "Edit Configuration" });

    expect(screen.getByDisplayValue("Existing Config")).toBeTruthy();
    expect(screen.getByDisplayValue("mail.acme.io")).toBeTruthy();

    // Supply the password (never prefilled) to make the form valid, then save.
    await user.type(screen.getByPlaceholderText("Enter password"), "secret1");
    const save = screen.getByRole("button", { name: "Update Changes" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].configurationId).toBe("cfg-9");
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Configuration updated successfully." }),
    );
  });

  it("renders a loading placeholder while an edit target has no id yet", () => {
    const previousData = { itemId: "" } as IEmailConfig;
    renderModal({ isEdit: true, previousData });
    expect(screen.getByText("loading")).toBeTruthy();
  });
});
