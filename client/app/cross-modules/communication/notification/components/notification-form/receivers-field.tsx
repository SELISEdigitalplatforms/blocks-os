import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
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

function MatchChoice({ values, onPatch }: Readonly<ReceiversFieldProps>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{NOTIFICATION_TEXT.match}</legend>
      <RadioGroup
        aria-label={NOTIFICATION_TEXT.match}
        value={String(values.match)}
        onValueChange={(value) => onPatch({ match: Number(value) })}
        className="gap-1.5"
      >
        {MATCH_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm">
            <RadioGroupItem value={String(option.value)} className="mt-0.5" />
            <span>
              {option.label}
              <span className="block text-xs text-medium-emphasis">{option.help}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <HelpText>{NOTIFICATION_TEXT.matchHelp}</HelpText>
    </fieldset>
  );
}

/** Targeted: the Owner and Done by ticks on their own, then one box with Match and the lists it combines. */
function SelectedRules({ values, onPatch }: Readonly<ReceiversFieldProps>) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <CheckRow
          id="also-named"
          label={NOTIFICATION_TEXT.alsoNamed}
          checked={values.alsoNamedUsers}
          onChange={(alsoNamedUsers) => onPatch({ alsoNamedUsers })}
        />
        <HelpText>{NOTIFICATION_TEXT.alsoNamedHelp}</HelpText>
      </div>
      <div className="flex flex-col gap-1">
        <CheckRow
          id="also-done-by"
          label={NOTIFICATION_TEXT.alsoDoneBy}
          checked={values.alsoDoneBy}
          onChange={(alsoDoneBy) => onPatch({ alsoDoneBy })}
        />
        <HelpText>{NOTIFICATION_TEXT.alsoDoneByHelp}</HelpText>
      </div>
      <div className="flex flex-col gap-2.5 rounded-md border bg-muted/40 p-3">
        <MatchChoice values={values} onPatch={onPatch} />
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
      </div>
      <SubscriptionFilters filters={values.filters} onChange={(filters) => onPatch({ filters })} />
    </div>
  );
}

/** Recipients: all users, or Targeted — Owner, Done by and/or the users, roles and permissions picked. */
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
      {values.level === AUDIENCE_LEVEL.AllUsers && values.isBuiltIn && (
        <p className="text-xs text-warning" role="alert">
          {NOTIFICATION_TEXT.allUsersBuiltInWarning}
        </p>
      )}
      {values.level === AUDIENCE_LEVEL.Selected && (
        <SelectedRules values={values} onPatch={onPatch} />
      )}
    </>
  );
}
