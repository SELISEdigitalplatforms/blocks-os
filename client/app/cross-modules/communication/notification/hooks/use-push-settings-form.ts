import { useState } from "react";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import type {
  IPushSettings,
  IPushTestRequest,
  IPushTestResult,
  PushPlatform,
} from "../models/push.model";
import { PUSH_TEXT } from "../constants/notification-ui.constant";
import { usePushKeyDraft } from "./use-push-key-draft";
import { usePushWebDraft } from "./use-push-web-draft";
import { usePushStatus, useSendTestPush } from "./use-push-runtime";
import { isPushReady, useSavePushSettings } from "./use-push-settings";

const SOMETHING_WRONG = "Something went wrong";

/**
 * State and actions of the Mobile push settings page: the three switches, the key and web config drafts, one save
 * and the test sends. Key and web values stay inside the drafts (refs) and are dropped after every save.
 */
export const usePushSettingsForm = (settings: IPushSettings) => {
  const save = useSavePushSettings();
  const test = useSendTestPush();
  const status = usePushStatus();
  const keyDraft = usePushKeyDraft();
  // The Firebase project the web config must belong to: the new key's, else the stored key's.
  const webDraft = usePushWebDraft(keyDraft.newProjectId ?? settings.projectId);
  // First setup: a valid key turns push on. After that the switch pauses and resumes it without touching the key.
  const [enabled, setEnabled] = useState(settings.hasKey ? settings.enabled : true);
  const [platforms, setPlatforms] = useState(settings.platforms);
  const [testResult, setTestResult] = useState<IPushTestResult | null>(null);
  const [lastRequest, setLastRequest] = useState<IPushTestRequest>({});
  const [guideOpen, setGuideOpen] = useState(false);

  const keyKnown = settings.hasKey || !!keyDraft.newProjectId;
  const webReady = settings.hasWebConfig || webDraft.summary.added || webDraft.summary.filled === 4;

  const setPlatform = (platform: PushPlatform, checked: boolean) =>
    setPlatforms((current) => ({ ...current, [platform]: checked }));

  const onSave = async () => {
    const key = await keyDraft.read();
    if (key.status === "invalid") return;
    const web = webDraft.read();
    if (web.status === "invalid") return;
    if (key.status === "none" && !settings.hasKey) {
      keyDraft.setError(PUSH_TEXT.needKey);
      return;
    }
    try {
      const res = await save.mutateAsync({
        enabled,
        platforms: { ...platforms, web: platforms.web && webReady },
        serviceAccountJson: key.status === "key" ? key.json : undefined,
        webConfig: web.status === "config" ? web.config : undefined,
      });
      if (res.isSuccess) {
        toast({ variant: "success", title: "Success", description: PUSH_TEXT.saved });
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : SOMETHING_WRONG });
    } finally {
      keyDraft.clear();
      webDraft.clear();
    }
  };

  const runTest = async (request: IPushTestRequest) => {
    setLastRequest(request);
    try {
      const res = await test.mutateAsync(request);
      if (res.isSuccess === false) showErrorToast({ errors: res.errors });
      else setTestResult(res);
    } catch (error) {
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : SOMETHING_WRONG });
    }
  };

  return {
    keyDraft,
    webDraft,
    status: status.data,
    enabled,
    setEnabled,
    platforms,
    setPlatform,
    keyKnown,
    webReady,
    ready: isPushReady(settings),
    saving: save.isPending,
    testing: test.isPending,
    testResult,
    closeTestResult: () => setTestResult(null),
    guideOpen,
    setGuideOpen,
    onSave,
    sendTest: (platform?: PushPlatform) => runTest(platform ? { platform } : {}),
    sendAgain: () => runTest(lastRequest),
  };
};
