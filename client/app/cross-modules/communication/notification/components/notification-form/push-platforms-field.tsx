import { PUSH_PLATFORMS, type IPushSettings, type PushPlatform } from "../../models/push.model";
import { PLATFORM_LABEL, PUSH_FORM_TEXT } from "../../constants/push-ui.constant";
import { useNotificationT } from "../../i18n";
import { CheckRow, HelpText } from "./form-row";

interface PushPlatformsFieldProps {
  selected: PushPlatform[];
  /** The Push settings; platforms switched off there show as not active. Unknown while loading. */
  settings?: IPushSettings;
  onChange: (platforms: PushPlatform[]) => void;
}

/** Which platforms this notification goes to. A platform off in the settings stays chosen but is not active. */
export function PushPlatformsField({
  selected,
  settings,
  onChange,
}: Readonly<PushPlatformsFieldProps>) {
  const { t } = useNotificationT();
  const toggle = (platform: PushPlatform, checked: boolean) =>
    onChange(PUSH_PLATFORMS.filter((p) => (p === platform ? checked : selected.includes(p))));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
        {PUSH_PLATFORMS.map((platform) => {
          const off = settings?.platforms?.[platform] === false;
          const label = PLATFORM_LABEL[platform];
          return (
            <CheckRow
              key={platform}
              id={`push-platform-${platform}`}
              label={off ? t("PUSH_PLATFORMS_FIELD.OFF_IN_SETTINGS", { platform: label }) : label}
              checked={selected.includes(platform)}
              onChange={(checked) => toggle(platform, checked)}
            />
          );
        })}
      </div>
      <HelpText>{PUSH_FORM_TEXT.platformsHelp}</HelpText>
    </div>
  );
}
