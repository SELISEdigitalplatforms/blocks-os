"use client";

import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { StatusSnackbar } from "../gateway/components/primitives";
import { useSetPlatformFieldDefault } from "../gateway/hooks/use-configuration";
import { useTransientStatus } from "../gateway/hooks/use-transient-status";
import type { DefaultValueKind, IFieldDefaultValue } from "./rules.types";
import { isRefusal, serverMessage } from "./server-message";
import type { VariableField } from "./variable-syntax";
import {
  allowedDefaultKinds,
  checkDefaultDraft,
  defaultFromDraft,
  draftFromDefault,
  emptyDefaultDraft,
  formatDefaultSummary,
  type DefaultDraft,
} from "./default-value.util";
import { AUTH_NAMES } from "./variable-syntax";

export interface DefaultValuePanelProps {
  /** The property; a nested one by its full dotted path, e.g. Read.Roles. */
  fieldName: string;
  schemaId: string;
  /** The schema's name and properties, for templates like {{EmailTemplate.Name}}. */
  variables: { schemaName: string; fields: Record<string, VariableField> };
  fieldType: string;
  isArray: boolean;
  enumValues?: string[];
  /** The default as the schema response had it; null when none. */
  initialDefault?: IFieldDefaultValue | null;
}

const LABEL_CLASS = "text-[11px] font-medium uppercase tracking-widest text-muted-foreground";

const KIND_LABELS: Record<DefaultValueKind, string> = { Static: "Fixed value", Template: "Template", Now: "Now" };

const KIND_HINTS: Record<DefaultValueKind, string> = {
  Static: "Stored as typed when the service creates a record with this property empty (null). Date-times are UTC.",
  Template: "Text built from other properties of the same record and the signed-in user. Missing values become empty text.",
  Now: "The time the record is created (UTC), optionally shifted.",
};

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

