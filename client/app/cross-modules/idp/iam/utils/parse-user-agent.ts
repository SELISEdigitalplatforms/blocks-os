import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.idp.iam";

export interface IParsedDevice {
  deviceName?: string | null;
  deviceModel?: string | null;
  operatingSystem?: string | null;
  browser?: string | null;
}

const OS_PATTERNS: Array<{ name: string; test: (ua: string) => boolean }> = [
  { name: "Windows", test: (ua) => /Windows NT ([0-9.]+)/i.test(ua) },
  { name: "macOS", test: (ua) => /Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua) },
  { name: "iOS", test: (ua) => /iPhone|iPad|iPod/i.test(ua) },
  { name: "Android", test: (ua) => /Android/i.test(ua) },
  { name: "Linux", test: (ua) => /Linux/i.test(ua) && !/Android/i.test(ua) },
];

const BROWSER_PATTERNS: Array<{ name: string; test: (ua: string) => boolean }> = [
  { name: "Edge", test: (ua) => /Edg\/[0-9.]+/i.test(ua) },
  { name: "Chrome", test: (ua) => /Chrome\/[0-9.]+/i.test(ua) && !/Edg/i.test(ua) },
  { name: "Firefox", test: (ua) => /Firefox\/[0-9.]+/i.test(ua) },
  { name: "Safari", test: (ua) => /Safari\/[0-9.]+/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua) },
  { name: "Opera", test: (ua) => /OPR\/[0-9.]+|Opera/i.test(ua) },
];

const detectOs = (ua: string): string | undefined => OS_PATTERNS.find((p) => p.test(ua))?.name;

const detectBrowser = (ua: string): string | undefined =>
  BROWSER_PATTERNS.find((p) => p.test(ua))?.name;

export const parseUserAgent = (userAgent?: string | null): IParsedDevice => {
  if (!userAgent) return {};

  const operatingSystem = detectOs(userAgent);
  const browser = detectBrowser(userAgent);

  let deviceName: string | undefined;
  let deviceModel: string | undefined;

  if (operatingSystem === "iOS") {
    deviceName = /iPad/i.test(userAgent) ? "iPad" : "iPhone";
    deviceModel = deviceName;
  } else if (operatingSystem === "Android") {
    const match = /Android[^;]*;([^)]+)\sBuild/i.exec(userAgent);
    deviceModel = match?.[1]?.trim();
    deviceName = deviceModel ?? tStatic(I18N_MODULE, "PARSE_USER_AGENT.ANDROID_DEVICE");
  } else if (operatingSystem === "macOS") {
    deviceName = "Mac";
  } else if (operatingSystem === "Windows") {
    deviceName = tStatic(I18N_MODULE, "PARSE_USER_AGENT.WINDOWS_PC");
  } else if (operatingSystem === "Linux") {
    deviceName = tStatic(I18N_MODULE, "PARSE_USER_AGENT.LINUX_DEVICE");
  }

  return { deviceName, deviceModel, operatingSystem, browser };
};

export const enrichWithParsedUserAgent = <T extends IParsedDevice & { userAgent?: string | null }>(
  app: T | undefined | null,
): T | undefined => {
  if (!app) return undefined;
  const parsed = parseUserAgent(app.userAgent);
  return {
    ...app,
    deviceName: app.deviceName ?? parsed.deviceName ?? null,
    deviceModel: app.deviceModel ?? parsed.deviceModel ?? null,
    operatingSystem: app.operatingSystem ?? parsed.operatingSystem ?? null,
    browser: app.browser ?? parsed.browser ?? null,
  };
};
