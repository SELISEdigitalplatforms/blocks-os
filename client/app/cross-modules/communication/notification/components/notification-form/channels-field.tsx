import { Input } from "@/components/ui-kits/input/input";
import type { NotificationFormValues } from "../../utils/notification-form";
import { NOTIFICATION_TEXT } from "../../constants/notification-ui.constant";
import { CheckRow, HelpText } from "./form-row";

interface ChannelsFieldProps {
  values: NotificationFormValues;
  onPatch: (patch: Partial<NotificationFormValues>) => void;
}

/** In-app, mobile push and inbox switches, with the rate limit per minute. */
export function ChannelsField({ values, onPatch }: Readonly<ChannelsFieldProps>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
        <CheckRow
          id="channel-live"
          label={NOTIFICATION_TEXT.inApp}
          checked={values.liveEnabled}
          onChange={(liveEnabled) => onPatch({ liveEnabled })}
        />
        <CheckRow
          id="channel-push"
          label={NOTIFICATION_TEXT.mobilePushChannel}
          checked={values.pushEnabled}
          onChange={(pushEnabled) => onPatch({ pushEnabled })}
        />
        <CheckRow
          id="channel-inbox"
          label={NOTIFICATION_TEXT.saveToInbox}
          checked={values.enablePersistence}
          onChange={(enablePersistence) => onPatch({ enablePersistence })}
        />
        <span className="flex items-center gap-1.5">
          <HelpText>{NOTIFICATION_TEXT.rateLimit}</HelpText>
          <Input
            aria-label={NOTIFICATION_TEXT.rateLimitAria}
            inputMode="numeric"
            className="h-8 w-20"
            value={values.rateLimit}
            onChange={(event) => onPatch({ rateLimit: event.target.value })}
          />
          <HelpText>{NOTIFICATION_TEXT.perMinute}</HelpText>
        </span>
      </div>
      <HelpText>{NOTIFICATION_TEXT.saveToInboxHelp}</HelpText>
    </div>
  );
}
