import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_CONFIG_ERROR_MESSAGES,
  PROPAGATION_WARNING_MESSAGE,
} from "../constants/notification.constant";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";
import type { INotificationConfigRow } from "../models/notification-config.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  pushSettings: { data: { projectId: "p", enabled: true, hasKey: true }, isLoading: false },
  rootTenantId: "root-tenant",
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: () => h.rootTenantId }));
vi.mock("../hooks/use-notification-config", () => ({
  useSaveNotificationConfig: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("../hooks/use-push-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks/use-push-settings")>()),
  usePushSettings: () => h.pushSettings,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));
vi.mock("./notification-form/audience-pickers", () => ({
  UserPicker: () => <div data-testid="user-picker" />,
  RolePicker: () => <div data-testid="role-picker" />,
  PermissionPicker: () => <div data-testid="permission-picker" />,
}));
vi.mock("./notification-form/push-message-field", () => ({
  PushMessageField: ({ locked, pushReady, onSetUpPush }: Record<string, unknown>) => (
    <div data-testid="push-message" data-locked={String(locked)}>
      {!pushReady && (
        <button type="button" onClick={onSetUpPush as () => void}>
          Set up mobile push
        </button>
      )}
    </div>
  ),
}));

import { NotificationConfigForm } from "./notification-config-form";

const SAVE = { name: "Save" } as const;
const EVENT_NAME = "orders-paid";
const EVENT_NAME_LABEL = "Event name";
const PUSH_MESSAGE_ID = "push-message";
const PROJECT_USERS = "Project users";
const ROW = {
  itemId: "n-1",
  name: EVENT_NAME,
  channelToNotify: 1,
  notificationType: 2,
  notifyMethod: "orders",
  enablePersistence: false,
  kind: 0,
} as INotificationConfigRow;

const renderForm = (previous?: INotificationConfigRow) => {
  const onClose = vi.fn();
  const onSetUpPush = vi.fn();
  render(
    <NotificationConfigForm previous={previous} onClose={onClose} onSetUpPush={onSetUpPush} />,
  );
  return { onClose, onSetUpPush };
};

