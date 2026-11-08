import type {
  IApplicationApi,
  ISessionDetailsApi,
  ISessionOverviewApi,
  ITimelineEventApi,
  IUserSessionApi,
} from "../api";
import type {
  IApplicationViewModel,
  ISessionCardViewModel,
  ISessionDetailsViewModel,
  ISessionOverviewViewModel,
  ITimelineEventViewModel,
} from "../view-models/session.view-model";
import {
  formatAbsoluteWithSeconds,
  formatAbsoluteUtcWithSeconds,
  formatRelative,
} from "../utils/date-format";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.idp.security";

const statusLabel = (status: string): string => {
  switch (status) {
    case "Active":
      return tStatic(I18N_MODULE, "SESSION_MAPPER.STATUS_ACTIVE");
    case "Expired":
      return tStatic(I18N_MODULE, "SESSION_MAPPER.STATUS_EXPIRED");
    case "Revoked":
      return tStatic(I18N_MODULE, "SESSION_MAPPER.STATUS_REVOKED");
    default:
      return status;
  }
};

const unknownDevice = () => tStatic(I18N_MODULE, "SESSION_MAPPER.UNKNOWN_DEVICE");
const unknownBrowser = () => tStatic(I18N_MODULE, "SESSION_MAPPER.UNKNOWN_BROWSER");
const unknownOs = () => tStatic(I18N_MODULE, "SESSION_MAPPER.UNKNOWN_OS");

export const toSessionCardViewModel = (api: IUserSessionApi): ISessionCardViewModel => {
  const extraApps = Math.max(0, api.applicationCount - 1);
  return {
    id: api.sessionId,
    deviceName: api.primaryDeviceName ?? unknownDevice(),
    browser: api.primaryBrowser ?? unknownBrowser(),
    operatingSystem: api.primaryOperatingSystem ?? unknownOs(),
    ipAddress: api.primaryIpAddress ?? "—",
    lastActivityDisplay: formatRelative(api.lastActivityAt),
    expiresDisplay: formatAbsoluteWithSeconds(api.absoluteExpiry),
    status: api.status,
    isCurrent: api.isCurrent,
    applicationSummary:
      extraApps > 0
        ? tStatic(I18N_MODULE, "SESSION_MAPPER.MORE_APPS", { count: extraApps })
        : tStatic(I18N_MODULE, "SESSION_MAPPER.APPS", { count: api.applicationCount }),
  };
};

export const toSessionOverviewViewModel = (
  api: ISessionOverviewApi,
): ISessionOverviewViewModel => ({
  sessionId: api.sessionId,
  statusLabel: statusLabel(api.status),
  deviceName: api.deviceName ?? unknownDevice(),
  browser: api.browser ?? unknownBrowser(),
  operatingSystem: api.operatingSystem ?? unknownOs(),
  ipAddress: api.ipAddress ?? "—",
  startedAtDisplay: formatAbsoluteUtcWithSeconds(api.startedAt),
  lastActivityAtDisplay: formatRelative(api.lastActivityAt),
  absoluteExpiryDisplay: formatAbsoluteUtcWithSeconds(api.absoluteExpiry),
  idleExpiryDisplay: formatAbsoluteUtcWithSeconds(api.idleExpiry),
  isCurrent: api.isCurrent,
});

export const toApplicationViewModel = (api: IApplicationApi): IApplicationViewModel => ({
  clientName: api.clientName ?? api.clientId,
  statusLabel: statusLabel(api.status),
  expiresDisplay: formatAbsoluteUtcWithSeconds(api.expiresAt),
  lastRotationDisplay: api.lastRotationAt ? formatAbsoluteUtcWithSeconds(api.lastRotationAt) : "—",
  rotationCountLabel: `${api.rotationCount}`,
  revokeReason: api.revokeReason ?? undefined,
});

const TONE_MAP: Record<string, "info" | "warn" | "danger" | "success"> = {
  Auth: "info",
  Refresh: "info",
  Revocation: "warn",
};

export const toTimelineEventViewModel = (api: ITimelineEventApi): ITimelineEventViewModel => ({
  type: api.type,
  label: api.event ?? api.type,
  timestampDisplay: formatAbsoluteUtcWithSeconds(api.at),
  secondary:
    [api.outcome, api.reasonCode, api.clientId]
      .filter((v): v is string => !!v && v.length > 0)
      .join(" • ") || undefined,
  tone: TONE_MAP[api.type] ?? "info",
});

export const toSessionDetailsViewModel = (
  api: ISessionDetailsApi,
): ISessionDetailsViewModel | null => {
  if (!api.overview) return null;
  return {
    overview: toSessionOverviewViewModel(api.overview),
    applications: api.applications.map(toApplicationViewModel),
    timeline: api.timeline.map(toTimelineEventViewModel),
  };
};
