import type { INotificationConfigRow } from "../models/notification-config.model";
import {
  AUDIENCE_LEVEL,
  NOTIFICATION_SCOPE,
  OWNER_ONLY_LABEL,
  RECEIVER_OPTIONS,
  SEND_TO_LABELS,
} from "../constants/notification-ui.constant";
import { effectiveAudience } from "./notification-form";

/** "blocks-iam" reads as "iam": every built-in service carries the same prefix. */
export const serviceLabel = (service?: string | null): string =>
  (service ?? "").replace(/^blocks-/, "");

export const sendToLabel = (row: INotificationConfigRow): string =>
  row.audienceLocked
    ? SEND_TO_LABELS[NOTIFICATION_SCOPE.Project]
    : (SEND_TO_LABELS[row.scope ?? NOTIFICATION_SCOPE.Project] ??
      SEND_TO_LABELS[NOTIFICATION_SCOPE.Project]);

/** "Selected (4)" counts the users, roles and permissions picked. */
export const receiversLabel = (row: INotificationConfigRow): string => {
  if (row.audienceLocked) return OWNER_ONLY_LABEL;
  const audience = effectiveAudience(row);
  const level = audience?.level ?? AUDIENCE_LEVEL.AffectedOnly;
  const label = RECEIVER_OPTIONS.find((o) => o.value === level)?.label ?? "";
  if (level !== AUDIENCE_LEVEL.Selected) return label;
  const count =
    (audience?.userIds.length ?? 0) +
    (audience?.roles.length ?? 0) +
    (audience?.permissions.length ?? 0);
  return `${label} (${count})`;
};

/** Rows without the new fields keep in-app on and push off, as the server reads them. */
export const channelFlags = (row: INotificationConfigRow) => ({
  inApp: row.liveEnabled ?? true,
  push: row.pushEnabled ?? false,
  inbox: row.enablePersistence,
});

export const matchesSendTo = (row: INotificationConfigRow, filter: string): boolean => {
  if (!filter) return true;
  if (row.audienceLocked) return filter === String(NOTIFICATION_SCOPE.Project);
  const scope = row.scope ?? NOTIFICATION_SCOPE.Project;
  return scope === NOTIFICATION_SCOPE.Both || String(scope) === filter;
};

export const matchesReceivers = (row: INotificationConfigRow, filter: string): boolean => {
  if (!filter) return true;
  const level = row.audienceLocked
    ? AUDIENCE_LEVEL.AffectedOnly
    : (effectiveAudience(row)?.level ?? AUDIENCE_LEVEL.AffectedOnly);
  return String(level) === filter;
};
