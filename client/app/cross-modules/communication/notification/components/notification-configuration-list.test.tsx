import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetNotificationConfigs: vi.fn(),
  deleteConfig: vi.fn(),
  isDeletePending: false,
  toast: vi.fn(),
  setQueryParams: vi.fn(),
  importance: "",
  sendTo: "",
  receivers: "",
  onEdit: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children: ReactNode }) => children;
  return {
    useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: () => null,
    TooltipProvider: Passthrough,
  };
});
vi.mock("../hooks/use-notification-config", () => ({
  useGetNotificationConfigs: (args: unknown) => h.useGetNotificationConfigs(args),
  useDeleteNotificationConfig: () => ({
    mutateAsync: h.deleteConfig,
    isPending: h.isDeletePending,
  }),
}));
vi.mock("./notification-configs-filter-toolbar", () => ({
  useNotificationConfigsFilterQueryParams: () => ({
    queryParams: {
      notificationPage: 0,
      notificationPageSize: 10,
      notificationSearch: "",
      notificationImportance: h.importance,
      notificationSendTo: h.sendTo,
      notificationReceivers: h.receivers,
    },
    setQueryParams: h.setQueryParams,
  }),
  NotificationConfigsFilterToolBar: () => <div data-testid="filter-toolbar" />,
}));
vi.mock("./notification-config-page", () => ({
  NotificationConfigPage: ({ itemId }: { itemId: string }) => (
    <div data-testid="config-page">{itemId || "new"}</div>
  ),
}));
vi.mock("./push-settings-page", () => ({
  PushSettingsPage: () => <div data-testid="push-page" />,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));

import NotificationConfigurationList, {
  NotificationConfigurationListPage,
} from "./notification-configuration-list";
import type { INotificationConfigRow } from "../models/notification-config.model";

const REALTIME_ALERTS = "Realtime alerts";
const PASSWORD_RESET = "Password reset";
const EXPORT_READY = "Export ready";
const LEGACY_CUSTOM = "Legacy custom";

const configurations = [
  {
    itemId: "c-1",
    name: REALTIME_ALERTS,
    channelToNotify: 0,
    notificationType: 1,
    enablePersistence: true,
  },
  {
    itemId: "c-2",
    name: "Push alerts",
    channelToNotify: 1,
    notificationType: 2,
    enablePersistence: false,
  },
] as unknown as INotificationConfigRow[];

const wrapper = ({ children }: { children: ReactNode }) => (
  <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
);

describe("NotificationConfigurationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isDeletePending = false;
    h.importance = "";
    h.sendTo = "";
    h.receivers = "";
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations, totalCount: 2 },
      isLoading: false,
      isFetching: false,
    });
    h.deleteConfig.mockResolvedValue(undefined);
  });

  it("renders a skeleton table while loading", () => {
    render(<NotificationConfigurationList isLoading onEdit={h.onEdit} />, { wrapper });
    expect(document.body.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("shows recipients (merged audience and receivers), source and the channels", () => {
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const headers = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(headers.slice(0, 8)).toEqual([
      "Name",
      "Recipients",
      "Service",
      "Importance",
      "In-app",
      "Mobile push",
      "Inbox",
      "Status",
    ]);
    const row = screen.getByText(REALTIME_ALERTS).closest("tr") as HTMLElement;
    expect(within(row).getByText("Project users")).toBeTruthy();
    expect(within(row).getByText("Event-related users")).toBeTruthy();
    // Old rows keep in-app on and push off; inbox follows the saved flag.
    expect(within(row).getAllByLabelText("Yes")).toHaveLength(2);
    expect(within(row).getAllByLabelText("No")).toHaveLength(1);
    expect(screen.getAllByText("Active")).toHaveLength(2);
  });

  it("opens the edit page from the row and from the row actions", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    await user.click(screen.getByText(REALTIME_ALERTS));
    expect(h.onEdit).toHaveBeenLastCalledWith("c-1");
    const rowMenus = screen.getAllByRole("button").filter((b) => b.className.includes("h-5 w-5"));
    await user.click(rowMenus[1]);
    await user.click(await screen.findByText("Edit"));
    expect(h.onEdit).toHaveBeenLastCalledWith("c-2");
  });

  it("deletes a configuration after confirmation", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const rowMenus = screen.getAllByRole("button").filter((b) => b.className.includes("h-5 w-5"));
    await user.click(rowMenus[0]);
    await user.click(await screen.findByText("Delete"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(h.deleteConfig).toHaveBeenCalledWith("c-1"));
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        description: "Notification deleted.",
      }),
    );
  });

  it("reports a destructive toast when deletion fails", async () => {
    h.deleteConfig.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const rowMenus = screen.getAllByRole("button").filter((b) => b.className.includes("h-5 w-5"));
    await user.click(rowMenus[0]);
    await user.click(await screen.findByText("Delete"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});

describe("NotificationConfigurationListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the empty state when there are no configurations", () => {
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations: [], totalCount: 0 },
      isLoading: false,
      isFetching: false,
    });
    render(<NotificationConfigurationListPage />, { wrapper });
    expect(screen.getByText("No notifications yet")).toBeTruthy();
  });

  it("shows the edit page when a notification id is in the address", () => {
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations, totalCount: 2 },
      isLoading: false,
      isFetching: false,
    });
    render(<NotificationConfigurationListPage />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter searchParams="?notificationEdit=c-2">{children}</NuqsTestingAdapter>
      ),
    });
    expect(screen.getByTestId("config-page").textContent).toBe("c-2");
    expect(screen.queryByText(REALTIME_ALERTS)).toBeNull();
  });

  it("opens the mobile push page that the header button asks for", () => {
    render(<NotificationConfigurationListPage />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter searchParams="?notificationPush=true">{children}</NuqsTestingAdapter>
      ),
    });
    expect(screen.getByTestId("push-page")).toBeTruthy();
    expect(screen.queryByText(REALTIME_ALERTS)).toBeNull();
  });

  it("renders the configuration list when configurations exist", () => {
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations, totalCount: 2 },
      isLoading: false,
      isFetching: false,
    });
    render(<NotificationConfigurationListPage />, { wrapper });
    expect(screen.getByText(REALTIME_ALERTS)).toBeTruthy();
  });
});

