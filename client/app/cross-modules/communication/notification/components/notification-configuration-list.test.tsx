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
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
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
    queryParams: { notificationPage: 0, notificationPageSize: 10, notificationSearch: "" },
    setQueryParams: h.setQueryParams,
  }),
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

  it("renders configuration rows with resolved channel and type labels", () => {
    render(<NotificationConfigurationList />, { wrapper });
    expect(screen.getByText("Realtime alerts")).toBeTruthy();
    expect(screen.getByText("SignalR")).toBeTruthy();
    expect(screen.getByText("BroadcastReceiverType")).toBeTruthy();
    // enablePersistence booleans render as Yes/No.
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("No")).toBeTruthy();
  });

  it("opens the edit modal from the row actions", async () => {
    const user = userEvent.setup();
    render(<NotificationConfigurationList />, { wrapper });
    const rowMenus = screen.getAllByRole("button").filter((b) => b.className.includes("h-5 w-5"));
    await user.click(rowMenus[0]);
    await user.click(await screen.findByText("Edit"));
    expect(await screen.findByText("Edit Configuration")).toBeTruthy();
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
        description: "Configuration deleted successfully",
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
    expect(screen.getByText("No notification configurations found")).toBeTruthy();
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
