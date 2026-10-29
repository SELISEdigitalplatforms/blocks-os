import { MIGRATION_ONGOING_WINDOW_MS } from "@/hooks/use-project";
import type { IMigrationStatusResponse } from "@blocks-identifier/models/project.model";

const IN_PROGRESS = "in-progress";
export type MigrationState = typeof IN_PROGRESS | "failed" | "done";

type MigrationTracker = IMigrationStatusResponse[number];
type ServiceStatus = { isCompleted?: boolean; errorMessage?: string | null };

// The tracker keeps one status object per service (authentication, iam, mfa, ...). Reading them
// by shape keeps this working when a service is added.
const getServiceStatuses = (tracker: MigrationTracker): ServiceStatus[] =>
  Object.values(tracker as Record<string, unknown>).filter(
    (value): value is ServiceStatus =>
      typeof value === "object" && value !== null && "isCompleted" in value,
  );

/**
 * The server lists trackers that still have an unfinished service, and a failed service never
 * finishes. So "listed" does not mean "running": any service with an error message means the
 * run failed, and it is running only while some service is neither done nor failed.
 */
export const getMigrationState = (
  tracker: MigrationTracker,
  now: number = Date.now(),
): MigrationState => {
  const isRecent =
    !!tracker.createdDate &&
    new Date(tracker.createdDate).getTime() > now - MIGRATION_ONGOING_WINDOW_MS;
  if (!isRecent) return "done";

  const statuses = getServiceStatuses(tracker);
  // No per-service detail to read: keep the time window as the only signal.
  if (statuses.length === 0) return IN_PROGRESS;

  // Any failed service ends the run: the spinner must not wait for the others.
  if (statuses.some((s) => !s.isCompleted && !!s.errorMessage)) return "failed";
  return statuses.some((s) => !s.isCompleted) ? IN_PROGRESS : "done";
};

/** The state of every migration aimed at one environment: running wins over failed. */
export const getMigrationStateForTarget = (
  trackers: IMigrationStatusResponse | undefined,
  tenantId: string,
  now: number = Date.now(),
): MigrationState => {
  if (!Array.isArray(trackers)) return "done";
  const states = new Set(
    trackers
      .filter((tracker) => tracker.targetedProjectKey === tenantId)
      .map((tracker) => getMigrationState(tracker, now)),
  );
  if (states.has(IN_PROGRESS)) return IN_PROGRESS;
  return states.has("failed") ? "failed" : "done";
};

export type MigrationNotificationOutcome = {
  isSuccess: boolean;
  title?: string;
  description?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
};

const readSuccessFlag = (record: Record<string, unknown>): boolean | undefined => {
  const flag = record.IsSuccess ?? record.isSuccess;
  return typeof flag === "boolean" ? flag : undefined;
};

/**
 * Reads the outcome from an "EnvironmentDataMigration" push. The flag sits in the payload the
 * server sends (IsSuccess), either on the message itself or inside its denormalized payload.
 * Returns undefined when the push carries no outcome.
 */
export const getMigrationNotificationOutcome = (
  detail: unknown,
): MigrationNotificationOutcome | undefined => {
  const message = asRecord(asRecord(detail)?.message);
  if (!message) return undefined;
  const payload = asRecord(message.denormalizedPayload ?? message.DenormalizedPayload) ?? message;
  const isSuccess = readSuccessFlag(payload);
  if (isSuccess === undefined) return undefined;
  const title = typeof payload.title === "string" ? payload.title : undefined;
  const description = typeof payload.description === "string" ? payload.description : undefined;
  return { isSuccess, title, description };
};