/** One fixed value, entered the way the property's type is. */
function StaticItemInput({
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
  const inputType = fieldType === "Int" || fieldType === "Float" ? "number" : fieldType === "DateTime" ? "datetime-local" : "text";
  // A saved date-time comes back as ISO text ("…T09:00:00Z"); the picker shows minutes, read as UTC.
  const shown = fieldType === "DateTime" ? (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.exec(value)?.[0] ?? value) : value;
  return (
    <Input
      type={inputType}
      aria-label={label}
      value={shown}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-9", invalid && "border-rose-500")}
    />
  );
}

/**
 * The default value of one property: a fixed value, a template, or Now ± an offset. Used on insert when
 * the property isn't sent. Shared by the docked inspector and the drawer, like the validation panel.
 */
export function DefaultValuePanel({
  fieldName,
  schemaId,
  variables,
  fieldType,
  isArray,
  enumValues = [],
  initialDefault = null,
}: DefaultValuePanelProps) {
  const kinds = allowedDefaultKinds(fieldType, isArray);
  // What's stored now: the schema response's value, then whatever this panel last saved.
  const [saved, setSaved] = useState<IFieldDefaultValue | null>(initialDefault);
  const [draft, setDraft] = useState<DefaultDraft>(() => {
    const start = draftFromDefault(initialDefault);
    return kinds.includes(start.kind) ? start : emptyDefaultDraft(kinds[0]);
  });
  const [touched, setTouched] = useState(false);
  // A server refusal shows where the syntax errors do, until the draft changes.
  const [serverError, setServerError] = useState<string | null>(null);
  // Which template item the insert buttons write into.
  const [activeItem, setActiveItem] = useState(0);
  const { status, setSuccess, setError } = useTransientStatus();
  const { mutateAsync: setFieldDefault, isPending } = useSetPlatformFieldDefault();

  const target = { fieldType, isArray, enumValues, schemaName: variables.schemaName, fields: variables.fields };
  // Template references need the schema's fields; until they load only the syntax is checked server-side.
  const draftError = draft.kind === "Template" && !variables.schemaName ? null : checkDefaultDraft(draft, target);
  const shownError = serverError ?? (touched ? draftError : null);
  const payload = draftError ? null : defaultFromDraft(draft, target);
  const isDirty = JSON.stringify(payload) !== JSON.stringify(saved);

  const update = (next: DefaultDraft) => {
    setDraft(next);
    setTouched(true);
    setServerError(null);
  };
  const setItem = (index: number, value: string) => update({ ...draft, items: draft.items.map((item, i) => (i === index ? value : item)) });
  const addItem = () => {
    update({ ...draft, items: [...draft.items, ""] });
    setActiveItem(draft.items.length);
  };
  const removeItem = (index: number) => {
    const items = draft.items.filter((_, i) => i !== index);
    update({ ...draft, items: items.length > 0 ? items : [""] });
    setActiveItem(0);
  };
  const insertVariable = (variable: string) => {
    const index = Math.min(activeItem, draft.items.length - 1);
    const current = draft.items[index] ?? "";
    const spacer = current && !current.endsWith(" ") ? " " : "";
    setItem(index, `${current}${spacer}${variable}`);
  };

  const save = async (value: IFieldDefaultValue | null) => {
    try {
      await setFieldDefault({ schemaId, fieldName, defaultValue: value });
      setSaved(value);
      setServerError(null);
      if (value === null) {
        setDraft(emptyDefaultDraft(kinds[0]));
        setTouched(false);
      }
      setSuccess(value === null ? "Default value cleared" : "Default value saved");
    } catch (error) {
      if (isRefusal(error)) setServerError(serverMessage(error));
      else setError(serverMessage(error));
    }
  };

  const handleSave = () => {
    setTouched(true);
    if (draftError || !payload) return;
    void save(payload);
  };

  const scalarVariables = Object.entries(variables.fields)
    .filter(([, field]) => !field.isObject && !field.isArray)
    .map(([path]) => `{{${variables.schemaName}.${path}}}`);
  const authVariables = AUTH_NAMES.filter((name) => isArray || (name !== "Roles" && name !== "Permissions")).map(
    (name) => `{{Auth.${name}}}`,
  );

  const items = draft.kind === "Now" ? [] : isArray ? draft.items : draft.items.slice(0, 1);

  return (
    <>
      <ScrollArea className="relative flex-1 overflow-auto">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1.5">
            <p className={LABEL_CLASS}>Current default</p>
            <p className={cn("break-all text-sm", saved ? "font-mono text-foreground" : "text-muted-foreground")}>
              {saved ? formatDefaultSummary(saved) : "None"}
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-sm border border-border/40 bg-card p-4">
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>Kind</span>
              <div role="radiogroup" aria-label="Default kind" className="flex gap-1">
                {kinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={draft.kind === kind}
                    onClick={() => update({ ...emptyDefaultDraft(kind) })}
                    className={cn(
                      "h-8 flex-1 rounded-md border px-2 text-xs font-medium transition-colors",
                      draft.kind === kind
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {KIND_LABELS[kind]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{KIND_HINTS[draft.kind]}</p>
            </div>

            {draft.kind === "Now" ? (
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-2 gap-3">
                  {OFFSET_PARTS.map(({ key, label }) => (
                    <Labelled key={key} label={label}>
                      <Input
                        type="number"
                        step={1}
                        aria-label={label}
                        value={draft.offset[key]}
                        onChange={(e) => update({ ...draft, offset: { ...draft.offset, [key]: e.target.value } })}
                        className={cn("h-9", shownError && "border-rose-500")}
                      />
                    </Labelled>
                  ))}
                </div>
                {payload && <p className="font-mono text-xs text-muted-foreground">{formatDefaultSummary(payload)}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className={LABEL_CLASS}>{isArray ? "Values" : draft.kind === "Template" ? "Template" : "Value"}</span>
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1" onFocus={() => setActiveItem(index)}>
                      {draft.kind === "Template" ? (
                        <Input
                          aria-label={isArray ? `Template ${index + 1}` : "Template"}
                          placeholder={`e.g. {{${variables.schemaName || "Schema"}.FirstName}}`}
                          value={item}
                          onChange={(e) => setItem(index, e.target.value)}
                          className={cn("h-9 font-mono text-sm", shownError && "border-rose-500")}
                        />
                      ) : (
                        <StaticItemInput
                          fieldType={fieldType}
                          enumValues={enumValues}
                          value={item}
                          label={isArray ? `Value ${index + 1}` : "Value"}
                          invalid={Boolean(shownError)}
                          onChange={(value) => setItem(index, value)}
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
                        onClick={() => removeItem(index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {isArray && (
                  <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </Button>
                )}

                {draft.kind === "Template" && (
                  <Select value="" onValueChange={insertVariable}>
                    <SelectTrigger className="h-9 w-full" aria-label="Insert variable">
                      <SelectValue placeholder="Insert variable…" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...scalarVariables, ...authVariables].map((variable) => (
                        <SelectItem key={variable} value={variable} className="font-mono text-xs">
                          {variable}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {shownError && (
              <p role="alert" className="text-xs text-rose-500">
                {shownError}
              </p>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 bg-card px-6 py-3">
        <StatusSnackbar status={status} />
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-muted-foreground">Applies to records the service creates from now on</span>
          {saved && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => void save(null)}>
              Clear
            </Button>
          )}
          <Button type="button" size="sm" disabled={isPending || Boolean(draftError && touched) || !isDirty} onClick={handleSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