describe("NotificationConfigForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    h.pushSettings = { data: { projectId: "p", enabled: true, hasKey: true }, isLoading: false };
    h.rootTenantId = "root-tenant";
  });

  it("keeps Save off and shows the reason in the footer until the form is valid", async () => {
    const user = userEvent.setup();
    renderForm();
    const save = screen.getByRole("button", SAVE) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(NOTIFICATION_TEXT.errors.name);

    await user.type(screen.getByLabelText(EVENT_NAME_LABEL), EVENT_NAME);
    expect(save.disabled).toBe(false);

    await user.click(screen.getByLabelText(PROJECT_USERS));
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(NOTIFICATION_TEXT.errors.sendTo);

    await user.click(screen.getByLabelText("Console users"));
    await user.click(screen.getByLabelText("In-app"));
    expect(screen.getByRole("alert").textContent).toContain(NOTIFICATION_TEXT.errors.channel);
  });

  it("saves a new notification with the scope from the two checkboxes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm();
    await user.type(screen.getByLabelText(EVENT_NAME_LABEL), EVENT_NAME);
    await user.click(screen.getByLabelText("Console users"));
    await user.click(screen.getByRole("button", SAVE));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      name: EVENT_NAME,
      projectKey: "tenant-1",
      scope: 2,
      liveEnabled: true,
      pushEnabled: false,
      rateLimitPerMinute: 120,
      audience: { level: 0 },
    });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the Selected pickers only for the Selected level", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByTestId("user-picker")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Selected users" }));
    expect(screen.getByTestId("user-picker")).toBeTruthy();
    expect(screen.getByTestId("role-picker")).toBeTruthy();
    expect(screen.getByTestId("permission-picker")).toBeTruthy();
    expect(screen.getByLabelText(NOTIFICATION_TEXT.alsoNamed)).toBeTruthy();
  });

  it("shows the push message block only when Mobile push is ticked, with the set-up hint when not ready", async () => {
    h.pushSettings = { data: { projectId: null, enabled: false, hasKey: false }, isLoading: false };
    const user = userEvent.setup();
    const { onSetUpPush } = renderForm(ROW);
    expect(screen.queryByTestId(PUSH_MESSAGE_ID)).toBeNull();
    await user.click(screen.getByLabelText("Mobile push"));
    expect(screen.getByTestId(PUSH_MESSAGE_ID)).toBeTruthy();
    expect((screen.getByRole("button", SAVE) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Set up mobile push" }));
    expect(onSetUpPush).toHaveBeenCalled();
  });

  it("locks an existing name and shows a personal notice as account owner only", async () => {
    const user = userEvent.setup();
    renderForm({
      ...ROW,
      name: "iam-new-login",
      isBuiltIn: true,
      audienceLocked: true,
      pushEnabled: true,
    });
    expect(screen.getByText(/Account owner only/)).toBeTruthy();
    expect(screen.queryByLabelText(PROJECT_USERS)).toBeNull();
    expect(screen.queryByRole("button", { name: "Selected users" })).toBeNull();
    expect(screen.getByTestId(PUSH_MESSAGE_ID).dataset.locked).toBe("true");

    await user.click(screen.getByLabelText("Save to inbox"));
    await user.click(screen.getByRole("button", SAVE));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({ enablePersistence: true, itemId: "n-1" });
    expect(payload).not.toHaveProperty("audience");
    expect(payload).not.toHaveProperty("pushTemplate");
  });

  it("lets a built-in change everything except the event name", () => {
    renderForm({ ...ROW, isBuiltIn: true });
    expect(screen.queryByLabelText(EVENT_NAME_LABEL)).toBeNull();
    expect(screen.getByLabelText(PROJECT_USERS)).toBeTruthy();
    expect(screen.getByLabelText("Rate limit per minute")).toBeTruthy();
  });

  it("locks a built-in's developer notes outside the root project, where the server refuses them", async () => {
    const user = userEvent.setup();
    renderForm({ ...ROW, isBuiltIn: true });
    await user.click(screen.getByRole("button", { name: NOTIFICATION_TEXT.developerNotes }));
    expect(screen.getByText(NOTIFICATION_TEXT.developerNotesReadOnly)).toBeTruthy();
    expect(
      (screen.getByLabelText(NOTIFICATION_TEXT.sourceService) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText(NOTIFICATION_TEXT.recommendation) as HTMLTextAreaElement).disabled,
    ).toBe(true);
  });

  it("lets the root project edit a built-in's developer notes", async () => {
    h.rootTenantId = "tenant-1";
    const user = userEvent.setup();
    renderForm({ ...ROW, isBuiltIn: true });
    await user.click(screen.getByRole("button", { name: NOTIFICATION_TEXT.developerNotes }));
    expect(
      (screen.getByLabelText(NOTIFICATION_TEXT.sourceService) as HTMLInputElement).disabled,
    ).toBe(false);
  });

  it("offers Built-in (all projects) on a new notification only in the root project", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: NOTIFICATION_TEXT.developerNotes }));
    expect(screen.queryByLabelText(NOTIFICATION_TEXT.builtInAllProjects)).toBeNull();
  });

  it("warns when the copy to tenants was not queued, and maps a refusal to readable copy", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValueOnce({
      isSuccess: true,
      errors: { Propagation: "Notification_Configuration_Propagation_Not_Queued" },
    });
    const { onClose } = renderForm(ROW);
    await user.click(screen.getByRole("button", SAVE));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "warning", description: PROPAGATION_WARNING_MESSAGE }),
      ),
    );
    expect(onClose).toHaveBeenCalled();

    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { name: "taken" } });
    await user.click(screen.getByRole("button", SAVE));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { name: "taken" },
        customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES,
      }),
    );
  });

  it("shows a generic error when the save throws something unstructured", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValueOnce(new Error("boom"));
    renderForm(ROW);
    await user.click(screen.getByRole("button", SAVE));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });
});
