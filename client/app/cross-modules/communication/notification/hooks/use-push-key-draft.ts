import { useRef, useState } from "react";
import { PUSH_TEXT } from "../constants/notification-ui.constant";
import {
  buildServiceAccountKey,
  isServiceAccountKey,
  keyProjectId,
  projectFromEmail,
} from "../utils/push-key";

const MAX_KEY_BYTES = 20_000;

export const KEY_SOURCE = { Upload: 0, Manual: 1 } as const;

export type KeyDraftResult =
  { status: "none" } | { status: "invalid" } | { status: "key"; projectId: string; json: string };

/**
 * The new service account key the user is adding: a chosen file or typed fields. The key itself sits only in a ref
 * (the file, the private key textarea), never in state or on screen, and `clear` drops it.
 */
export const usePushKeyDraft = () => {
  const [source, setSource] = useState<number>(KEY_SOURCE.Upload);
  const [fileName, setFileName] = useState("");
  const [fileProjectId, setFileProjectId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keyFile = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const privateKeyRef = useRef<HTMLTextAreaElement>(null);

  const clear = () => {
    keyFile.current = null;
    setFileName("");
    setFileProjectId(null);
    setClientEmail("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (privateKeyRef.current) privateKeyRef.current.value = "";
  };

  /** Switching between file and typed fields drops whatever key was half entered. */
  const changeSource = (next: number) => {
    clear();
    setError(null);
    setSource(next);
  };

  const pickFile = async (file: File | undefined) => {
    clear();
    setError(null);
    if (!file) return;
    const text = file.size <= MAX_KEY_BYTES ? await file.text() : "";
    if (!isServiceAccountKey(text)) {
      setError(PUSH_TEXT.invalidKey);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    keyFile.current = file;
    setFileName(file.name);
    setFileProjectId(keyProjectId(text));
  };

  const readFile = async (): Promise<KeyDraftResult> => {
    if (!keyFile.current) return { status: "none" };
    const json = await keyFile.current.text();
    return { status: "key", projectId: keyProjectId(json) ?? "", json };
  };

  const readTyped = (): KeyDraftResult => {
    const typedKey = privateKeyRef.current?.value ?? "";
    if (!clientEmail.trim() && !typedKey.trim()) return { status: "none" };
    const built = buildServiceAccountKey({ clientEmail, privateKey: typedKey });
    if (!built.ok) {
      setError(built.reason === "email" ? PUSH_TEXT.emailInvalid : PUSH_TEXT.manualIncomplete);
      return { status: "invalid" };
    }
    return { status: "key", projectId: built.projectId, json: built.json };
  };

  /** The key to send with the save, read at save time so it never lives in state. */
  const read = (): Promise<KeyDraftResult> => {
    setError(null);
    return source === KEY_SOURCE.Upload ? readFile() : Promise.resolve(readTyped());
  };

  // Callback refs: the form binds its elements here, so no ref object leaves the hook.
  const bindFileInput = (element: HTMLInputElement | null) => {
    fileInputRef.current = element;
  };
  const bindPrivateKey = (element: HTMLTextAreaElement | null) => {
    privateKeyRef.current = element;
  };
  const openFilePicker = () => fileInputRef.current?.click();

  /** The Firebase project the new key is for, or null when no new key is given yet. */
  const newProjectId = source === KEY_SOURCE.Upload ? fileProjectId : projectFromEmail(clientEmail);

  return {
    source,
    setSource: changeSource,
    fileName,
    bindFileInput,
    openFilePicker,
    pickFile,
    clientEmail,
    setClientEmail,
    bindPrivateKey,
    newProjectId,
    error,
    setError,
    read,
    clear,
  };
};

export type PushKeyDraft = ReturnType<typeof usePushKeyDraft>;
