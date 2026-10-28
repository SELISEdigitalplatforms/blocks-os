import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import type { IPushSettings } from "../models/notification-config.model";
import { PUSH_TEXT } from "../constants/notification-ui.constant";
import { KEY_SOURCE, type PushKeyDraft } from "../hooks/use-push-key-draft";
import { FormRow, HelpText } from "./notification-form/form-row";
import { SegmentedControl } from "./notification-form/segmented-control";

const SOURCE_OPTIONS = [
  { value: KEY_SOURCE.Upload, label: PUSH_TEXT.upload },
  { value: KEY_SOURCE.Manual, label: PUSH_TEXT.manualMode },
] as const;

const keyUploadedText = (settings: IPushSettings): string => {
  const parts: string[] = [PUSH_TEXT.keyUploaded];
  if (settings.keyUploadedAt)
    parts.push("on", new Date(settings.keyUploadedAt).toLocaleDateString());
  if (settings.keyUploadedBy) parts.push("by", settings.keyUploadedBy);
  return parts.join(" ");
};

interface PushKeyFieldsProps {
  draft: PushKeyDraft;
  settings: IPushSettings;
}

/** Read-only project id: it always comes from the key, so it can never disagree with it. */
function ProjectFromKey({ draft, settings }: Readonly<PushKeyFieldsProps>) {
  const projectId = draft.newProjectId ?? settings.projectId;
  if (!projectId)
    return <p className="pt-1.5 text-sm text-medium-emphasis">{PUSH_TEXT.noProject}</p>;
  return (
    <p className="pt-1.5 text-sm">
      <span>{projectId}</span> <span className="text-medium-emphasis">{PUSH_TEXT.fromKey}</span>
    </p>
  );
}

function UploadKey({ draft, settings }: Readonly<PushKeyFieldsProps>) {
  const { bindFileInput, fileName, openFilePicker, pickFile, setError } = draft;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={bindFileInput}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label={PUSH_TEXT.upload}
        onChange={(event) => {
          pickFile(event.target.files?.[0]).catch(() => setError(PUSH_TEXT.invalidKey));
        }}
      />
      <Button type="button" variant="outline" size="xs" onClick={openFilePicker}>
        {settings.hasKey ? PUSH_TEXT.replace : PUSH_TEXT.upload}
      </Button>
      {fileName && (
        <span className="text-sm">
          {PUSH_TEXT.chosenFile} {fileName}
        </span>
      )}
    </div>
  );
}

function ManualKey({ draft }: Readonly<{ draft: PushKeyDraft }>) {
  const { bindPrivateKey, clientEmail, setClientEmail } = draft;
  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label={PUSH_TEXT.clientEmail}
        placeholder={PUSH_TEXT.clientEmailPlaceholder}
        autoComplete="off"
        maxLength={320}
        value={clientEmail}
        onChange={(event) => setClientEmail(event.target.value)}
      />
      <Textarea
        ref={bindPrivateKey}
        aria-label={PUSH_TEXT.privateKey}
        placeholder={PUSH_TEXT.privateKeyPlaceholder}
        autoComplete="off"
        spellCheck={false}
        maxLength={10_000}
        rows={5}
        className="font-mono text-xs"
      />
      <HelpText>{PUSH_TEXT.manualHelp}</HelpText>
    </div>
  );
}

/** Firebase project and service account key rows: upload the key file or type its three fields. */
export function PushKeyFields({ draft, settings }: Readonly<PushKeyFieldsProps>) {
  const manual = draft.source === KEY_SOURCE.Manual;
  const otherProject =
    settings.hasKey &&
    !!settings.projectId &&
    !!draft.newProjectId &&
    draft.newProjectId !== settings.projectId;
  return (
    <>
      <FormRow label={PUSH_TEXT.firebaseProject}>
        {manual ? (
          <Input
            aria-label={PUSH_TEXT.projectId}
            placeholder={PUSH_TEXT.projectIdPlaceholder}
            autoComplete="off"
            maxLength={100}
            value={draft.projectId}
            onChange={(event) => draft.setProjectId(event.target.value)}
          />
        ) : (
          <ProjectFromKey draft={draft} settings={settings} />
        )}
        {otherProject && <p className="text-xs text-warning-700">{PUSH_TEXT.otherProject}</p>}
      </FormRow>
      <FormRow label={PUSH_TEXT.keyLabel}>
        {settings.hasKey && <span className="text-sm">{keyUploadedText(settings)}</span>}
        <SegmentedControl
          label={PUSH_TEXT.keySource}
          options={SOURCE_OPTIONS}
          value={draft.source}
          onChange={draft.setSource}
        />
        {manual ? <ManualKey draft={draft} /> : <UploadKey draft={draft} settings={settings} />}
        {draft.error && (
          <p className="text-xs text-error" role="alert">
            {draft.error}
          </p>
        )}
        <HelpText>{PUSH_TEXT.keyHelp}</HelpText>
      </FormRow>
    </>
  );
}
