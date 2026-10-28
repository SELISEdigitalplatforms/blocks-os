import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import type { NotificationFormValues } from "../../utils/notification-form";
import {
  AUDIENCE_LEVEL,
  MATCH_OPTIONS,
  NOTIFICATION_TEXT,
  RECEIVER_HELP,
  RECEIVER_OPTIONS,
} from "../../constants/notification-ui.constant";
import { SegmentedControl } from "./segmented-control";
import { CheckRow, HelpText } from "./form-row";
import { PermissionPicker, RolePicker, UserPicker } from "./audience-pickers";
import { SubscriptionFilters } from "./subscription-filters";

interface ReceiversFieldProps {
  values: NotificationFormValues;
  onPatch: (patch: Partial<NotificationFormValues>) => void;
}

function SubRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[110px_minmax(0,1fr)]">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function SelectedRules({ values, onPatch }: Readonly<ReceiversFieldProps>) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-muted/40 p-3">
      <SubRow label={NOTIFICATION_TEXT.match}>
        <Select
          value={String(values.match)}
          onValueChange={(value) => onPatch({ match: Number(value) })}
        >
          <SelectTrigger aria-label={NOTIFICATION_TEXT.match} className="max-w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SubRow>
      <SubRow label={NOTIFICATION_TEXT.users}>
        <UserPicker values={values.userIds} onChange={(userIds) => onPatch({ userIds })} />
      </SubRow>
      <SubRow label={NOTIFICATION_TEXT.roles}>
        <RolePicker values={values.roles} onChange={(roles) => onPatch({ roles })} />
      </SubRow>
      <SubRow label={NOTIFICATION_TEXT.permissions}>
        <PermissionPicker
          values={values.permissions}
          onChange={(permissions) => onPatch({ permissions })}
        />
      </SubRow>
      <CheckRow
        id="also-named"
        label={NOTIFICATION_TEXT.alsoNamed}
        checked={values.alsoNamedUsers}
        onChange={(alsoNamedUsers) => onPatch({ alsoNamedUsers })}
      />
      <SubscriptionFilters filters={values.filters} onChange={(filters) => onPatch({ filters })} />
    </div>
  );
}

/** Receivers: all users, affected users only, or a chosen set of users, roles and permissions. */
export function ReceiversField({ values, onPatch }: Readonly<ReceiversFieldProps>) {
  return (
    <>
      <SegmentedControl
        label={NOTIFICATION_TEXT.receiversLabel}
        options={RECEIVER_OPTIONS}
        value={values.level}
        onChange={(level) => onPatch({ level })}
      />
      <HelpText>
        {RECEIVER_HELP[values.level]} {NOTIFICATION_TEXT.receiversNarrowHelp}
      </HelpText>
      {values.level === AUDIENCE_LEVEL.Selected && (
        <SelectedRules values={values} onPatch={onPatch} />
      )}
    </>
  );
}
