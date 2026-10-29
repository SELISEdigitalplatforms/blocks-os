import { useEffect, useRef, useState } from "react";
import type { IWebConfigPayload } from "../models/push.model";
import {
  checkWebConfig,
  checkWebFormats,
  parseWebConfig,
  type IWebConfigFields,
  type WebConfigProblem,
} from "../utils/push-web-config";

const MAX_CONFIG_BYTES = 50_000;

export const WEB_SOURCE = { Paste: 0, Fields: 1 } as const;

export const WEB_FIELD = {
  ApiKey: "apiKey",
  AppId: "appId",
  SenderId: "messagingSenderId",
  Vapid: "vapidKey",
} as const;

type WebFieldName = (typeof WEB_FIELD)[keyof typeof WEB_FIELD];
const FIELD_NAMES: readonly WebFieldName[] = Object.values(WEB_FIELD);

export type WebDraftResult =
  { status: "none" } | { status: "invalid" } | { status: "config"; config: IWebConfigPayload };

/** What the page may show about the draft: counts and yes/no only, never a value. */
interface WebSummary {
  added: boolean;
  vapidFilled: boolean;
  filled: number;
  /** Null when the pasted config names no project. */
  sameProject: boolean | null;
  formatsOk: boolean;
}

const EMPTY_SUMMARY: WebSummary = {
  added: false,
  vapidFilled: false,
  filled: 0,
  sameProject: null,
  formatsOk: false,
};

type ParsedConfig = Omit<IWebConfigFields, "vapidKey">;

/**
 * The web config the user is adding: a pasted or chosen firebaseConfig plus the VAPID key, or four typed fields.
 * The values sit only in refs (inputs and one parsed object), never in state or on screen. `clear` drops them.
 * `keyProject` is the Firebase project of the new or stored service account key.
 */
export const usePushWebDraft = (keyProject: string | null) => {
  const [source, setSource] = useState<number>(WEB_SOURCE.Paste);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<WebConfigProblem | null>(null);
  const [summary, setSummary] = useState<WebSummary>(EMPTY_SUMMARY);
  const parsed = useRef<ParsedConfig | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputs = useRef<Partial<Record<WebFieldName, HTMLInputElement | null>>>({});
  const paste = source === WEB_SOURCE.Paste;

  const typed = (name: WebFieldName) => inputs.current[name]?.value.trim() ?? "";

  const currentFields = (): IWebConfigFields | null => {
    if (paste) {
      return parsed.current ? { ...parsed.current, vapidKey: typed(WEB_FIELD.Vapid) } : null;
    }
    return {
      apiKey: typed(WEB_FIELD.ApiKey),
      appId: typed(WEB_FIELD.AppId),
      messagingSenderId: typed(WEB_FIELD.SenderId),
      vapidKey: typed(WEB_FIELD.Vapid),
    };
  };

  /** Re-reads the refs into the yes/no summary; called after every edit and when the key project changes. */
  const refresh = () => {
    const fields = currentFields();
    const configProject = parsed.current?.projectId;
    setSummary({
      added: paste && !!parsed.current,
      vapidFilled: !!typed(WEB_FIELD.Vapid),
      filled: paste ? 0 : FIELD_NAMES.filter((name) => !!typed(name)).length,
      sameProject: paste && configProject && keyProject ? configProject === keyProject : null,
      formatsOk: !!fields && !!keyProject && checkWebFormats(fields, paste) === null,
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh reads refs; only the key project is a trigger
  useEffect(refresh, [keyProject, source]);

  const clear = () => {
    parsed.current = null;
    setFileName("");
    setError(null);
    if (pasteRef.current) pasteRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
    for (const input of Object.values(inputs.current)) {
      if (input) input.value = "";
    }
    refresh();
  };

  const changeSource = (next: number) => {
    clear();
    setSource(next);
  };

  /** Takes pasted or file text: the values move into the ref and the textarea is emptied. */
  const acceptText = (text: string, name = "") => {
    setError(null);
    setFileName("");
    parsed.current = parseWebConfig(text);
    if (pasteRef.current) pasteRef.current.value = "";
    if (parsed.current) setFileName(name);
    else setError("notConfig");
    refresh();
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const text = file.size <= MAX_CONFIG_BYTES ? await file.text() : "";
    acceptText(text, file.name);
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Called on blur: typed text counts too, not only pasted text. */
  const acceptTyped = () => {
    const text = pasteRef.current?.value ?? "";
    if (text.trim()) acceptText(text);
  };

  const remove = () => {
    parsed.current = null;
    setFileName("");
    setError(null);
    refresh();
  };

  const fail = (problem: WebConfigProblem): WebDraftResult => {
    setError(problem);
    return { status: "invalid" };
  };

  /** The config to send with the save, read at save time so it never lives in state. */
  const read = (): WebDraftResult => {
    setError(null);
    const fields = currentFields();
    const anyTyped = FIELD_NAMES.some((name) => !!typed(name));
    if (!anyTyped && !parsed.current) return { status: "none" };
    if (!fields) return fail("needConfig");
    const problem = checkWebConfig(fields, keyProject, paste);
    if (problem) return fail(problem);
    return {
      status: "config",
      config: {
        apiKey: fields.apiKey,
        appId: fields.appId,
        messagingSenderId: fields.messagingSenderId,
        vapidKey: fields.vapidKey,
        ...(fields.projectId ? { projectId: fields.projectId } : {}),
      },
    };
  };

  // Callback refs: the panel binds its elements here, so no ref object leaves the hook.
  const bindPaste = (element: HTMLTextAreaElement | null) => {
    pasteRef.current = element;
  };
  const bindFile = (element: HTMLInputElement | null) => {
    fileRef.current = element;
  };
  const bindApiKey = (element: HTMLInputElement | null) => {
    inputs.current[WEB_FIELD.ApiKey] = element;
  };
  const bindAppId = (element: HTMLInputElement | null) => {
    inputs.current[WEB_FIELD.AppId] = element;
  };
  const bindSenderId = (element: HTMLInputElement | null) => {
    inputs.current[WEB_FIELD.SenderId] = element;
  };
  const bindVapid = (element: HTMLInputElement | null) => {
    inputs.current[WEB_FIELD.Vapid] = element;
  };

  return {
    source,
    setSource: changeSource,
    fileName,
    error,
    summary,
    refresh,
    acceptText,
    acceptTyped,
    pickFile,
    remove,
    bindPaste,
    bindFile,
    bindApiKey,
    bindAppId,
    bindSenderId,
    bindVapid,
    openFilePicker: () => fileRef.current?.click(),
    read,
    clear,
  };
};

export type PushWebDraft = ReturnType<typeof usePushWebDraft>;
