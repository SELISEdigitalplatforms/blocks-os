"use client";

import { Input } from "@/components/ui-kits/input/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { cn } from "@/lib/utils";
import { useId, useState, type ReactNode } from "react";
import {
  VALIDATION_TYPE,
  VALIDATION_TYPE_META,
  fittingVariables,
  looksLikeVariable,
  valueKindForField,
  type RuleDraft,
  type RuleVariableContext,
  type ValueKind,
} from "./validation-rules.util";
import { ReferenceTargetPicker } from "./reference-target-picker";

const LABEL_CLASS = "text-[11px] font-medium uppercase tracking-widest text-muted-foreground";

function Labelled({ label, required = true, children }: Readonly<{ label: string; required?: boolean; children: ReactNode }>) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={LABEL_CLASS}>
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </div>
  );
}

/** One compared value, entered the way the property's type is: number, date-time, true/false, enum value or text. */
function ValueInput({
  kind,
  label,
  value,
  enumValues,
  invalid,
  onChange,
}: Readonly<{ kind: ValueKind; label: string; value: string; enumValues: string[]; invalid: boolean; onChange: (value: string) => void }>) {
  if (kind === "boolean" || kind === "enum") {
    const options = kind === "boolean" ? ["true", "false"] : enumValues;
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
  const inputType = { number: "number", date: "datetime-local", text: "text" }[kind];
  return (
    <Input
      type={inputType}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-9", invalid && "border-rose-500")}
    />
  );
}

/**
 * A compared value: fixed (entered by type) or one variable naming another property of the same record,
 * e.g. {{Employee.StartDate}}. Only properties of a fitting kind are offered; typing is checked too.
 */
function ComparisonValue({
  kind,
  label,
  value,
  enumValues,
  invalid,
  variableOptions,
  onChange,
}: Readonly<{
  kind: ValueKind;
  label: string;
  value: string;
  enumValues: string[];
  invalid: boolean;
  /** Fitting {{Schema.X}} variables; the switch shows only when a context is given. */
  variableOptions: string[] | null;
  onChange: (value: string) => void;
}>) {
  const [isVariable, setIsVariable] = useState(() => looksLikeVariable(value));
  const groupName = useId();
  const switchTo = (variable: boolean) => {
    if (variable === isVariable) return;
    setIsVariable(variable);
    onChange("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      {variableOptions && (
        <fieldset className="flex gap-1">
          <legend className="sr-only">{`${label} source`}</legend>
          {([false, true] as const).map((variable) => (
            <label
              key={String(variable)}
              className={cn(
                "flex h-6 cursor-pointer items-center rounded border px-2 text-[11px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40",
                isVariable === variable
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
              )}
            >
              <input type="radio" name={groupName} className="sr-only" checked={isVariable === variable} onChange={() => switchTo(variable)} />
              {variable ? "Variable" : "Fixed value"}
            </label>
          ))}
        </fieldset>
      )}
      {isVariable && variableOptions ? (
        <>
          <Input
            aria-label={label}
            placeholder={variableOptions[0] ?? "{{Schema.Property}}"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn("h-9 font-mono text-sm", invalid && "border-rose-500")}
          />
          {variableOptions.length > 0 && (
            <Select value="" onValueChange={onChange}>
              <SelectTrigger className="h-8 w-full text-xs" aria-label={`Pick a property for ${label}`}>
                <SelectValue placeholder="Pick a property…" />
              </SelectTrigger>
              <SelectContent>
                {variableOptions.map((option) => (
                  <SelectItem key={option} value={option} className="font-mono text-xs">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      ) : (
        <ValueInput kind={kind} label={label} value={value} enumValues={enumValues} invalid={invalid} onChange={onChange} />
      )}
    </div>
  );
}

/**
 * The inputs a rule type needs, e.g. nothing for Not empty, one number for Min length, two for
 * a range, the pattern for Regex, and the target schema and field for Reference.
 */
export function RuleValueInputs({
  draft,
  fieldType,
  enumValues,
  variables,
  fieldName,
  error,
  onChange,
}: Readonly<{
  draft: RuleDraft;
  fieldType: string;
  enumValues: string[];
  /** The schema comparison values may refer to; without it, values are fixed only. */
  variables?: RuleVariableContext;
  /** The property being checked, left out of the variables offered. */
  fieldName?: string;
  /** Why the rule cannot be saved yet, once worth showing. */
  error: string | null;
  onChange: (patch: Partial<RuleDraft>) => void;
}>) {
  const input = VALIDATION_TYPE_META[draft.type]?.input;
  const kind = valueKindForField(fieldType);
  const invalid = Boolean(error);
  const variableOptions = variables?.schemaName ? fittingVariables(fieldType, variables, fieldName) : null;

  const body = (() => {
    switch (input) {
      case "none":
        return <p className="text-xs text-muted-foreground">Fails when the value is missing or blank (an empty list, for a list).</p>;
      case "regex":
        return (
          <Labelled label="Regex pattern">
            <Textarea
              placeholder="e.g. ^[a-zA-Z]+$"
              value={draft.value}
              onChange={(e) => onChange({ value: e.target.value })}
              className={cn("resize-none font-mono text-sm", invalid && "border-rose-500")}
              rows={4}
            />
          </Labelled>
        );
      case "length":
        return (
          <Labelled label={draft.type === VALIDATION_TYPE.MinLength ? "Minimum length" : "Maximum length"}>
            <Input
              type="number"
              min={0}
              aria-label="Length"
              value={draft.value}
              onChange={(e) => onChange({ value: e.target.value })}
              className={cn("h-9", invalid && "border-rose-500")}
            />
          </Labelled>
        );
      case "lengthRange":
        return (
          <div className="flex gap-3">
            <Labelled label="Min length">
              <Input type="number" min={0} aria-label="Min length" value={draft.value} onChange={(e) => onChange({ value: e.target.value })} className="h-9" />
            </Labelled>
            <Labelled label="Max length">
              <Input type="number" min={0} aria-label="Max length" value={draft.secondaryValue} onChange={(e) => onChange({ secondaryValue: e.target.value })} className="h-9" />
            </Labelled>
          </div>
        );
      case "value":
        return (
          <Labelled label="Value">
            <ComparisonValue kind={kind} label="Value" value={draft.value} enumValues={enumValues} invalid={invalid} variableOptions={variableOptions} onChange={(value) => onChange({ value })} />
          </Labelled>
        );
      case "valueRange":
        return (
          <div className="flex gap-3">
            <Labelled label="Min">
              <ComparisonValue kind={kind} label="Min" value={draft.value} enumValues={enumValues} invalid={invalid} variableOptions={variableOptions} onChange={(value) => onChange({ value })} />
            </Labelled>
            <Labelled label="Max">
              <ComparisonValue kind={kind} label="Max" value={draft.secondaryValue} enumValues={enumValues} invalid={invalid} variableOptions={variableOptions} onChange={(secondaryValue) => onChange({ secondaryValue })} />
            </Labelled>
          </div>
        );
      case "reference":
        return (
          <>
            <ReferenceTargetPicker
              sourceType={fieldType}
              schemaName={draft.value}
              fieldName={draft.secondaryValue}
              onChange={({ schemaName, fieldName }) => onChange({ value: schemaName, secondaryValue: fieldName })}
            />
            <p className="text-xs text-muted-foreground">
              Inserts and updates are refused when the value (each item, for a list) is not found there. Empty values are not checked.
            </p>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-1.5">
      {body}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
