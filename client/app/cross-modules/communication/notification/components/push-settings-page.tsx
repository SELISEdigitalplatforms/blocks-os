import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Switch } from "@/components/ui-kits/switch/switch";
import type { IPushSettings } from "../models/push.model";
import { usePushSettings } from "../hooks/use-push-settings";
import { usePushSettingsForm } from "../hooks/use-push-settings-form";
import { NOTIFICATION_TEXT, PUSH_TEXT } from "../constants/notification-ui.constant";
import { NOT_SET_UP } from "../services/push-settings.service";
import { FormRow } from "./notification-form/form-row";
import { NotificationPageHeader } from "./notification-page-header";
import { PushGuideDialog } from "./push-guide-dialog";
import { PushKeyFields } from "./push-key-fields";
import { PushPlatformsCard } from "./push-platforms-card";
import { PushTestResultDialog } from "./push-test-result-dialog";
import { PushWebConfigPanel } from "./push-web-config-panel";

interface PushSettingsFormProps {
  settings: IPushSettings;
  onClose: () => void;
  onViewDevices: () => void;
}

function PushSettingsForm({ settings, onClose, onViewDevices }: Readonly<PushSettingsFormProps>) {
  const form = usePushSettingsForm(settings);
  const { keyDraft, webDraft } = form;
  const openGuide = () => form.setGuideOpen(true);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.onSave();
      }}
    >
      <NotificationPageHeader
        title={PUSH_TEXT.title}
        description={PUSH_TEXT.subtitle}
        onBack={onClose}
      />
      <Card className="max-w-[880px]">
        <h2 className="px-5 pt-4 text-[15px] font-semibold">{PUSH_TEXT.connection}</h2>
        <FormRow label={PUSH_TEXT.status}>
          <div className="flex flex-wrap items-center gap-3">
            <output>
              <Badge variant={form.ready ? "success" : "secondary"} className="w-fit font-normal">
                {form.ready ? PUSH_TEXT.ready : PUSH_TEXT.notSetUp}
              </Badge>
            </output>
            {settings.hasKey && (
              <div className="flex items-center gap-2">
                <Switch
                  id="push-enabled"
                  size="sm"
                  checked={form.enabled}
                  onCheckedChange={form.setEnabled}
                />
                <label htmlFor="push-enabled" className="text-sm">
                  {PUSH_TEXT.pushOn}
                </label>
              </div>
            )}
          </div>
        </FormRow>
        <PushKeyFields draft={keyDraft} settings={settings} onOpenGuide={openGuide} />
      </Card>
      <PushPlatformsCard
        settings={settings}
        status={form.status}
        platforms={form.platforms}
        keyKnown={form.keyKnown}
        webReady={form.webReady}
        testing={form.testing}
        onPlatformChange={form.setPlatform}
        onTest={(platform) => void form.sendTest(platform)}
        onViewDevices={onViewDevices}
        webPanel={
          <PushWebConfigPanel draft={webDraft} settings={settings} onOpenGuide={openGuide} />
        }
      />
      <div className="flex max-w-[880px] justify-end gap-2">
        <Button type="button" variant="outline" disabled={form.saving} onClick={onClose}>
          {NOTIFICATION_TEXT.cancel}
        </Button>
        <Button type="submit" disabled={form.saving}>
          {form.saving ? NOTIFICATION_TEXT.saving : NOTIFICATION_TEXT.save}
        </Button>
      </div>
      <PushTestResultDialog
        result={form.testResult}
        pending={form.testing}
        onSendAgain={() => void form.sendAgain()}
        onClose={form.closeTestResult}
      />
      <PushGuideDialog open={form.guideOpen} onClose={() => form.setGuideOpen(false)} />
    </form>
  );
}

/** Changes when the stored state changes, so the form starts again from what the server holds. */
const settingsKey = (settings: IPushSettings): string =>
  [
    settings.hasKey,
    settings.hasWebConfig,
    settings.enabled,
    settings.platforms.android,
    settings.platforms.ios,
    settings.platforms.web,
    settings.projectId,
  ].join("|");

interface PushSettingsPageProps {
  onClose: () => void;
  onViewDevices: () => void;
}

/** Mobile push settings: service account key, platform switches with web config, tests and one Save. */
export function PushSettingsPage({ onClose, onViewDevices }: Readonly<PushSettingsPageProps>) {
  const { data, isLoading } = usePushSettings();
  if (isLoading) return <Skeleton className="h-64 w-full max-w-[880px] rounded" />;
  // A failed read shows the page as "Not set up" so the user can still enter the settings.
  const settings = data ?? NOT_SET_UP;
  return (
    <PushSettingsForm
      key={settingsKey(settings)}
      settings={settings}
      onClose={onClose}
      onViewDevices={onViewDevices}
    />
  );
}
