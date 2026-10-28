import { useState } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Switch } from "@/components/ui-kits/switch/switch";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import type { IPushSettings } from "../models/notification-config.model";
import {
  isPushReady,
  usePushSettings,
  useSavePushSettings,
  useSendTestPush,
} from "../hooks/use-push-settings";
import { usePushKeyDraft } from "../hooks/use-push-key-draft";
import { NOTIFICATION_TEXT, PUSH_TEXT } from "../constants/notification-ui.constant";
import { FormRow, HelpText } from "./notification-form/form-row";
import { NotificationPageHeader } from "./notification-page-header";
import { PushKeyFields } from "./push-key-fields";

const NOT_SET_UP: IPushSettings = { projectId: null, enabled: false, hasKey: false };

interface PushSettingsFormProps {
  settings: IPushSettings;
  onClose: () => void;
}

function PushSettingsForm({ settings, onClose }: Readonly<PushSettingsFormProps>) {
  const save = useSavePushSettings();
  const test = useSendTestPush();
  const draft = usePushKeyDraft();
  // First setup: a valid key turns push on. After that the switch pauses and resumes it without touching the key.
  const [enabled, setEnabled] = useState(settings.hasKey ? settings.enabled : true);

  const onSave = async () => {
    const key = await draft.read();
    if (key.status === "invalid") return;
    if (key.status === "none" && !settings.hasKey) {
      draft.setError(PUSH_TEXT.needKey);
      return;
    }
    const newKey = key.status === "key" ? key : null;
    try {
      const res = await save.mutateAsync({
        projectId: newKey?.projectId ?? settings.projectId ?? "",
        enabled,
        serviceAccountJson: newKey?.json,
      });
      draft.clear();
      if (res.isSuccess) {
        toast({ variant: "success", title: "Success", description: PUSH_TEXT.saved });
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      draft.clear();
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
    <div className="flex flex-col">
      <NotificationPageHeader
        title={PUSH_TEXT.title}
        description={PUSH_TEXT.subtitle}
        onBack={onClose}
      />
      <Card className="max-w-[880px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <FormRow label={PUSH_TEXT.status}>
            <div className="flex flex-wrap items-center gap-3">
              <output>
                <Badge variant={ready ? "success" : "secondary"} className="w-fit font-normal">
                  {ready ? PUSH_TEXT.ready : PUSH_TEXT.notSetUp}
                </Badge>
              </output>
              {settings.hasKey && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="push-enabled"
                    size="sm"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                  <label htmlFor="push-enabled" className="text-sm">
                    {PUSH_TEXT.pushOn}
                  </label>
                </div>
              )}
            </div>
          </FormRow>
          <PushKeyFields draft={draft} settings={settings} />
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
      </Card>
    </div>
  );
}

interface PushSettingsPageProps {
  onClose: () => void;
}

/** Mobile push settings: service account key (file or typed), on/off and a test send. */
export function PushSettingsPage({ onClose }: Readonly<PushSettingsPageProps>) {
  const { data, isLoading } = usePushSettings();
  if (isLoading) return <Skeleton className="h-64 w-full max-w-[880px] rounded" />;
  // A failed read shows the page as "Not set up" so the user can still enter the settings.
  const settings = data ?? NOT_SET_UP;
  return <PushSettingsForm key={String(settings.hasKey)} settings={settings} onClose={onClose} />;
}
