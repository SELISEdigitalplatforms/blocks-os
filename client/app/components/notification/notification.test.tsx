import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({
  notificationsResult: { data: undefined as unknown, isLoading: false, isFetching: false },
  markAsReadMutate: vi.fn(),
  markAllAsReadMutate: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connectionOn: vi.fn(),
  getNotificationConfig: vi.fn(),
}));

vi.mock("@/hooks/use-notifications", () => ({
  useGetBlocksNotificationConfig: () => ({ data: { configurations: [] } }),
  useGetNotifications: () => h.notificationsResult,
  useMarkAsRead: () => ({ mutate: h.markAsReadMutate }),
  useMarkAllAsRead: () => ({ mutate: h.markAllAsReadMutate }),
}));

vi.mock("@/services/notification.service", () => ({
  notificationService: { getNotificationConfig: h.getNotificationConfig },
}));

vi.mock("@/services/notification-client.service", () => ({
  notificationClientService: {
    connect: h.connect,
    disconnect: h.disconnect,
    connection: { on: h.connectionOn },
  },
}));

import { Notification } from "./notification";
import { createWrapper } from "@/test-utils/test-providers/query-client";

const notice = (
  id: string,
  payload: Record<string, unknown>,
  isRead = false,
  createdTime = "2024-01-01T00:00:00.000Z",
) => ({
  id,
  denormalizedPayload: JSON.stringify(payload),
  createdTime,
  isRead,
});

const renderNotification = () => render(<Notification />, { wrapper: createWrapper() });

describe("Notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.notificationsResult = {
      data: { notifications: [], totalNotificationsCount: 0, unReadNotificationsCount: 0 },
      isLoading: false,
      isFetching: false,
    };
  });

  it("renders the bell and connects the realtime client on mount", () => {
    renderNotification();
    expect(screen.getByTestId("notification-bell")).toBeTruthy();
    expect(h.connect).toHaveBeenCalledTimes(1);
  });

  it("shows the unread count badge", () => {
    h.notificationsResult.data = {
      notifications: [],
      totalNotificationsCount: 0,
      unReadNotificationsCount: 5,
    };
    renderNotification();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("caps the unread badge at 99+", () => {
    h.notificationsResult.data = {
      notifications: [],
      totalNotificationsCount: 0,
      unReadNotificationsCount: 150,
    };
    renderNotification();
    expect(screen.getByText("99+")).toBeTruthy();
  });

  it("shows the empty state when there are no notifications", async () => {
    const user = userEvent.setup();
    renderNotification();
    await user.click(screen.getByTestId("notification-bell"));
    expect(await screen.findByText("No notifications")).toBeTruthy();
  });

  it("renders notification titles and formatted meta descriptions", async () => {
    h.notificationsResult.data = {
      notifications: [
        notice("n1", { title: "kb_update_done", description: "Plain desc", meta: "" }),
        notice("n2", {
          title: "agent_kb_processing_status",
          description: "ignored",
          meta: { status: "processing", kb_id: "abc-123456" },
        }),
      ],
      totalNotificationsCount: 2,
      unReadNotificationsCount: 2,
    };
    const user = userEvent.setup();
    renderNotification();
    await user.click(screen.getByTestId("notification-bell"));

    // formatKBTitle: snake_case -> Title Case
    expect(await screen.findByText("Kb Update Done")).toBeTruthy();
    // formatKBTitle: special-cased key
    expect(screen.getByText("AI Agent Knowledge Update Status")).toBeTruthy();
    // formatKBMetaDescription: fallback description (empty meta string)
    expect(screen.getByText("Plain desc")).toBeTruthy();
    // formatKBMetaDescription: status + shortened kb id
    expect(screen.getByText("Status: Processing | KB Id: abc")).toBeTruthy();
  });

  it("marks all as read when the header action is clicked", async () => {
    h.notificationsResult.data = {
      notifications: [notice("n1", { title: "kb_update_done", description: "d", meta: "" })],
      totalNotificationsCount: 1,
      unReadNotificationsCount: 1,
    };
    const user = userEvent.setup();
    renderNotification();
    await user.click(screen.getByTestId("notification-bell"));

    await user.click(await screen.findByRole("button", { name: "Mark all as read" }));
    expect(h.markAllAsReadMutate).toHaveBeenCalledTimes(1);
  });

  it("marks a single unread notification as read on hover", async () => {
    h.notificationsResult.data = {
      notifications: [notice("n1", { title: "kb_update_done", description: "d", meta: "" }, false)],
      totalNotificationsCount: 1,
      unReadNotificationsCount: 1,
    };
    const user = userEvent.setup();
    renderNotification();
    await user.click(screen.getByTestId("notification-bell"));

    const title = await screen.findByText("Kb Update Done");
    const row = title.closest("div[class*='cursor-pointer']") as HTMLElement;
    fireEvent.mouseEnter(row);
    expect(h.markAsReadMutate).toHaveBeenCalledWith("n1", expect.anything());
  });
});
