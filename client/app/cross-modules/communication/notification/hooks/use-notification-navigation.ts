import { useLocation, useNavigate, useParams } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";

const NOTIFICATION_ROUTE = "secret-management/notification";
export const NOTIFICATION_NEW_SEGMENT = "new";
export const NOTIFICATION_PUSH_SEGMENT = "push";
export const NOTIFICATION_DEVICES_SEGMENT = "devices";
const LEGACY_EDIT = "notificationEdit";
const LEGACY_ADD = "notificationConfig";
const LEGACY_PUSH = "notificationPush";

export type NotificationView =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "push" }
  | { kind: "devices" }
  | { kind: "edit"; id: string };

/** The page a notification path shows: `/notification`, `/notification/new`, `/notification/push` or `/notification/<id>`. */
export const toNotificationView = (segment: string | undefined, sub?: string): NotificationView => {
  if (!segment) return { kind: "list" };
  if (segment === NOTIFICATION_PUSH_SEGMENT && sub === NOTIFICATION_DEVICES_SEGMENT) {
    return { kind: "devices" };
  }
  if (segment === NOTIFICATION_NEW_SEGMENT) return { kind: "new" };
  if (segment === NOTIFICATION_PUSH_SEGMENT) return { kind: "push" };
  return { kind: "edit", id: segment };
};

/**
 * Moves between the notification pages by path. The query string (list search, filters, page) travels along,
 * so going back to the list keeps them.
 */
export const useNotificationNavigation = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const scoped = useScopedPath();

  const go = (segment?: string, options?: { replace?: boolean; search?: string }) =>
    navigate(
      {
        pathname: scoped(
          segment
            ? `${NOTIFICATION_ROUTE}/${segment.split("/").map(encodeURIComponent).join("/")}`
            : NOTIFICATION_ROUTE,
        ),
        search: options?.search ?? search,
      },
      { replace: options?.replace ?? false },
    );

  return {
    openList: () => go(),
    openNew: () => go(NOTIFICATION_NEW_SEGMENT),
    openPush: () => go(NOTIFICATION_PUSH_SEGMENT),
    openDevices: () => go(`${NOTIFICATION_PUSH_SEGMENT}/${NOTIFICATION_DEVICES_SEGMENT}`),
    openEdit: (id: string) => go(id),
    /** Old `?notificationEdit=<id>` / `?notificationConfig` / `?notificationPush` links → the path, other params kept. */
    redirectLegacyLink: () => {
      const params = new URLSearchParams(search);
      const editId = params.get(LEGACY_EDIT);
      let target: string | null = null;
      if (editId) target = editId;
      else if (params.get(LEGACY_ADD) === "true") target = NOTIFICATION_NEW_SEGMENT;
      else if (params.get(LEGACY_PUSH) === "true") target = NOTIFICATION_PUSH_SEGMENT;
      if (target === null) return;
      for (const key of [LEGACY_EDIT, LEGACY_ADD, LEGACY_PUSH]) params.delete(key);
      const rest = params.toString();
      go(target, { replace: true, search: rest ? `?${rest}` : "" });
    },
  };
};

/** The view of the current notification route. */
export const useNotificationView = (): NotificationView => {
  const { notificationId, notificationSub } = useParams();
  return toNotificationView(notificationId, notificationSub);
};
