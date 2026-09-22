import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  MailAuthenticationType,
  MailSecurityMode,
  MailServiceProvider,
  type IEmailConfig,
} from "../../../../models/email";

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

  const selectOffice365 = async (user: ReturnType<typeof userEvent.setup>) => {
    // The provider select is the second combobox; the first is Type.
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByRole("option", { name: "SMTP Office 365" }));
  };

  describe("SMTP Office 365", () => {
    it("offers the provider for outbound and withholds it for inbound", async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getAllByRole("combobox")[1]);
      expect(await screen.findByRole("option", { name: "SMTP Office 365" })).toBeTruthy();
      expect(screen.getByRole("option", { name: "Amazon SES" })).toBeTruthy();
      expect(screen.getByRole("option", { name: "Zoho" })).toBeTruthy();
      await user.keyboard("{Escape}");

      await user.click(screen.getAllByRole("combobox")[0]);
      await user.click(await screen.findByRole("option", { name: "Inbound" }));

      await user.click(screen.getAllByRole("combobox")[1]);
      await waitFor(() =>
        expect(screen.queryByRole("option", { name: "SMTP Office 365" })).toBeNull(),
      );
    });

    it("locks the transport, hides the password controls and shows the OAuth fields", async () => {
      const user = userEvent.setup();
      renderModal();

      await selectOffice365(user);

      const host = (await screen.findByPlaceholderText("Enter Host")) as HTMLInputElement;
      const port = screen.getByPlaceholderText("Enter port") as HTMLInputElement;
      await waitFor(() => expect(host.value).toBe("smtp.office365.com"));
      expect(port.value).toBe("587");
      expect(host.readOnly).toBe(true);
      expect(port.readOnly).toBe(true);

      expect(screen.queryByPlaceholderText("Enter sender username")).toBeNull();
      expect(screen.queryByPlaceholderText("Enter password")).toBeNull();
      expect(screen.queryByText("Enable SSL")).toBeNull();

      expect(screen.getByPlaceholderText("Enter Microsoft Entra tenant ID")).toBeTruthy();
      expect(screen.getByPlaceholderText("Enter client ID")).toBeTruthy();
      expect(screen.getByPlaceholderText("Enter client secret")).toBeTruthy();
      expect(screen.getByPlaceholderText("Enter mailbox address")).toBeTruthy();
    });

    it("keeps Save disabled until every required OAuth field is supplied", async () => {
      const user = userEvent.setup();
      renderModal();

      await selectOffice365(user);
      await user.type(screen.getByPlaceholderText("Enter name"), "Microsoft 365 Primary");
      await user.type(screen.getByPlaceholderText("Enter sender name"), "Contoso Notifications");
      await user.type(
        screen.getByPlaceholderText("Enter sender address"),
        "notifications@contoso.com",
      );

      const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);

      await user.type(
        screen.getByPlaceholderText("Enter Microsoft Entra tenant ID"),
        "contoso-tenant",
      );
      await user.type(screen.getByPlaceholderText("Enter client ID"), "mailer-app");
      await user.type(screen.getByPlaceholderText("Enter mailbox address"), "mailer@contoso.com");
      expect(save.disabled).toBe(true);

      await user.type(screen.getByPlaceholderText("Enter client secret"), "secret-value");
      await waitFor(() => expect(save.disabled).toBe(false));
    });

    it("submits the normalized transport and the OAuth fields, and no password fields", async () => {
      const user = userEvent.setup();
      renderModal();

      await selectOffice365(user);
      await user.type(screen.getByPlaceholderText("Enter name"), "Microsoft 365 Primary");
      await user.type(screen.getByPlaceholderText("Enter sender name"), "Contoso Notifications");
      await user.type(
        screen.getByPlaceholderText("Enter sender address"),
        "notifications@contoso.com",
      );
      await user.type(
        screen.getByPlaceholderText("Enter Microsoft Entra tenant ID"),
        "contoso-tenant",
      );
      await user.type(screen.getByPlaceholderText("Enter client ID"), "mailer-app");
      await user.type(screen.getByPlaceholderText("Enter mailbox address"), "mailer@contoso.com");
      await user.type(screen.getByPlaceholderText("Enter client secret"), "secret-value");

      const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
      await waitFor(() => expect(save.disabled).toBe(false));
      await user.click(save);

      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const payload = h.mutateAsync.mock.calls[0][0];

      expect(payload.provider).toBe(MailServiceProvider.Office365Smtp);
      expect(payload.host).toBe("smtp.office365.com");
      expect(payload.port).toBe(587);
      expect(payload.enableSSL).toBe(false);
      expect(payload.authenticationType).toBe(MailAuthenticationType.OAuthClientCredentials);
      expect(payload.securityMode).toBe(MailSecurityMode.StartTls);
      expect(payload.tenantId).toBe("contoso-tenant");
      expect(payload.clientId).toBe("mailer-app");
      expect(payload.mailboxAddress).toBe("mailer@contoso.com");
      expect(payload.clientSecret).toBe("secret-value");
      expect(payload.senderUserName).toBeUndefined();
      expect(payload.accountPassword).toBeUndefined();
    });

    it("lets an edit keep the secret on file by leaving the field blank", async () => {
      const user = userEvent.setup();
      const previousData = {
        configurationId: "cfg-o365",
        configurationName: "Microsoft 365 Primary",
        host: "smtp.office365.com",
        port: 587,
        enableSSL: false,
        senderName: "Contoso Notifications",
        senderAddress: "notifications@contoso.com",
        senderUserName: "",
        accountPassword: "",
        itemId: "cfg-o365",
        name: "Microsoft 365 Primary",
        isDefault: false,
        isInbound: false,
        provider: MailServiceProvider.Office365Smtp,
        tenantId: "contoso-tenant",
        clientId: "mailer-app",
        mailboxAddress: "mailer@contoso.com",
        isClientSecretConfigured: true,
      } satisfies IEmailConfig;

      renderModal({ isEdit: true, previousData, dialogTitle: "Edit Configuration" });

      // Nothing prefills the secret, and the placeholder says a blank keeps it.
      const secret = screen.getByPlaceholderText(
        "Leave blank to keep the current secret",
      ) as HTMLInputElement;
      expect(secret.value).toBe("");

      const save = screen.getByRole("button", { name: "Update Changes" }) as HTMLButtonElement;
      await waitFor(() => expect(save.disabled).toBe(false));
      await user.click(save);

      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const payload = h.mutateAsync.mock.calls[0][0];
      expect(payload.configurationId).toBe("cfg-o365");
      expect("clientSecret" in payload).toBe(false);
    });

    it("rejects a whitespace-only replacement secret rather than treating it as unchanged", async () => {
      const user = userEvent.setup();
      const previousData = {
        configurationId: "cfg-o365",
        configurationName: "Microsoft 365 Primary",
        host: "smtp.office365.com",
        port: 587,
        enableSSL: false,
        senderName: "Contoso Notifications",
        senderAddress: "notifications@contoso.com",
        senderUserName: "",
        accountPassword: "",
        itemId: "cfg-o365",
        name: "Microsoft 365 Primary",
        isDefault: false,
        isInbound: false,
        provider: MailServiceProvider.Office365Smtp,
        tenantId: "contoso-tenant",
        clientId: "mailer-app",
        mailboxAddress: "mailer@contoso.com",
        isClientSecretConfigured: true,
      } satisfies IEmailConfig;

      renderModal({ isEdit: true, previousData, dialogTitle: "Edit Configuration" });

      await user.type(screen.getByPlaceholderText("Leave blank to keep the current secret"), "   ");

      expect(await screen.findByText("Client secret must not be blank")).toBeTruthy();
      expect(
        (screen.getByRole("button", { name: "Update Changes" }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it("flags an invalid mailbox address", async () => {
      const user = userEvent.setup();
      renderModal();

      await selectOffice365(user);
      await user.type(screen.getByPlaceholderText("Enter mailbox address"), "not-an-email");
      await user.tab();

      expect(await screen.findByText("Mailbox address must be a valid email")).toBeTruthy();
    });
  });
});
