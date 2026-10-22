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
  service: "",
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
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
      notificationService: h.service,
    },
    setQueryParams: h.setQueryParams,
  }),
  NotificationConfigsFilterToolBar: () => <div data-testid="filter-toolbar" />,
}));
vi.mock("../modals/new-notification-configuration", () => ({
  default: ({ dialogTitle }: { dialogTitle: string }) => (
    <div data-testid="notification-config-modal">{dialogTitle}</div>
  ),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));

import NotificationConfigurationList, {
  NotificationConfigurationListPage,
} from "./notification-configuration-list";
import type { INotificationConfigRow } from "../models/notification-config.model";

const configurations = [
  {
    itemId: "c-1",
    name: "Realtime alerts",
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
    h.service = "";
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations, totalCount: 2 },
      isLoading: false,
      isFetching: false,
    });
    h.deleteConfig.mockResolvedValue(undefined);
  });

  it("renders a skeleton table while loading", () => {
    render(<NotificationConfigurationList isLoading />, { wrapper });
    expect(document.body.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("renders configuration rows with short receiver labels and status", () => {
    render(<NotificationConfigurationList />, { wrapper });
    expect(screen.getByText("Realtime alerts")).toBeTruthy();
    expect(screen.getByText("Broadcast")).toBeTruthy();
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getAllByText("On")).toHaveLength(2);
  });

  it("opens the edit modal from the row actions", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList />, { wrapper });
    const rowMenus = screen.getAllByRole("button").filter((b) => b.className.includes("h-5 w-5"));
    await user.click(rowMenus[0]);
    await user.click(await screen.findByText("Edit"));
    expect(await screen.findByText("Edit notification")).toBeTruthy();
  });

  it("deletes a configuration after confirmation", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList />, { wrapper });
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
    render(<NotificationConfigurationList />, { wrapper });
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

  it("renders the configuration list when configurations exist", () => {
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations, totalCount: 2 },
      isLoading: false,
      isFetching: false,
    });
    render(<NotificationConfigurationListPage />, { wrapper });
    expect(screen.getByText("Realtime alerts")).toBeTruthy();
  });
});

describe("NotificationConfigurationList built-in metadata", () => {
  const rows = [
    {
      itemId: "b-1",
      name: "Password reset",
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
      name: "Export ready",
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
      name: "Legacy custom",
      channelToNotify: 1,
      notificationType: 2,
      enablePersistence: false,
    },
  ] as unknown as INotificationConfigRow[];

  beforeEach(() => {
    vi.clearAllMocks();
    h.importance = "";
    h.service = "";
    h.useGetNotificationConfigs.mockReturnValue({
      data: { configurations: rows, totalCount: 3 },
      isLoading: false,
      isFetching: false,
    });
  });

  it("marks built-in rows and shows importance, kind, service and description", () => {
    render(<NotificationConfigurationList />, { wrapper });
    expect(screen.getAllByText("Built-in")).toHaveLength(2);
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("Job")).toBeTruthy();
    expect(screen.getByText("iam")).toBeTruthy();
    expect(screen.getByText("Sent on reset")).toBeTruthy();
  });

  it("marks only the disabled row as Off", () => {
    render(<NotificationConfigurationList />, { wrapper });
    expect(screen.getAllByText("Off")).toHaveLength(1);
  });

  it("shows a legacy row without the new fields as a plain custom row", () => {
    render(<NotificationConfigurationList />, { wrapper });
    const row = screen.getByText("Legacy custom").closest("tr") as HTMLElement;
    expect(within(row).queryByText("Built-in")).toBeNull();
    expect(within(row).queryByText("Off")).toBeNull();
  });

  it("filters by importance over the loaded rows", () => {
    h.importance = "3";
    render(<NotificationConfigurationList />, { wrapper });
    expect(screen.getByText("Password reset")).toBeTruthy();
    expect(screen.queryByText("Export ready")).toBeNull();
    expect(screen.queryByText("Legacy custom")).toBeNull();
  });

  it("filters by service and shows a message when nothing matches", () => {
    h.service = "blocks-os";
    const { unmount } = render(<NotificationConfigurationList />, { wrapper });
    expect(screen.getByText("Export ready")).toBeTruthy();
    expect(screen.queryByText("Password reset")).toBeNull();
    unmount();
    h.service = "nope";
    render(<NotificationConfigurationList />, { wrapper });
    expect(screen.getByText("No configurations match the current filters.")).toBeTruthy();
  });

  it("offers Edit and Delete for a built-in row; the server decides who may use them", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList />, { wrapper });
    const row = screen.getByText("Password reset").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button"));
    expect(await screen.findByText("Edit")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("keeps Delete for a custom row", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList />, { wrapper });
    const row = screen.getByText("Legacy custom").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button"));
    expect(await screen.findByText("Delete")).toBeTruthy();
  });

  it("shows readable copy when a built-in delete is refused", async () => {
    h.deleteConfig.mockRejectedValue({
      errors: { ItemId: "Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration" },
    });
    const user = userEvent.setup();
    render(<NotificationConfigurationList />, { wrapper });
    const row = screen.getByText("Password reset").closest("tr") as HTMLElement;
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
