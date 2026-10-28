import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Button } from "@/components/ui-kits/button/button";
import { useGetNotificationConfig } from "../hooks/use-notification-config";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";
import { NotificationConfigForm } from "./notification-config-form";

interface NotificationConfigPageProps {
  /** The row to edit; empty for a new notification. */
  itemId: string;
  onClose: () => void;
  onSetUpPush: () => void;
}

/** Loads the notification to edit, then shows the form; a new notification needs no load. */
export function NotificationConfigPage({
  itemId,
  onClose,
  onSetUpPush,
}: Readonly<NotificationConfigPageProps>) {
  const { data, isLoading, isError } = useGetNotificationConfig(itemId);

  if (itemId && isLoading) {
    return <Skeleton className="h-64 w-full max-w-[880px] rounded" />;
  }
  if (itemId && (isError || !data?.itemId)) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-error" role="alert">
          {isError ? NOTIFICATION_TEXT.loadFailed : NOTIFICATION_TEXT.notFound}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {NOTIFICATION_TEXT.cancel}
        </Button>
      </div>
    );
  }
  return (
    <NotificationConfigForm
      key={itemId || "new"}
      previous={itemId ? data : undefined}
      onClose={onClose}
      onSetUpPush={onSetUpPush}
    />
  );
}