describe("NotificationConfigurationList built-in metadata", () => {
  const rows = [
    {
      itemId: "b-1",
      name: PASSWORD_RESET,
      channelToNotify: 0,
      notificationType: 1,
      enablePersistence: true,
      isBuiltIn: true,
      isDisabled: true,
      description: "Sent on reset",
      importance: 3,
      kind: 4,
      sourceService: "blocks-iam",
    },
    {
      itemId: "b-2",
      name: EXPORT_READY,
      channelToNotify: 0,
      notificationType: 1,
      enablePersistence: true,
      isBuiltIn: true,
      importance: 1,
      kind: 1,
      sourceService: "blocks-os",
    },
    {
      itemId: "c-1",
      name: LEGACY_CUSTOM,
      channelToNotify: 1,
      notificationType: 2,
      enablePersistence: false,
    },
  ] as unknown as INotificationConfigRow[];

  beforeEach(() => {
    vi.clearAllMocks();
    h.importance = "";
    h.sendTo = "";
    h.receivers = "";
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations: rows, totalCount: 3 },
      isLoading: false,
      isFetching: false,
    });
  });

  it("tags each row Built-in or Custom and shows the description of a built-in", () => {
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    expect(screen.getAllByText("Built-in")).toHaveLength(2);
    expect(screen.getAllByText("Custom")).toHaveLength(1);
    expect(screen.getByText("Sent on reset")).toBeTruthy();
  });

  it("marks a personal notice with a lock and its owner-only receivers", () => {
    h.useGetNotificationConfigs.mockReturnValue({
      data: {
        configurations: [{ ...rows[0], audienceLocked: true, name: "iam-new-login" }],
        totalCount: 1,
      },
      isLoading: false,
      isFetching: false,
    });
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const row = screen.getByText("iam-new-login").closest("tr") as HTMLElement;
    expect(within(row).getByLabelText("Personal notice")).toBeTruthy();
    expect(within(row).getByText(/Account owner only/)).toBeTruthy();
  });

  it("filters by Send to and Receivers over the loaded rows", () => {
    h.sendTo = "1";
    h.receivers = "2";
    h.useGetNotificationConfigs.mockReturnValue({
      data: {
        configurations: [
          {
            ...rows[0],
            name: "to-console",
            scope: 1,
            audience: { level: 2, userIds: ["u"], roles: [], permissions: [] },
          },
          {
            ...rows[0],
            name: "to-both",
            scope: 2,
            audience: { level: 2, userIds: [], roles: ["r"], permissions: [] },
          },
          {
            ...rows[0],
            name: "project-only",
            scope: 0,
            audience: { level: 2, userIds: [], roles: [], permissions: [] },
          },
          {
            ...rows[0],
            name: "console-all",
            scope: 1,
            audience: { level: 1, userIds: [], roles: [], permissions: [] },
          },
        ],
        totalCount: 4,
      },
      isLoading: false,
      isFetching: false,
    });
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    expect(screen.getByText("to-console")).toBeTruthy();
    expect(screen.getByText("to-both")).toBeTruthy();
    expect(screen.queryByText("project-only")).toBeNull();
    expect(screen.queryByText("console-all")).toBeNull();
    expect(screen.getAllByText("Selected users (1)")).toHaveLength(2);
  });

  it("marks only the disabled row as Inactive", () => {
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    expect(screen.getAllByText("Inactive")).toHaveLength(1);
  });

  it("shows the source service without its prefix and the importance", () => {
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const row = screen.getByText(PASSWORD_RESET).closest("tr") as HTMLElement;
    expect(within(row).getByText("iam")).toBeTruthy();
    expect(within(row).getByText("High")).toBeTruthy();
  });

  it("shows a legacy row without the new fields as a plain custom row", () => {
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const row = screen.getByText(LEGACY_CUSTOM).closest("tr") as HTMLElement;
    expect(within(row).queryByText("Built-in")).toBeNull();
    expect(within(row).queryByText("Inactive")).toBeNull();
  });

  it("filters by importance over the loaded rows", () => {
    h.importance = "3";
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    expect(screen.getByText(PASSWORD_RESET)).toBeTruthy();
    expect(screen.queryByText(EXPORT_READY)).toBeNull();
    expect(screen.queryByText(LEGACY_CUSTOM)).toBeNull();
  });

  it("shows a message when nothing matches the filters", () => {
    h.importance = "2";
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    expect(screen.getByText("No notifications match the current filters.")).toBeTruthy();
  });

  it("offers Edit and Delete for a built-in row; the server decides who may use them", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const row = screen.getByText(PASSWORD_RESET).closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button"));
    expect(await screen.findByText("Edit")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("keeps Delete for a custom row", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const row = screen.getByText(LEGACY_CUSTOM).closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button"));
    expect(await screen.findByText("Delete")).toBeTruthy();
  });

  it("shows readable copy when a built-in delete is refused", async () => {
    h.deleteConfig.mockRejectedValue({
      errors: { ItemId: "Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration" },
    });
    const user = userEvent.setup();
    render(<NotificationConfigurationList onEdit={h.onEdit} />, { wrapper });
    const row = screen.getByText(PASSWORD_RESET).closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button"));
    await user.click(await screen.findByText("Delete"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: expect.stringContaining("root-tenant administrator"),
        }),
      ),
    );
  });
});
