import type { INotificationConfigRow } from "../models/notification-config.model";
import {
  AUDIENCE_LEVEL,
  NOTIFICATION_SCOPE,
  NOTIFICATION_TEXT,
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

/** "Targeted: owner + done by + 4 picked" — the two ticks and the users, roles and permissions picked. */
export const receiversLabel = (row: INotificationConfigRow): string => {
  if (row.audienceLocked) return OWNER_ONLY_LABEL;
  const audience = effectiveAudience(row);
  const level = audience?.level ?? AUDIENCE_LEVEL.AffectedOnly;
  if (level === AUDIENCE_LEVEL.AllUsers) return RECEIVER_OPTIONS[0].label;
  const owner = level === AUDIENCE_LEVEL.AffectedOnly || !!audience?.alsoNamedUsers;
  const count =
    level === AUDIENCE_LEVEL.Selected
      ? (audience?.userIds.length ?? 0) +
        (audience?.roles.length ?? 0) +
        (audience?.permissions.length ?? 0)
      : 0;
  const parts = [
    owner ? NOTIFICATION_TEXT.eventOwner : "",
    level === AUDIENCE_LEVEL.Selected && audience?.alsoDoneBy ? NOTIFICATION_TEXT.doneByShort : "",
    count > 0 ? `${count} ${NOTIFICATION_TEXT.picked}` : "",
  ].filter(Boolean);
  return parts.length > 0
    ? `${NOTIFICATION_TEXT.targeted}: ${parts.join(" + ")}`
    : NOTIFICATION_TEXT.targeted;
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
  // Event owner only is part of Targeted on screen.
  const shown =
    level === AUDIENCE_LEVEL.AllUsers ? AUDIENCE_LEVEL.AllUsers : AUDIENCE_LEVEL.Selected;
  return String(shown) === filter;
};
