import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { NOTIFICATION_CONFIG_ERROR_MESSAGES } from "../constants/notification.constant";
import type { INotificationConfigRow } from "../models/notification-config.model";

const NAME_PLACEHOLDER = "Enter name";
const METHOD_PLACEHOLDER = "Enter notify method";
const SAVE_CHANGES = "Save changes";
const CHECKED = "true";
const ARIA_CHECKED = "aria-checked";
const SENDER_DECIDES = "Code that sends it decides";

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
vi.mock("../hooks/use-audience-options", () => ({
  useAudienceOptions: (kind: string) => ({
    isLoading: false,
    options: [
      { value: `${kind}-1`, label: `${kind} one` },
      { value: `${kind}-2`, label: `${kind} two` },
    ],
  }),
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
  await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), "Broadcast Alerts");
  await user.type(screen.getByPlaceholderText(METHOD_PLACEHOLDER), "push-notify");
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
      expect.objectContaining({
        variant: "success",
        description: "New configuration added successfully.",
      }),
    );
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("captures the chosen notification type", async () => {
    const user = userEvent.setup();
    renderModal();
    await fillValid(user);

    // The notification-type select is the only enabled combobox.
    await user.click(screen.getByRole("combobox", { name: /receiver/i }));
    await user.click(await screen.findByRole("option", { name: "Users" }));

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].notificationType).toBe(2);
  });

  it("shows a validation message for a too-short name", async () => {
    const user = userEvent.setup();
    renderModal();

    const name = screen.getByPlaceholderText(NAME_PLACEHOLDER);
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

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { name: "taken" },
        customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES,
      }),
    );
  });

  it("maps structured errors thrown by the save", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ errors: { notifyMethod: "bad" } });
    renderModal();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { notifyMethod: "bad" },
        customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES,
      }),
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

    expect((screen.getByPlaceholderText(NAME_PLACEHOLDER) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByDisplayValue("Existing Config")).toBeTruthy();

    // Editing the notify method keeps the form valid before saving.
    const method = screen.getByPlaceholderText(METHOD_PLACEHOLDER);
    await user.clear(method);
    await user.type(method, "updated-method");
    await user.click(screen.getByRole("button", { name: SAVE_CHANGES }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].itemId).toBe("cfg-7");
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Configuration updated successfully." }),
    );
  });

  it("renders a loading placeholder for an edit target without an id", () => {
    const previousData = { itemId: "" } as INotificationConfigRow;
    renderModal({ isEdit: true, previousData });
    expect(screen.getByText("loading")).toBeTruthy();
  });

  describe("built-in configurations", () => {
    const builtIn = (over: Partial<INotificationConfigRow> = {}) =>
      ({
        itemId: "b-1",
        name: "Password reset",
        channelToNotify: 0,
        notificationType: 1,
        enablePersistence: true,
        notifyMethod: "send-reset",
        isBuiltIn: true,
        description: "Sent when a user resets a password",
        importance: 3,
        kind: 4,
        sourceService: "blocks-iam",
        consumerAppRecommendation: "Show a banner",
        consumerAppNote: "Send the email yourself",
        ...over,
      }) as INotificationConfigRow;

    const edit = (data: INotificationConfigRow) =>
      renderModal({ isEdit: true, previousData: data, dialogTitle: "Edit Configuration" });
    const openMore = () =>
      userEvent.setup().click(screen.getByRole("button", { name: /more options/i }));

    it("shows a legacy row without the new fields as custom and enabled", async () => {
      edit({
        itemId: "l-1",
        name: "Legacy",
        channelToNotify: 0,
        notificationType: 1,
        enablePersistence: false,
        notifyMethod: "legacy-method",
      } as INotificationConfigRow);
      expect(screen.queryByText("Built-in")).toBeNull();
      expect(screen.getByRole("switch").getAttribute(ARIA_CHECKED)).toBe(CHECKED);
      expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByPlaceholderText(METHOD_PLACEHOLDER) as HTMLInputElement).disabled).toBe(
        false,
      );
      await openMore();
      expect((screen.getByLabelText("Recommendation for apps") as HTMLTextAreaElement).value).toBe(
        "",
      );
    });

    it("leaves the fields of a built-in editable; the server decides who may save", async () => {
      edit(builtIn());
      expect(screen.getByText("Built-in")).toBeTruthy();
      expect((screen.getByPlaceholderText(NAME_PLACEHOLDER) as HTMLInputElement).disabled).toBe(
        true,
      );
      expect((screen.getByPlaceholderText(METHOD_PLACEHOLDER) as HTMLInputElement).disabled).toBe(
        false,
      );
      expect((screen.getByLabelText("Description") as HTMLTextAreaElement).disabled).toBe(false);
      expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe(
        "Sent when a user resets a password",
      );
      await openMore();
      expect((screen.getByLabelText("Recommendation for apps") as HTMLTextAreaElement).value).toBe(
        "Show a banner",
      );
      expect(
        (screen.getByLabelText(/Note for apps without the portal/) as HTMLTextAreaElement).value,
      ).toBe("Send the email yourself");
      expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
    });

    it("sends only isDisabled when the user turns a built-in off", async () => {
      const user = userEvent.setup();
      edit(builtIn());
      await user.click(screen.getByRole("switch"));
      await user.click(screen.getByRole("button", { name: SAVE_CHANGES }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const payload = h.mutateAsync.mock.calls[0][0];
      expect(payload.isDisabled).toBe(true);
      for (const key of [
        "description",
        "importance",
        "kind",
        "sourceService",
        "consumerAppRecommendation",
        "consumerAppNote",
        "isBuiltIn",
        "scope",
        "audience",
      ]) {
        expect(payload).not.toHaveProperty(key);
      }
    });

    it.each([1, 2])("has no switch for a built-in of kind %i and says why", (kind) => {
      edit(builtIn({ kind }));
      expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText("Always on: a page waits for this result")).toBeTruthy();
    });

    it("keeps the switch for a custom config of kind Job", () => {
      edit(builtIn({ isBuiltIn: false, kind: 1 }));
      expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
    });

    it("sends only the description when a custom config changes it", async () => {
      const user = userEvent.setup();
      edit(builtIn({ isBuiltIn: false, kind: 0, importance: 0, sourceService: null }));
      const description = screen.getByLabelText("Description");
      await user.clear(description);
      await user.type(description, "New text");
      await user.click(screen.getByRole("button", { name: SAVE_CHANGES }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ description: "New text" });
      expect(h.mutateAsync.mock.calls[0][0]).not.toHaveProperty("importance");
    });

    it("keeps the old payload shape when a new custom config fills no new field", async () => {
      const user = userEvent.setup();
      renderModal();
      await fillValid(user);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const keys = Object.keys(h.mutateAsync.mock.calls[0][0]).filter(
        (k) => h.mutateAsync.mock.calls[0][0][k] !== undefined,
      );
      const byName = (a: string, b: string) => a.localeCompare(b);
      expect([...keys].sort(byName)).toEqual(
        [
          "channelToNotify",
          "enablePersistence",
          "name",
          "notificationType",
          "notifyMethod",
          "projectKey",
        ].sort(byName),
      );
    });

    it("sends the description of a new config when the user fills it", async () => {
      const user = userEvent.setup();
      renderModal();
      await fillValid(user);
      await user.type(screen.getByLabelText("Description"), "Hello");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ description: "Hello" });
    });

    it("sends only the changed metadata field of a built-in", async () => {
      const user = userEvent.setup();
      edit(builtIn());
      await user.click(screen.getByRole("button", { name: /more options/i }));
      const service = screen.getByLabelText("Source service") as HTMLInputElement;
      expect(service.disabled).toBe(false);
      expect((screen.getByPlaceholderText(METHOD_PLACEHOLDER) as HTMLInputElement).disabled).toBe(
        false,
      );
      await user.clear(service);
      await user.type(service, "blocks-os");
      await user.click(screen.getByRole("button", { name: SAVE_CHANGES }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const payload = h.mutateAsync.mock.calls[0][0];
      expect(payload.sourceService).toBe("blocks-os");
      expect(payload).not.toHaveProperty("description");
      expect(payload).not.toHaveProperty("isDisabled");
    });

    it("sends isBuiltIn when the user marks a new config as built-in", async () => {
      const user = userEvent.setup();
      renderModal();
      await fillValid(user);
      await user.click(screen.getByLabelText(/Built-in/));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync.mock.calls[0][0].isBuiltIn).toBe(true);
    });

    it("sends no isBuiltIn when the checkbox is left unticked", async () => {
      const user = userEvent.setup();
      renderModal();
      await fillValid(user);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync.mock.calls[0][0]).not.toHaveProperty("isBuiltIn");
    });

    it.each(Object.keys(NOTIFICATION_CONFIG_ERROR_MESSAGES))(
      "passes readable copy for the %s refusal",
      async (key) => {
        const user = userEvent.setup();
        h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { field: key } });
        edit(builtIn());
        await user.click(screen.getByRole("switch"));
        await user.click(screen.getByRole("button", { name: SAVE_CHANGES }));
        await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
        const call = h.showErrorToast.mock.calls[0][0];
        expect(call.customMessages[key]).toContain(" ");
        expect(call.errors).toEqual({ field: key });
      },
    );

    it("warns when a root save succeeded but the copy to tenants was not queued", async () => {
      const user = userEvent.setup();
      h.mutateAsync.mockResolvedValue({
        isSuccess: true,
        errors: { Propagation: "Notification_Configuration_Propagation_Not_Queued" },
      });
      renderModal();
      await fillValid(user);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(h.toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "warning",
            description: "Saved, but not copied to tenants yet. Save again to retry.",
          }),
        ),
      );
      expect(h.showErrorToast).not.toHaveBeenCalled();
    });

    describe("who receives", () => {
      const WHO = "Only these people";
      const saveAndGet = async (user: ReturnType<typeof userEvent.setup>, label = "Save") => {
        await user.click(screen.getByRole("button", { name: label }));
        await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
        return h.mutateAsync.mock.calls[0][0];
      };

      it("starts on 'Code that sends it decides' and sends no audience", async () => {
        const user = userEvent.setup();
        renderModal();
        await fillValid(user);
        expect(
          (screen.getByRole("radio", { name: SENDER_DECIDES }) as HTMLButtonElement).getAttribute(
            ARIA_CHECKED,
          ),
        ).toBe(CHECKED);
        expect(await saveAndGet(user)).not.toHaveProperty("audience");
      });

      it("sends everyone in the project with the narrow-only hint", async () => {
        const user = userEvent.setup();
        renderModal();
        await fillValid(user);
        await user.click(screen.getByRole("radio", { name: "Everyone in this project" }));
        expect(
          screen.getByText("Code that sends this notification can only narrow this list."),
        ).toBeTruthy();
        const payload = await saveAndGet(user);
        expect(payload.audience).toMatchObject({
          everyoneInTenant: true,
          userIds: [],
          filters: [],
        });
      });

      it("shows the rule pickers only for 'Only these people' and keeps Save off until a rule exists", async () => {
        const user = userEvent.setup();
        renderModal();
        await fillValid(user);
        expect(screen.queryByRole("button", { name: "Roles picker" })).toBeNull();
        await user.click(screen.getByRole("radio", { name: WHO }));
        for (const label of ["Users", "Organizations", "Roles", "Permissions"]) {
          expect(screen.getByRole("button", { name: `${label} picker` })).toBeTruthy();
        }
        await waitFor(() =>
          expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
            true,
          ),
        );
      });

      it("sends the picked roles and the match mode", async () => {
        const user = userEvent.setup();
        renderModal();
        await fillValid(user);
        await user.click(screen.getByRole("radio", { name: WHO }));
        await user.click(screen.getByRole("combobox", { name: /^Match$/ }));
        await user.click(await screen.findByRole("option", { name: "All rules" }));
        await user.click(screen.getByRole("button", { name: "Roles picker" }));
        await user.click(await screen.findByRole("checkbox", { name: /roles one/ }));
        await user.keyboard("{Escape}");
        const payload = await saveAndGet(user);
        expect(payload.audience).toMatchObject({
          everyoneInTenant: false,
          match: 1,
          roles: ["roles-1"],
        });
      });

      it("adds and removes filter rows, needs a context, and stops at 20", async () => {
        const user = userEvent.setup();
        renderModal();
        await fillValid(user);
        await user.click(screen.getByRole("radio", { name: WHO }));
        const add = screen.getByRole("button", { name: /Add filter/ }) as HTMLButtonElement;
        await user.click(add);
        await user.click(add);
        expect(screen.getByLabelText("Filter 2 context")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Remove filter 1" }));
        expect(screen.queryByLabelText("Filter 2 context")).toBeNull();
        // A filter without a context is not valid.
        await waitFor(() =>
          expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
            true,
          ),
        );
        await user.type(screen.getByLabelText("Filter 1 context"), "order");
        await waitFor(() =>
          expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
            false,
          ),
        );
        for (let i = 0; i < 19; i++) await user.click(add);
        expect(add.disabled).toBe(true);
        expect(screen.getAllByLabelText(/Filter \d+ context/)).toHaveLength(20);
      }, 30000);

      it("prefills a stored audience and clears it when the user picks 'Code that sends it decides'", async () => {
        const user = userEvent.setup();
        edit(
          builtIn({
            audience: {
              everyoneInTenant: false,
              match: 0,
              userIds: [],
              organizationIds: [],
              roles: ["admin"],
              permissions: [],
              filters: [],
            },
          }),
        );
        expect(screen.getByRole("radio", { name: WHO }).getAttribute(ARIA_CHECKED)).toBe(CHECKED);
        await user.click(screen.getByRole("radio", { name: SENDER_DECIDES }));
        const payload = await saveAndGet(user, SAVE_CHANGES);
        expect(payload.audience).toEqual({
          everyoneInTenant: false,
          match: 0,
          userIds: [],
          organizationIds: [],
          roles: [],
          permissions: [],
          filters: [],
        });
      });

      it("lets a built-in change only its audience: nothing else is sent", async () => {
        const user = userEvent.setup();
        edit(builtIn());
        await user.click(screen.getByRole("radio", { name: "Everyone in this project" }));
        const payload = await saveAndGet(user, SAVE_CHANGES);
        expect(payload.audience.everyoneInTenant).toBe(true);
        for (const key of [
          "isBuiltIn",
          "scope",
          "isDisabled",
          "description",
          "importance",
          "kind",
        ]) {
          expect(payload).not.toHaveProperty(key);
        }
      });
    });

    describe("scope", () => {
      it("shows the scope select only for a built-in and sends it when changed", async () => {
        const user = userEvent.setup();
        renderModal();
        await fillValid(user);
        expect(screen.queryByRole("combobox", { name: "Scope" })).toBeNull();
        await user.click(screen.getByLabelText(/Built-in/));
        await user.click(screen.getByRole("combobox", { name: "Scope" }));
        await user.click(await screen.findByRole("option", { name: /Console/ }));
        await user.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
        expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ isBuiltIn: true, scope: 1 });
      });
    });
  });
});
