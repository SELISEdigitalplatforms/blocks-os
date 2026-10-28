import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import type { IPushSettings } from "../models/push.model";
import { PUSH_TEXT } from "../constants/notification-ui.constant";
import { KEY_SOURCE, type PushKeyDraft } from "../hooks/use-push-key-draft";
import { formatDate } from "../utils/push-format";
import { FormRow, HelpText } from "./notification-form/form-row";
import { SegmentedControl } from "./notification-form/segmented-control";

const SOURCE_OPTIONS = [
  { value: KEY_SOURCE.Upload, label: PUSH_TEXT.upload },
  { value: KEY_SOURCE.Manual, label: PUSH_TEXT.manualMode },
] as const;

const keyUploadedText = (settings: IPushSettings): string => {
  const parts: string[] = [PUSH_TEXT.keyUploaded];
  if (settings.keyUploadedAt) parts.push("on", formatDate(settings.keyUploadedAt));
  if (settings.keyUploadedBy) parts.push("by", settings.keyUploadedBy);
  return parts.join(" ");
};

interface PushKeyFieldsProps {
  draft: PushKeyDraft;
  settings: IPushSettings;
  onOpenGuide: () => void;
}

/** Read-only project id: it always comes from the key or its email, so it can never disagree with the key. */
function ProjectFromKey({ draft, settings }: Readonly<Omit<PushKeyFieldsProps, "onOpenGuide">>) {
  const manual = draft.source === KEY_SOURCE.Manual;
  const projectId = draft.newProjectId ?? settings.projectId;
  if (!projectId) {
    return (
      <p className="pt-1.5 text-sm text-medium-emphasis">
        {manual ? PUSH_TEXT.noProjectManual : PUSH_TEXT.noProject}
      </p>
    );
  }
  const fromEmail = manual && !!draft.newProjectId;
  return (
    <p className="pt-1.5 text-sm">
      <span>{projectId}</span>{" "}
      <span className="text-medium-emphasis">
        {fromEmail ? PUSH_TEXT.fromEmail : PUSH_TEXT.fromKey}
      </span>
    </p>
  );
}

function UploadKey({ draft, settings }: Readonly<Omit<PushKeyFieldsProps, "onOpenGuide">>) {
  const { bindFileInput, fileName, openFilePicker, pickFile, setError } = draft;
  return (
    <div className="flex flex-col gap-1.5">
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
      {fileName && (
        <>
          <p className="text-xs text-success">✓ {PUSH_TEXT.keyChecked}</p>
          <HelpText>{PUSH_TEXT.contentHidden}</HelpText>
        </>
      )}
    </div>
  );
}

function ManualKey({ draft }: Readonly<{ draft: PushKeyDraft }>) {
  const { bindPrivateKey, clientEmail, newProjectId, setClientEmail } = draft;
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
      {newProjectId && <p className="text-xs text-success">✓ {PUSH_TEXT.emailChecked}</p>}
      <HelpText>{PUSH_TEXT.manualHelp}</HelpText>
    </div>
  );
}

/** Firebase project and service account key rows: upload the key file or type the email and private key. */
export function PushKeyFields({ draft, settings, onOpenGuide }: Readonly<PushKeyFieldsProps>) {
  const manual = draft.source === KEY_SOURCE.Manual;
  const otherProject =
    settings.hasKey &&
    !!settings.projectId &&
    !!draft.newProjectId &&
    draft.newProjectId !== settings.projectId;
  return (
    <>
      <FormRow label={PUSH_TEXT.firebaseProject}>
        <ProjectFromKey draft={draft} settings={settings} />
        {otherProject && <p className="text-xs text-warning-700">{PUSH_TEXT.otherProject}</p>}
        {otherProject && settings.hasWebConfig && (
          <p className="text-xs text-warning-700">{PUSH_TEXT.otherProjectWeb}</p>
        )}
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
        <div>
          <Button type="button" variant="link" size="xs" onClick={onOpenGuide}>
            {PUSH_TEXT.howToFind}
          </Button>
        </div>
      </FormRow>
    </>
  );
}
