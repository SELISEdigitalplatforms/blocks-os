import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui-kits/collapsible/collapsible";
import type { NotificationFormValues } from "../../utils/notification-form";
import { notificationImportances, notificationKinds } from "../../constants/notification.constant";
import { NOTIFICATION_TEXT } from "../../constants/notification-ui.constant";
import { CheckRow, HelpText } from "./form-row";

interface DeveloperNotesProps {
  values: NotificationFormValues;
  onPatch: (patch: Partial<NotificationFormValues>) => void;
  /** Only the root project may mark a new notification built-in (all projects). */
  canMarkBuiltIn: boolean;
  /** A built-in's notes are shared by all projects, so outside the root project they are view-only. */
  readOnly?: boolean;
}

function OptionSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: Readonly<{
  label: string;
  value: number;
  options: { label: string; value: number }[];
  disabled: boolean;
  onChange: (value: number) => void;
}>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm">{label}</span>
      <Select value={String(value)} disabled={disabled} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Folded notes for application developers: importance, kind, source service and hints. */
export function DeveloperNotes({
  values,
  onPatch,
  canMarkBuiltIn,
  readOnly = false,
}: Readonly<DeveloperNotesProps>) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
          <ChevronDown className="h-4 w-4" />
          <span>{NOTIFICATION_TEXT.developerNotes}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-3">
        <HelpText>
          {readOnly
            ? NOTIFICATION_TEXT.developerNotesReadOnly
            : NOTIFICATION_TEXT.developerNotesHelp}
        </HelpText>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OptionSelect
            label={NOTIFICATION_TEXT.importance}
            value={values.importance}
            options={notificationImportances}
            disabled={readOnly}
            onChange={(importance) => onPatch({ importance })}
          />
          <OptionSelect
            label={NOTIFICATION_TEXT.kind}
            value={values.kind}
            options={notificationKinds}
            disabled={readOnly}
            onChange={(kind) => onPatch({ kind })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">{NOTIFICATION_TEXT.sourceService}</span>
          <Input
            aria-label={NOTIFICATION_TEXT.sourceService}
            value={values.sourceService}
            maxLength={100}
            disabled={readOnly}
            onChange={(event) => onPatch({ sourceService: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">{NOTIFICATION_TEXT.recommendation}</span>
          <Textarea
            rows={2}
            aria-label={NOTIFICATION_TEXT.recommendation}
            maxLength={1000}
            value={values.consumerAppRecommendation}
            disabled={readOnly}
            onChange={(event) => onPatch({ consumerAppRecommendation: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">{NOTIFICATION_TEXT.appNote}</span>
          <Textarea
            rows={2}
            aria-label={NOTIFICATION_TEXT.appNote}
            maxLength={1000}
            value={values.consumerAppNote}
            disabled={readOnly}
            onChange={(event) => onPatch({ consumerAppNote: event.target.value })}
          />
        </div>
        {canMarkBuiltIn && (
          <CheckRow
            id="built-in"
            label={NOTIFICATION_TEXT.builtInAllProjects}
            checked={values.isBuiltIn}
            onChange={(isBuiltIn) => onPatch({ isBuiltIn })}
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
