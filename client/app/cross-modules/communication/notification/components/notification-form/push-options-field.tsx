import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { PUSH_PLATFORMS, type PushPlatform } from "../../models/push.model";
import {
  ANDROID_FIELDS,
  DEFAULT_VALUE,
  EXPIRY_OPTIONS,
  INTERRUPTION_OPTIONS,
  IOS_FIELDS,
  PLATFORM_LABEL,
  PRIORITY_OPTIONS,
  PUSH_FORM_TEXT,
  URGENCY_OPTIONS,
  WEB_FIELDS,
  type IOption,
} from "../../constants/push-ui.constant";
import type { PushOptionValues } from "../../utils/push-options";
import { HelpText } from "./form-row";

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-medium-emphasis">{label}</span>
      {children}
    </div>
  );
}

interface OptionSelectProps {
  label: string;
  value: string;
  options: IOption[];
  onChange: (value: string) => void;
}

/** A select whose first choice is "Default" (empty). A stored value that is not in the list stays visible. */
function OptionSelect({ label, value, options, onChange }: Readonly<OptionSelectProps>) {
  const known = !value || options.some((option) => option.value === value);
  const all = known ? options : [...options, { value, label: value }];
  return (
    <Field label={label}>
      <Select
        value={value || DEFAULT_VALUE}
        onValueChange={(next) => onChange(next === DEFAULT_VALUE ? "" : next)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>{PUSH_FORM_TEXT.default}</SelectItem>
          {all.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}

function TextField({
  label,
  value,
  maxLength = 100,
  placeholder,
  onChange,
}: Readonly<TextFieldProps>) {
  return (
    <Field label={label}>
      <Input
        aria-label={label}
        autoComplete="off"
        maxLength={maxLength}
        placeholder={placeholder ?? PUSH_FORM_TEXT.default}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

interface PanelProps {
  values: PushOptionValues;
  onChange: (values: PushOptionValues) => void;
}

function AndroidPanel({ values, onChange }: Readonly<PanelProps>) {
  const a = values.android;
  const set = (patch: Partial<typeof a>) => onChange({ ...values, android: { ...a, ...patch } });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <OptionSelect
        label={ANDROID_FIELDS.priority}
        value={a.priority}
        options={PRIORITY_OPTIONS}
        onChange={(priority) => set({ priority })}
      />
      <TextField
        label={ANDROID_FIELDS.channel}
        value={a.channelId}
        onChange={(channelId) => set({ channelId })}
      />
      <TextField
        label={ANDROID_FIELDS.sound}
        value={a.sound}
        onChange={(sound) => set({ sound })}
      />
      <OptionSelect
        label={ANDROID_FIELDS.expires}
        value={a.ttl}
        options={EXPIRY_OPTIONS}
        onChange={(ttl) => set({ ttl })}
      />
      <TextField
        label={ANDROID_FIELDS.collapseKey}
        value={a.collapseKey}
        onChange={(collapseKey) => set({ collapseKey })}
      />
      <TextField
        label={ANDROID_FIELDS.color}
        value={a.color}
        maxLength={7}
        placeholder="#0B5CAD"
        onChange={(color) => set({ color })}
      />
    </div>
  );
}

function IosPanel({ values, onChange }: Readonly<PanelProps>) {
  const i = values.ios;
  const set = (patch: Partial<typeof i>) => onChange({ ...values, ios: { ...i, ...patch } });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField label={IOS_FIELDS.sound} value={i.sound} onChange={(sound) => set({ sound })} />
      <TextField
        label={IOS_FIELDS.badge}
        value={i.badge}
        maxLength={4}
        onChange={(badge) => set({ badge })}
      />
      <OptionSelect
        label={IOS_FIELDS.priority}
        value={i.priority}
        options={PRIORITY_OPTIONS}
        onChange={(priority) => set({ priority })}
      />
      <OptionSelect
        label={IOS_FIELDS.interruption}
        value={i.interruptionLevel}
        options={INTERRUPTION_OPTIONS}
        onChange={(interruptionLevel) => set({ interruptionLevel })}
      />
      <TextField
        label={IOS_FIELDS.thread}
        value={i.threadId}
        onChange={(threadId) => set({ threadId })}
      />
      <OptionSelect
        label={IOS_FIELDS.expires}
        value={i.ttl}
        options={EXPIRY_OPTIONS}
        onChange={(ttl) => set({ ttl })}
      />
    </div>
  );
}

function WebPanel({ values, onChange }: Readonly<PanelProps>) {
  const w = values.web;
  const set = (patch: Partial<typeof w>) => onChange({ ...values, web: { ...w, ...patch } });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField
        label={WEB_FIELDS.icon}
        value={w.icon}
        maxLength={500}
        placeholder="https://"
        onChange={(icon) => set({ icon })}
      />
      <OptionSelect
        label={WEB_FIELDS.urgency}
        value={w.urgency}
        options={URGENCY_OPTIONS}
        onChange={(urgency) => set({ urgency })}
      />
      <OptionSelect
        label={WEB_FIELDS.expires}
        value={w.ttl}
        options={EXPIRY_OPTIONS}
        onChange={(ttl) => set({ ttl })}
      />
      <div className="flex items-center gap-2 pt-5">
        <Checkbox
          id="web-require-interaction"
          checked={w.requireInteraction}
          onCheckedChange={(checked) => set({ requireInteraction: checked === true })}
        />
        <label htmlFor="web-require-interaction" className="text-sm">
          {WEB_FIELDS.requireInteraction}
        </label>
      </div>
    </div>
  );
}

const PANELS: Record<PushPlatform, (props: Readonly<PanelProps>) => ReactNode> = {
  android: AndroidPanel,
  ios: IosPanel,
  web: WebPanel,
};

/** Optional per-platform options in tabs. Empty fields use the defaults. */
export function PushOptionsField({ values, onChange }: Readonly<PanelProps>) {
  return (
    <div className="flex flex-col gap-2">
      <HelpText>{PUSH_FORM_TEXT.optionsHelp}</HelpText>
      <Tabs defaultValue="android">
        <TabsList aria-label={PUSH_FORM_TEXT.optionsAria}>
          {PUSH_PLATFORMS.map((platform) => (
            <TabsTrigger key={platform} value={platform}>
              {PLATFORM_LABEL[platform]}
            </TabsTrigger>
          ))}
        </TabsList>
        {PUSH_PLATFORMS.map((platform) => {
          const Panel = PANELS[platform];
          return (
            <TabsContent key={platform} value={platform} className="pt-3">
              <Panel values={values} onChange={onChange} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
