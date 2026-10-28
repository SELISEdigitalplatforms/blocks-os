import { useId } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import type { IPushSettings } from "../models/push.model";
import { PUSH_TEXT } from "../constants/notification-ui.constant";
import { WEB_PROBLEM_TEXT, WEB_TEXT } from "../constants/push-ui.constant";
import { WEB_SOURCE, type PushWebDraft } from "../hooks/use-push-web-draft";
import { formatDate } from "../utils/push-format";
import { HelpText } from "./notification-form/form-row";
import { SegmentedControl } from "./notification-form/segmented-control";

const SOURCE_OPTIONS = [
  { value: WEB_SOURCE.Paste, label: WEB_TEXT.upload },
  { value: WEB_SOURCE.Fields, label: WEB_TEXT.fields },
] as const;

const storedText = (settings: IPushSettings): string => {
  if (!settings.hasWebConfig) return WEB_TEXT.notStored;
  const parts: string[] = [WEB_TEXT.stored];
  if (settings.webConfigUploadedAt) parts.push("on", formatDate(settings.webConfigUploadedAt));
  if (settings.webConfigUploadedBy) parts.push("by", settings.webConfigUploadedBy);
  return parts.join(" ");
};

function MaskedField({
  label,
  bind,
  onChange,
}: Readonly<{
  label: string;
  bind: (element: HTMLInputElement | null) => void;
  onChange: () => void;
}>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-medium-emphasis">
        {label}
      </label>
      <Input
        id={id}
        ref={bind}
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="••••••••"
        maxLength={300}
        onChange={onChange}
      />
    </div>
  );
}

function Checks({ draft }: Readonly<{ draft: PushWebDraft }>) {
  const { summary } = draft;
  return (
    <ul className="flex flex-col gap-1 text-xs text-success">
      <li>✓ {WEB_TEXT.foundFields}</li>
      {summary.sameProject && <li>✓ {WEB_TEXT.sameProject}</li>}
      {summary.vapidFilled && <li>✓ {WEB_TEXT.vapidEntered}</li>}
    </ul>
  );
}

function PasteConfig({ draft }: Readonly<{ draft: PushWebDraft }>) {
  const {
    summary,
    bindFile,
    bindPaste,
    bindVapid,
    pickFile,
    acceptText,
    acceptTyped,
    openFilePicker,
    remove,
    refresh,
    fileName,
  } = draft;
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={bindFile}
        type="file"
        accept=".json,.js,application/json,text/javascript"
        hidden
        aria-label={WEB_TEXT.chooseFile}
        onChange={(event) => {
          pickFile(event.target.files?.[0]).catch(() => acceptText(""));
        }}
      />
      {summary.added ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{fileName || WEB_TEXT.added}</span>
            <Button type="button" variant="outline" size="xs" onClick={remove}>
              {WEB_TEXT.remove}
            </Button>
          </div>
          <Checks draft={draft} />
          <HelpText>{WEB_TEXT.ignored}</HelpText>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            ref={bindPaste}
            aria-label={WEB_TEXT.pasteLabel}
            placeholder={WEB_TEXT.pastePlaceholder}
            autoComplete="off"
            spellCheck={false}
            maxLength={20_000}
            rows={4}
            className="font-mono text-xs"
            onPaste={(event) => {
              event.preventDefault();
              acceptText(event.clipboardData.getData("text"));
            }}
            onBlur={acceptTyped}
          />
          <div>
            <Button type="button" variant="outline" size="xs" onClick={openFilePicker}>
              {WEB_TEXT.chooseFile}
            </Button>
          </div>
        </div>
      )}
      <MaskedField label={WEB_TEXT.vapidPaste} bind={bindVapid} onChange={refresh} />
    </div>
  );
}

function TypedFields({ draft }: Readonly<{ draft: PushWebDraft }>) {
  const { bindApiKey, bindAppId, bindSenderId, bindVapid, refresh, summary } = draft;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MaskedField label={WEB_TEXT.apiKey} bind={bindApiKey} onChange={refresh} />
        <MaskedField label={WEB_TEXT.appId} bind={bindAppId} onChange={refresh} />
        <MaskedField label={WEB_TEXT.senderId} bind={bindSenderId} onChange={refresh} />
        <MaskedField label={WEB_TEXT.vapid} bind={bindVapid} onChange={refresh} />
      </div>
      {summary.formatsOk && <p className="text-xs text-success">✓ {WEB_TEXT.allFilled}</p>}
    </div>
  );
}

interface PushWebConfigPanelProps {
  draft: PushWebDraft;
  settings: IPushSettings;
  onOpenGuide: () => void;
}

/** The web config of the Web row: pasted or chosen firebaseConfig, or four typed fields. Values stay hidden. */
export function PushWebConfigPanel({
  draft,
  settings,
  onOpenGuide,
}: Readonly<PushWebConfigPanelProps>) {
  const paste = draft.source === WEB_SOURCE.Paste;
  const blocked = draft.summary.sameProject === false;
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3.5">
      <span className="text-sm font-medium">{WEB_TEXT.title}</span>
      <span className="text-sm text-medium-emphasis">{storedText(settings)}</span>
      <SegmentedControl
        label={WEB_TEXT.source}
        options={SOURCE_OPTIONS}
        value={draft.source}
        onChange={draft.setSource}
      />
      {paste ? <PasteConfig draft={draft} /> : <TypedFields draft={draft} />}
      {(draft.error || blocked) && (
        <p className="text-xs text-error" role="alert">
          {WEB_PROBLEM_TEXT[draft.error ?? "otherProject"]}
        </p>
      )}
      <HelpText>{WEB_TEXT.help}</HelpText>
      <div>
        <Button type="button" variant="link" size="xs" onClick={onOpenGuide}>
          {PUSH_TEXT.howToFind}
        </Button>
      </div>
    </div>
  );
}
