"use client";

import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import type { DefaultValueKind } from "./rules.types";
import type { DefaultDraft } from "./default-value.util";

/**
 * The inputs of the default-value panel: the kind picker, the Now offset, and the list of fixed values or
 * templates. Stateless; the panel owns the draft.
 */

export const LABEL_CLASS = "text-[11px] font-medium uppercase tracking-widest text-muted-foreground";

const KIND_LABELS: Record<DefaultValueKind, string> = { Static: "Fixed value", Template: "Template", Now: "Now" };

const OFFSET_PARTS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
] as const;

function Labelled({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={LABEL_CLASS}>{label}</span>
      {children}
    </div>
  );
}

/** Static, Template or Now, as a row of radio buttons; only the kinds that fit the property are offered. */
export function KindPicker({
  kinds,
  value,
  hint,
  onChange,
}: Readonly<{ kinds: DefaultValueKind[]; value: DefaultValueKind; hint: string; onChange: (kind: DefaultValueKind) => void }>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn(LABEL_CLASS, "mb-1.5")}>Default kind</legend>
      <div className="flex gap-1">
        {kinds.map((kind) => (
          <label
            key={kind}
            className={cn(
              "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40",
              value === kind
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
            )}
          >
            <input type="radio" name="default-kind" className="sr-only" checked={value === kind} onChange={() => onChange(kind)} />
            {KIND_LABELS[kind]}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </fieldset>
  );
}

/** Now's shift: days, hours, minutes and seconds, with the summary of what will be stored. */
export function OffsetInputs({
  offset,
  invalid,
  summary,
  onChange,
}: Readonly<{
  offset: DefaultDraft["offset"];
  invalid: boolean;
  summary: string | null;
  onChange: (offset: DefaultDraft["offset"]) => void;
}>) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        {OFFSET_PARTS.map(({ key, label }) => (
          <Labelled key={key} label={label}>
            <Input
              type="number"
              step={1}
              aria-label={label}
              value={offset[key]}
              onChange={(e) => onChange({ ...offset, [key]: e.target.value })}
              className={cn("h-9", invalid && "border-rose-500")}
            />
          </Labelled>
        ))}
      </div>
      {summary && <p className="font-mono text-xs text-muted-foreground">{summary}</p>}
    </div>
  );
}

/** How a fixed value of the type is typed: a number, a date-time, or text. */
function inputTypeFor(fieldType: string): "number" | "datetime-local" | "text" {
  if (fieldType === "Int" || fieldType === "Float") return "number";
  return fieldType === "DateTime" ? "datetime-local" : "text";
}

/** One fixed value, entered the way the property's type is. */
export function StaticItemInput({
  fieldType,
  enumValues,
  value,
  label,
  invalid,
  onChange,
}: Readonly<{ fieldType: string; enumValues: string[]; value: string; label: string; invalid: boolean; onChange: (value: string) => void }>) {
  if (fieldType === "Boolean" || fieldType === "Enum") {
    const options = fieldType === "Boolean" ? ["true", "false"] : enumValues;
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full" aria-label={label}>
          <SelectValue placeholder="Select a value" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  // A saved date-time comes back as ISO text ("…T09:00:00Z"); the picker shows minutes, read as UTC.
  const shown = fieldType === "DateTime" ? (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.exec(value)?.[0] ?? value) : value;
  return (
    <Input
      type={inputTypeFor(fieldType)}
      aria-label={label}
      value={shown}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-9", invalid && "border-rose-500")}
    />
  );
}

/** One row of the list: the text and the stable key React tracks it by. */
export interface DraftItem {
  key: string;
  text: string;
}

/** The fixed values or templates: one input, or several with add and remove for a list property. */
export function ItemsEditor({
  items,
  isTemplate,
  isArray,
  fieldType,
  enumValues,
  placeholder,
  invalid,
  onChange,
  onFocusItem,
  onAdd,
  onRemove,
}: Readonly<{
  items: DraftItem[];
  isTemplate: boolean;
  isArray: boolean;
  fieldType: string;
  enumValues: string[];
  placeholder: string;
  invalid: boolean;
  onChange: (index: number, text: string) => void;
  onFocusItem: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}>) {
  const itemLabel = (index: number) => {
    const noun = isTemplate ? "Template" : "Value";
    return isArray ? `${noun} ${index + 1}` : noun;
  };
  return (
    <>
      {items.map((item, index) => (
        <div key={item.key} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {isTemplate ? (
              <Input
                aria-label={itemLabel(index)}
                placeholder={placeholder}
                value={item.text}
                onFocus={() => onFocusItem(index)}
                onChange={(e) => onChange(index, e.target.value)}
                className={cn("h-9 font-mono text-sm", invalid && "border-rose-500")}
              />
            ) : (
              <StaticItemInput
                fieldType={fieldType}
                enumValues={enumValues}
                value={item.text}
                label={itemLabel(index)}
                invalid={invalid}
                onChange={(text) => onChange(index, text)}
              />
            )}
          </div>
          {isArray && items.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-500"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      {isArray && (
        <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add item
        </Button>
      )}
    </>
  );
}

/** The variables a template may insert: single-value properties of the schema, and the caller's values. */
export function templateVariables(schemaName: string, fields: Record<string, { isObject: boolean; isArray: boolean }>, authNames: readonly string[], isArray: boolean): string[] {
  const own = Object.entries(fields)
    .filter(([, field]) => !field.isObject && !field.isArray)
    .map(([path]) => `{{${schemaName}.${path}}}`);
  // Roles and Permissions are lists: only a list property can take them.
  const auth = authNames.filter((name) => isArray || (name !== "Roles" && name !== "Permissions")).map((name) => `{{Auth.${name}}}`);
  return [...own, ...auth];
}

/** The heading over the inputs. */
export function itemsHeading(isArray: boolean, kind: DefaultValueKind): string {
  if (isArray) return "Values";
  return kind === "Template" ? "Template" : "Value";
}
