import { Plus, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui-kits/button/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  AUDIENCE_HINT,
  AUDIENCE_MAX_FILTERS,
  AUDIENCE_MAX_OTHER,
  AUDIENCE_MAX_TEXT,
  AUDIENCE_MAX_USERS,
  AUDIENCE_MODE_EVERYONE,
  AUDIENCE_MODE_RULES,
  AUDIENCE_MODE_SENDER,
  audienceMatches,
} from "../constants/notification.constant";
import type { INotificationAudienceFilter } from "../models/notification-config.model";
import type { IAudienceFormValues } from "../utils/notification-audience";
import { AudienceMultiPicker } from "./audience-multi-picker";

const MODES = [
  { value: AUDIENCE_MODE_SENDER, label: "Code that sends it decides" },
  { value: AUDIENCE_MODE_EVERYONE, label: "Everyone in this project" },
  { value: AUDIENCE_MODE_RULES, label: "Only these people" },
];

const emptyFilter: INotificationAudienceFilter = { context: "", actionName: "", value: "" };

interface NotificationAudienceFieldProps {
  projectKey: string;
}

/** "Who receives" section of the notification modal. Lives inside the modal's form. */
export const NotificationAudienceField = ({ projectKey }: NotificationAudienceFieldProps) => {
  const form = useFormContext<IAudienceFormValues>();
  const mode = form.watch("audienceMode");
  const filters = form.watch("audienceFilters");

  const setFilter = (index: number, patch: Partial<INotificationAudienceFilter>) =>
    form.setValue(
      "audienceFilters",
      filters.map((filter, at) => (at === index ? { ...filter, ...patch } : filter)),
      { shouldDirty: true, shouldValidate: true },
    );

  const removeFilter = (index: number) =>
    form.setValue(
      "audienceFilters",
      filters.filter((_, at) => at !== index),
      { shouldDirty: true, shouldValidate: true },
    );

  const addFilter = () =>
    form.setValue("audienceFilters", [...filters, { ...emptyFilter }], {
      shouldDirty: true,
      shouldValidate: true,
    });

  const picker = (
    name: "audienceUserIds" | "audienceOrganizationIds" | "audienceRoles" | "audiencePermissions",
    kind: "users" | "organizations" | "roles" | "permissions",
    label: string,
    max: number,
  ) => (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => (
        <AudienceMultiPicker
          kind={kind}
          label={label}
          projectKey={projectKey}
          selected={field.value}
          onChange={(next) => field.onChange(next)}
          max={max}
        />
      )}
    />
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Who receives</legend>
      <FormField
        name="audienceMode"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                aria-label="Who receives"
                className="gap-2"
              >
                {MODES.map((item) => (
                  <div key={item.value} className="flex items-center gap-2">
                    <RadioGroupItem value={item.value} id={`audience-${item.value}`} />
                    <FormLabel htmlFor={`audience-${item.value}`} className="m-0 font-normal">
                      {item.label}
                    </FormLabel>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {mode !== AUDIENCE_MODE_SENDER && (
        <p className="text-xs text-medium-emphasis">{AUDIENCE_HINT}</p>
      )}
      {mode === AUDIENCE_MODE_RULES && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <FormField
            name="audienceMatch"
            control={form.control}
            render={({ field }) => (
              <FormItem className="sm:max-w-48">
                <FormLabel>Match</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(Number(val))}
                  defaultValue={String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select match" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {audienceMatches.map((item) => (
                      <SelectItem key={item.value} value={String(item.value)}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {picker("audienceUserIds", "users", "Users", AUDIENCE_MAX_USERS)}
            {picker(
              "audienceOrganizationIds",
              "organizations",
              "Organizations",
              AUDIENCE_MAX_OTHER,
            )}
            {picker("audienceRoles", "roles", "Roles", AUDIENCE_MAX_OTHER)}
            {picker("audiencePermissions", "permissions", "Permissions", AUDIENCE_MAX_OTHER)}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Custom filters</span>
            {filters.map((filter, index) => (
              // Rows have no id of their own; they are only added and removed, so the index is a stable key.
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                <Input
                  aria-label={`Filter ${index + 1} context`}
                  placeholder="Context *"
                  maxLength={AUDIENCE_MAX_TEXT}
                  value={filter.context}
                  onChange={(event) => setFilter(index, { context: event.target.value })}
                />
                <Input
                  aria-label={`Filter ${index + 1} action`}
                  placeholder="Action"
                  maxLength={AUDIENCE_MAX_TEXT}
                  value={filter.actionName}
                  onChange={(event) => setFilter(index, { actionName: event.target.value })}
                />
                <Input
                  aria-label={`Filter ${index + 1} value`}
                  placeholder="Value"
                  maxLength={AUDIENCE_MAX_TEXT}
                  value={filter.value}
                  onChange={(event) => setFilter(index, { value: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove filter ${index + 1}`}
                  onClick={() => removeFilter(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1"
              disabled={filters.length >= AUDIENCE_MAX_FILTERS}
              onClick={addFilter}
            >
              <Plus className="h-4 w-4" />
              Add filter
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
};
