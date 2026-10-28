import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { getRuntimeEnv } from "@/lib/runtime-env";
import type { NotificationFormValues } from "../../utils/notification-form";
import { usePushMessageKeys } from "../../hooks/use-push-message-keys";
import {
  defaultCulture,
  missingLanguages,
  placeholderFields,
  previewText,
  splitKeyNames,
  withCurrent,
} from "../../utils/push-preview";
import {
  LIMITS,
  MISSING_LANGUAGE_NOTE,
  NOTIFICATION_LOCALIZATION_MODULE,
  NOTIFICATION_TEXT,
} from "../../constants/notification-ui.constant";
import { HelpText } from "./form-row";

interface PushMessageFieldProps {
  values: NotificationFormValues;
  onPatch: (patch: Partial<NotificationFormValues>) => void;
  /** Personal notices: the keys are fixed, so only the preview shows. */
  locked: boolean;
  pushReady: boolean;
  onSetUpPush: () => void;
}

/** Where the Localization app lives, or "" when this environment does not name it. */
export const localizationUrl = (): string => {
  const raw = getRuntimeEnv("BLOCKS_LOCALIZATION_CALLBACK_URL");
  try {
    const url = new URL(raw);
    url.search = "";
    url.hash = "";
    url.pathname = "/";
    url.searchParams.set("module", NOTIFICATION_LOCALIZATION_MODULE);
    return url.toString();
  } catch {
    return "";
  }
};

function KeySelect({
  label,
  value,
  names,
  onChange,
}: Readonly<{ label: string; value: string; names: string[]; onChange: (value: string) => void }>) {
  return (
    <div className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[110px_minmax(0,1fr)]">
      <span className="text-sm">{label}</span>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={NOTIFICATION_TEXT.selectKey} />
        </SelectTrigger>
        <SelectContent>
          {names.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The push title, message and link. Texts come from Localization; the config holds the keys. */
export function PushMessageField({
  values,
  onPatch,
  locked,
  pushReady,
  onSetUpPush,
}: Readonly<PushMessageFieldProps>) {
  const { keys, languages, isError } = usePushMessageKeys(true);
  const [pickedLanguage, setPickedLanguage] = useState("");
  const fallback = defaultCulture(languages);
  const culture = pickedLanguage || fallback;
  const { titles, bodies } = splitKeyNames(keys);
  const title = previewText(keys, values.titleKey, culture, fallback);
  const body = previewText(keys, values.bodyKey, culture, fallback);
  const missing = missingLanguages(keys, languages, values.titleKey, values.bodyKey);
  const fields = placeholderFields([title, body]);
  const manageUrl = localizationUrl();

  const preview = (
    <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3" aria-live="polite">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-md bg-primary/80" />
      <div className="flex min-w-0 flex-col">
        <b className="text-sm">{title}</b>
        <span className="text-sm text-medium-emphasis">{body}</span>
      </div>
    </div>
  );

  if (locked) {
    return (
      <>
        {preview}
        <HelpText>{NOTIFICATION_TEXT.fixedText}</HelpText>
      </>
    );
  }

  return (
    <>
      {!pushReady && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <span>{NOTIFICATION_TEXT.pushNotReady}</span>
          <Button type="button" variant="outline" size="xs" onClick={onSetUpPush}>
            {NOTIFICATION_TEXT.setUpPush}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <KeySelect
            label={NOTIFICATION_TEXT.titleKey}
            value={values.titleKey}
            names={withCurrent(titles, values.titleKey)}
            onChange={(titleKey) => onPatch({ titleKey })}
          />
          <KeySelect
            label={NOTIFICATION_TEXT.messageKey}
            value={values.bodyKey}
            names={withCurrent(bodies, values.bodyKey)}
            onChange={(bodyKey) => onPatch({ bodyKey })}
          />
          <div className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[110px_minmax(0,1fr)]">
            <span className="text-sm">{NOTIFICATION_TEXT.openLink}</span>
            <Input
              aria-label={NOTIFICATION_TEXT.openLinkAria}
              placeholder={NOTIFICATION_TEXT.optional}
              maxLength={LIMITS.textLength}
              value={values.link}
              onChange={(event) => onPatch({ link: event.target.value })}
            />
          </div>
          <HelpText>{NOTIFICATION_TEXT.localizationHelp}</HelpText>
          {fields.length > 0 && (
            <HelpText>
              Fields: {fields.map((field) => `{{${field}}}`).join(" ")}
            </HelpText>
          )}
          {isError && <HelpText>{NOTIFICATION_TEXT.keysLoadFailed}</HelpText>}
          {manageUrl && (
            <div>
              <Button type="button" variant="link" size="xs" asChild>
                <a href={manageUrl} target="_blank" rel="noopener noreferrer">
                  {NOTIFICATION_TEXT.manageKeys}
                </a>
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[110px_minmax(0,1fr)]">
            <span className="text-sm">{NOTIFICATION_TEXT.previewIn}</span>
            <Select value={culture} onValueChange={setPickedLanguage}>
              <SelectTrigger aria-label={NOTIFICATION_TEXT.previewLanguage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((language) => (
                  <SelectItem key={language.languageCode} value={language.languageCode}>
                    {language.languageName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preview}
          {missing.length > 0 && <HelpText>{MISSING_LANGUAGE_NOTE(missing)}</HelpText>}
        </div>
      </div>
    </>
  );
}
