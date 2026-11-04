import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { MailServiceProvider, type IEmailConfig } from "../../../../models/email";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  comboboxProps: [] as Record<string, unknown>[],
}));

vi.mock("../../../../hooks/use-email-config", () => ({
  useSaveEmailConfig: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
// The shared combobox has its own tests; a stand-in records its props and can pick "globex".
vi.mock("@blocks-idp/iam/components/organization-combobox", () => ({
  OrganizationCombobox: (
    props: Record<string, unknown> & { onValueChange: (id: string) => void; value: string },
  ) => {
    h.comboboxProps.push(props);
    return (
      <button
        type="button"
        data-testid="organization-picker"
        onClick={() => props.onValueChange("globex")}
      >
        {props.value}
      </button>
    );
  },
}));

const { default: NewConfiguration } = await import("./new-configuration");

const acme = { id: "acme", name: "Acme Corp" };

const renderModal = (props: Partial<React.ComponentProps<typeof NewConfiguration>> = {}) =>
  render(
    <Dialog open>
      <NewConfiguration dialogTitle="Add Configuration" onClose={vi.fn()} {...props} />
    </Dialog>,
  );

const fillValidOutbound = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText("Enter name"), "Acme Transactional");
  await user.type(screen.getByPlaceholderText("Enter Host"), "smtp.example.com");
  await user.type(screen.getByPlaceholderText("Enter port"), "587");
  await user.type(screen.getByPlaceholderText("Enter sender name"), "Acme Orders");
  await user.type(screen.getByPlaceholderText("Enter sender address"), "orders@acme.example");
  await user.type(screen.getByPlaceholderText("Enter sender username"), "smtp-user");
  await user.type(screen.getByPlaceholderText("Enter password"), "hunter2");
};

const save = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  await user.click(button);
  await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
  return h.mutateAsync.mock.calls[0][0];
};

const stored: IEmailConfig = {
  configurationId: "cfg-1",
  configurationName: "Acme SMTP",
  itemId: "cfg-1",
  name: "Acme SMTP",
  host: "smtp.example.com",
  port: 587,
  enableSSL: true,
  senderName: "Acme Orders",
  senderAddress: "orders@acme.example",
  senderUserName: "smtp-user",
  accountPassword: "",
  isDefault: false,
  isInbound: false,
  provider: MailServiceProvider.AmazonSes,
  organizationId: "acme",
  isOrganizationDefault: false,
};

describe("NewConfiguration organizations", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.comboboxProps = [];
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("keeps the dialog within the viewport and scrolls it, so Save stays reachable", () => {
    renderModal({ organization: acme, organizationHasDefault: false });
    expect(screen.getByRole("dialog").className).toMatch(/max-h-\[90vh\].*overflow-y-auto/);
  });

  it("has no organization field or default checkbox when multi-org is off (H12)", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByText("Organization")).toBeNull();
    expect(screen.queryByText("Use as organization default")).toBeNull();

    await fillValidOutbound(user);
    const payload = await save(user);
    expect(payload.organizationId).toBeUndefined();
    expect(payload.isOrganizationDefault).toBeUndefined();
  });

  it("pre-fills the page's organization and ticks the default when it has none (H9)", async () => {
    const user = userEvent.setup();
    renderModal({ organization: acme, organizationHasDefault: false });

    expect(screen.getByText("Organization")).toBeTruthy();
    expect(screen.getByTestId("organization-picker").textContent).toBe("acme");
    expect(h.comboboxProps.at(-1)).toMatchObject({ value: "acme", projectKey: "tenant-1" });
    expect(
      screen
        .getByRole("checkbox", { name: "Use as organization default" })
        .getAttribute("data-state"),
    ).toBe("checked");
    expect(screen.getByText(/Acme Corp has no default yet/)).toBeTruthy();

    await fillValidOutbound(user);
    const payload = await save(user);
    expect(payload).toMatchObject({ organizationId: "acme", isOrganizationDefault: true });
  });

  it("leaves the default unticked when the organization already has one", () => {
    renderModal({ organization: acme, organizationHasDefault: true });
    expect(
      screen
        .getByRole("checkbox", { name: "Use as organization default" })
        .getAttribute("data-state"),
    ).toBe("unchecked");
  });

  it("unticks the default when another organization is picked, since its default is unknown here", async () => {
    const user = userEvent.setup();
    renderModal({ organization: acme, organizationHasDefault: false });
    const checkbox = screen.getByRole("checkbox", { name: "Use as organization default" });
    expect(checkbox.getAttribute("data-state")).toBe("checked");

    await user.click(screen.getByTestId("organization-picker"));

    await waitFor(() => expect(checkbox.getAttribute("data-state")).toBe("unchecked"));
    expect(screen.queryByText(/Acme Corp has no default yet/)).toBeNull();
  });

  it("doesn't say 'only' for the Default organization, whose configurations are shared", () => {
    renderModal({
      organization: { id: "default", name: "Default organization" },
      organizationHasDefault: true,
    });
    expect(screen.queryByText(/Only Default organization's templates/)).toBeNull();
  });

  it("saves the organization picked in the dialog", async () => {
    const user = userEvent.setup();
    renderModal({ organization: acme, organizationHasDefault: true });

    await user.click(screen.getByTestId("organization-picker"));
    await fillValidOutbound(user);
    const payload = await save(user);
    expect(payload).toMatchObject({ organizationId: "globex", isOrganizationDefault: false });
  });

  it("shows the organization read-only on edit and sends the stored one (C6)", async () => {
    const user = userEvent.setup();
    renderModal({
      isEdit: true,
      previousData: { ...stored, isOrganizationDefault: true },
      organization: acme,
      dialogTitle: "Edit Configuration",
    });

    expect(screen.queryByTestId("organization-picker")).toBeNull();
    const readOnly = screen.getByLabelText(/^Organization/) as HTMLInputElement;
    expect(readOnly.value).toBe("Acme Corp");
    expect(readOnly.readOnly).toBe(true);
    expect(screen.getByText("A configuration's organization can't be changed.")).toBeTruthy();
    expect(
      screen
        .getByRole("checkbox", { name: "Use as organization default" })
        .getAttribute("data-state"),
    ).toBe("checked");

    await user.type(screen.getByPlaceholderText("Enter password"), "hunter2");
    const button = screen.getByRole("button", { name: "Update Changes" }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    await user.click(button);
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      organizationId: "acme",
      isOrganizationDefault: true,
    });
  });

  it("hides the default checkbox for inbound and never sends it as true (C7)", async () => {
    const user = userEvent.setup();
    renderModal({ organization: acme, organizationHasDefault: false });

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Inbound" }));

    await waitFor(() => expect(screen.queryByText("Use as organization default")).toBeNull());
  });

  it("shows the server's organization errors under the field, from English keys", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({
      errors: {
        OrganizationId: "Organization not found",
        IsOrganizationDefault: "An inbound configuration can't be the organization default",
      },
    });
    renderModal({ organization: acme, organizationHasDefault: true });

    await fillValidOutbound(user);
    await save(user);

    expect(await screen.findByText("Organization not found")).toBeTruthy();
    expect(
      screen.getByText("An inbound configuration can't be the organization default"),
    ).toBeTruthy();
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("still toasts other server errors as before", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ errors: { Host: "Invalid host format." } });
    renderModal({ organization: acme, organizationHasDefault: true });

    await fillValidOutbound(user);
    await save(user);

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { Host: "Invalid host format." } }),
    );
  });
});
