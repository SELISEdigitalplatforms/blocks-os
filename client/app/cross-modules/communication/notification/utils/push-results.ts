import type { PushPlatform, PushResultCode } from "../models/push.model";
import { PUSH_RESULT_FIX, PUSH_RESULT_LABEL } from "../constants/push-ui.constant";

/** Pill text of a result code, e.g. "APNs key missing". Unknown codes read as a plain failure. */
export const resultLabel = (code: string | null | undefined): string =>
  PUSH_RESULT_LABEL[code as PushResultCode] ?? PUSH_RESULT_LABEL.failed;

/** The "what to do" line under a failed device; delivered has none. */
export const resultFix = (code: string): string | null =>
  PUSH_RESULT_FIX[code as PushResultCode] ?? null;

const APNS_CODES: ReadonlySet<string> = new Set(["apnsKeyMissing", "apnsKeyRejected"]);

/** True when the failure is about the Apple key, so the iOS row can show the fix hint. */
export const isApnsFailure = (platform: PushPlatform, reason: string | null | undefined): boolean =>
  platform === "ios" && !!reason && APNS_CODES.has(reason);

/** Test devices have no id: the key is the device's own text, plus a counter when two rows read the same. */
export const keyedDevices = <
  T extends { platform: string; name?: string | null; lastSeenAt?: string | null },
>(
  devices: T[],
): { key: string; device: T }[] => {
  const seen = new Map<string, number>();
  return devices.map((device) => {
    const base = `${device.platform}|${device.name ?? ""}|${device.lastSeenAt ?? ""}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { key: `${base}#${count}`, device };
  });
};
