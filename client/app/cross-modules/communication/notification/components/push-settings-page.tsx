import { useRef, useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import type { IPushSettings } from "../models/notification-config.model";
import {
  isPushReady,
  usePushSettings,
  useSavePushSettings,
  useSendTestPush,
} from "../hooks/use-push-settings";
import { NOTIFICATION_TEXT, PUSH_TEXT } from "../constants/notification-ui.constant";
import { CheckRow, FormRow, HelpText } from "./notification-form/form-row";

const MAX_KEY_BYTES = 20_000;
const NOT_SET_UP: IPushSettings = { projectId: null, enabled: false, hasKey: false };

/** Light client check: the file parses as an object with the four fields of a service account key. */
export const isServiceAccountKey = (text: string): boolean => {
  try {
    const key = JSON.parse(text) as Record<string, unknown>;
    return (
      key?.type === "service_account" &&
      !!key.project_id &&
      !!key.private_key &&
      !!key.client_email
    );
  } catch {
    return false;
  }
};

const keyUploadedText = (settings: IPushSettings): string => {
  const parts: string[] = [PUSH_TEXT.keyUploaded];
  if (settings.keyUploadedAt) parts.push("on", new Date(settings.keyUploadedAt).toLocaleDateString());
  if (settings.keyUploadedBy) parts.push("by", settings.keyUploadedBy);
  return parts.join(" ");
};

interface PushSettingsFormProps {
  settings: IPushSettings;
  onClose: () => void;
}

function PushSettingsForm({ settings, onClose }: Readonly<PushSettingsFormProps>) {
  const save = useSavePushSettings();
  const test = useSendTestPush();
  const [projectId, setProjectId] = useState(settings.projectId ?? "");
  const [enabled, setEnabled] = useState(settings.enabled);
  const [fileName, setFileName] = useState("");
  const [keyError, setKeyError] = useState(false);
  // The key file is held in a ref, never in state or on screen, and dropped once saved.
  const keyFile = useRef<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const clearKey = () => {
    keyFile.current = null;
    setFileName("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const onPickFile = async (file: File | undefined) => {
    clearKey();
    setKeyError(false);
    if (!file) return;
    const text = file.size <= MAX_KEY_BYTES ? await file.text() : "";
    if (!isServiceAccountKey(text)) {
      setKeyError(true);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    keyFile.current = file;
    setFileName(file.name);
  };

  const onSave = async () => {
    try {
      const serviceAccountJson = keyFile.current ? await keyFile.current.text() : undefined;
      const res = await save.mutateAsync({ projectId: projectId.trim(), enabled, serviceAccountJson });
      clearKey();
      if (res.isSuccess) {
        toast({ variant: "success", title: "Success", description: PUSH_TEXT.saved });
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      clearKey();
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : "Something went wrong" });
    }
  };

  const onTest = async () => {
    try {
      const res = await test.mutateAsync();
      if (res.isSuccess) {
        toast({ variant: "success", title: "Success", description: PUSH_TEXT.testSent });
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : "Something went wrong" });
    }
  };

  const ready = isPushReady(settings);
  return (
    <div className="flex flex-col gap-4">
      <nav className="text-sm text-medium-emphasis">{PUSH_TEXT.breadcrumb}</nav>
      <div>
        <h1 className="text-xl font-semibold">{PUSH_TEXT.title}</h1>
        <p className="text-sm text-medium-emphasis">{PUSH_TEXT.subtitle}</p>
      </div>
      <form
        className="max-w-[880px] rounded-md border bg-card"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <FormRow label={PUSH_TEXT.status}>
          <output className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${ready ? "bg-success" : "bg-low-emphasis"}`} />
            {ready ? PUSH_TEXT.ready : PUSH_TEXT.notSetUp}
          </output>
        </FormRow>
        <FormRow label={PUSH_TEXT.firebaseProject}>
          <Input
            aria-label={PUSH_TEXT.projectId}
            placeholder={PUSH_TEXT.projectIdPlaceholder}
            maxLength={100}
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          />
        </FormRow>
        <FormRow label={PUSH_TEXT.keyLabel}>
          <div className="flex flex-wrap items-center gap-3">
            {settings.hasKey && <span className="text-sm">{keyUploadedText(settings)}</span>}
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label={PUSH_TEXT.upload}
              onChange={(event) => void onPickFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => fileInput.current?.click()}
            >
              {settings.hasKey ? PUSH_TEXT.replace : PUSH_TEXT.upload}
            </Button>
            {fileName && (
              <span className="text-sm">
                {PUSH_TEXT.chosenFile} {fileName}
              </span>
            )}
          </div>
          {keyError && (
            <p className="text-xs text-error" role="alert">
              {PUSH_TEXT.invalidKey}
            </p>
          )}
          <HelpText>{PUSH_TEXT.keyHelp}</HelpText>
        </FormRow>
        <FormRow label="">
          <CheckRow
            id="push-enabled"
            label={PUSH_TEXT.enable}
            checked={enabled}
            onChange={setEnabled}
          />
        </FormRow>
        {ready && (
          <FormRow label={PUSH_TEXT.testTitle}>
            <div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={test.isPending}
                onClick={() => void onTest()}
              >
                {PUSH_TEXT.sendTest}
              </Button>
            </div>
            <HelpText>{PUSH_TEXT.testHelp}</HelpText>
          </FormRow>
        )}
        <div className="flex justify-end gap-2 border-t px-5 py-3.5">
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
            {NOTIFICATION_TEXT.cancel}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? NOTIFICATION_TEXT.saving : NOTIFICATION_TEXT.save}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface PushSettingsPageProps {
  onClose: () => void;
}

/** Mobile push settings: Firebase project, service account key, on/off and a test send. */
export function PushSettingsPage({ onClose }: Readonly<PushSettingsPageProps>) {
  const { data, isLoading } = usePushSettings();
  if (isLoading) return <Skeleton className="h-64 w-full max-w-[880px] rounded" />;
  // A failed read shows the page as "Not set up" so the user can still enter the settings.
  const settings = data ?? NOT_SET_UP;
  return <PushSettingsForm key={String(settings.hasKey)} settings={settings} onClose={onClose} />;
}
