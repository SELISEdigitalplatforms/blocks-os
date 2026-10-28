/** Client helpers for the Firebase web config. The server checks every value again; these only guide the form. */

export interface IWebConfigFields {
  apiKey: string;
  appId: string;
  messagingSenderId: string;
  /** Not part of firebaseConfig; always entered on its own. */
  vapidKey: string;
  /** Present only in a pasted firebaseConfig. */
  projectId?: string;
}

export type WebConfigProblem =
  | "notConfig"
  | "needConfig"
  | "otherProject"
  | "needVapid"
  | "needKey"
  | "fillAll"
  | "appIdFormat"
  | "valueFormat"
  | "otherSender";

const API_KEY = /^[A-Za-z0-9_-]{30,60}$/;
const APP_ID = /^1:(\d+):web:[0-9a-f]+$/i;
const SENDER_ID = /^\d{1,20}$/;
const VAPID_KEY = /^[A-Za-z0-9_-]{60,120}$/;

const FOUND_KEYS = ["apiKey", "appId", "messagingSenderId", "projectId"] as const;

/**
 * Reads the four wanted values out of pasted text or a .json/.js file: `apiKey: "..."`, `"apiKey": "..."` or a
 * bare number for the sender id. Nothing is evaluated, so pasted code never runs. Null when no
 * apiKey, appId and messagingSenderId are found.
 */
export const parseWebConfig = (text: string): Omit<IWebConfigFields, "vapidKey"> | null => {
  const found: Partial<Record<(typeof FOUND_KEYS)[number], string>> = {};
  for (const name of FOUND_KEYS) {
    const match = new RegExp(
      String.raw`["']?\b${name}["']?\s*:\s*(?:["']([^"'\s]*)["']|(\d+))`,
    ).exec(text);
    const value = match?.[1] ?? match?.[2];
    if (value) found[name] = value;
  }
  const { apiKey, appId, messagingSenderId, projectId } = found;
  if (!apiKey || !appId || !messagingSenderId) return null;
  return { apiKey, appId, messagingSenderId, projectId };
};

/** Format checks of the four values, in the order the form reports them. Null when all look right. */
export const checkWebFormats = (
  fields: IWebConfigFields,
  vapidSeparate: boolean,
): WebConfigProblem | null => {
  const { apiKey, appId, messagingSenderId, vapidKey } = fields;
  if (vapidSeparate && !vapidKey && apiKey && appId && messagingSenderId) return "needVapid";
  if (!apiKey || !appId || !messagingSenderId || !vapidKey) return "fillAll";
  const appIdMatch = APP_ID.exec(appId);
  if (!appIdMatch) return "appIdFormat";
  if (!API_KEY.test(apiKey) || !SENDER_ID.test(messagingSenderId) || !VAPID_KEY.test(vapidKey)) {
    return "valueFormat";
  }
  return appIdMatch[1] === messagingSenderId ? null : "otherSender";
};

/**
 * Full browser check before save. `keyProject` is the Firebase project of the new or stored service account key;
 * a config for another project is blocked.
 */
export const checkWebConfig = (
  fields: IWebConfigFields,
  keyProject: string | null,
  vapidSeparate: boolean,
): WebConfigProblem | null => {
  if (!keyProject) return "needKey";
  if (fields.projectId && fields.projectId !== keyProject) return "otherProject";
  return checkWebFormats(fields, vapidSeparate);
};
