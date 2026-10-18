"use client";

import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Input } from "@/components/ui-kits/input/input";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { StatusSnackbar } from "../gateway/components/primitives";
import { useSavePlatformValidation } from "../gateway/hooks/use-configuration";
import { useTransientStatus } from "../gateway/hooks/use-transient-status";
import { RuleValueInputs } from "./rule-value-inputs";
import type { ISchemaFieldValidation } from "./rules.types";
import { serverMessage } from "./server-message";
import {
  VALIDATION_TYPE,
  VALIDATION_TYPE_META,
  checkRuleDraft,
  draftFromRule,
  formatRuleSummary,
  getAllowedValidationTypes,
  ruleFromDraft,
  ruleTypeLabel,
  type RuleDraft,
  type RuleVariableContext,
  type ValidationTypeValue,
} from "./validation-rules.util";

export interface ValidationPanelProps {
  schemaId: string;
  /** The property; a nested one by its dotted path, e.g. Read.Roles. */
  fieldName: string;
  fieldType: string;
  enumValues?: string[];
  /** The rules as the schema list had them. */
  initialRules: ISchemaFieldValidation[];
  /** The schema's name and properties, for comparison values like {{EmailTemplate.Name}}. */
  variables: RuleVariableContext;
}

const LABEL_CLASS = "text-[11px] font-medium uppercase tracking-widest text-muted-foreground";

const newDraft = (fieldType: string): RuleDraft => ({
  type: getAllowedValidationTypes(fieldType)[0],
  value: "",
  secondaryValue: "",
  errorMessage: "",
  isActive: true,
});

/**
 * The Data Gateway's validation panel for a platform schema's property: the rules, an add/edit form,
 * delete. Every change saves the property's whole list, as the gateway does.
 */
export function ValidationPanel({ schemaId, fieldName, fieldType, enumValues = [], initialRules, variables }: ValidationPanelProps) {
  const [rules, setRules] = useState<ISchemaFieldValidation[]>(initialRules);
  const [form, setForm] = useState<(RuleDraft & { editingIndex?: number }) | null>(null);
  const [touched, setTouched] = useState(false);
  const { status, setSuccess, setError } = useTransientStatus();
  const { mutateAsync: saveValidation, isPending } = useSavePlatformValidation();

  const isEditing = form?.editingIndex !== undefined;
  const hasOtherReference = rules.some((r, i) => r.type === VALIDATION_TYPE.Reference && i !== form?.editingIndex);
  const typeOptions = getAllowedValidationTypes(fieldType).filter((t) => t !== VALIDATION_TYPE.Reference || !hasOtherReference);
  const draftError = form ? checkRuleDraft(form, fieldType, variables) : null;

  const save = async (next: ISchemaFieldValidation[], message: string) => {
    try {
      await saveValidation({ schemaId, fieldName, validations: next });
      setRules(next);
      setForm(null);
      setTouched(false);
      setSuccess(message);
    } catch (error) {
      setError(serverMessage(error));
    }
  };

  const submit = () => {
    setTouched(true);
    if (!form || draftError) return;
    const rule = ruleFromDraft(form, fieldType);
    const next = isEditing ? rules.map((r, i) => (i === form.editingIndex ? rule : r)) : [...rules, rule];
    void save(next, isEditing ? "Validation updated" : "Validation added");
  };

  const update = (patch: Partial<RuleDraft>) => {
    setForm((previous) => (previous ? { ...previous, ...patch } : previous));
    setTouched(true);
  };

  return (
    <>
      <ScrollArea className="relative flex-1 overflow-auto">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-3">
            <p className={LABEL_CLASS}>Existing validations</p>
            {rules.length === 0 ? (
              <div className="flex items-center justify-center rounded-sm border border-dashed border-border/60 bg-muted/10 py-8 text-xs text-muted-foreground">
                No validations added yet
              </div>
            ) : (
              rules.map((rule, index) => (
                <div key={`${rule.type}-${index}`} className="flex items-start justify-between gap-3 rounded-sm border border-border/40 bg-card px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="w-fit rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {ruleTypeLabel(rule.type)}
                    </span>
                    <p className={cn("break-all text-sm text-foreground", rule.type === VALIDATION_TYPE.Regex && "font-mono")}>{formatRuleSummary(rule)}</p>
                    {rule.errorMessage && <p className="text-xs text-muted-foreground">{rule.errorMessage}</p>}
                    {!rule.isActive && <span className="w-fit text-xs text-muted-foreground">Inactive</span>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label={`Edit ${ruleTypeLabel(rule.type)} rule`}
                      disabled={isPending}
                      onClick={() => {
                        setForm({ ...draftFromRule(rule), editingIndex: index });
                        setTouched(false);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                      aria-label={`Delete ${ruleTypeLabel(rule.type)} rule`}
                      disabled={isPending}
                      onClick={() => void save(rules.filter((_, i) => i !== index), "Validation deleted")}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {form ? (
            <div className="flex flex-col gap-4 rounded-sm border border-border/40 bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{isEditing ? "Edit validation" : "Add validation"}</p>
              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>Rule type</span>
                <Select value={String(form.type)} onValueChange={(value) => update({ type: Number(value) as ValidationTypeValue, value: "", secondaryValue: "" })}>
                  <SelectTrigger className="h-9 w-full" aria-label="Rule type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isEditing && !typeOptions.includes(form.type) ? [form.type, ...typeOptions] : typeOptions).map((type) => (
                      <SelectItem key={type} value={String(type)}>
                        {VALIDATION_TYPE_META[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <RuleValueInputs
                key={form.editingIndex ?? "new"}
                draft={form}
                fieldType={fieldType}
                enumValues={enumValues}
                variables={variables}
                fieldName={fieldName}
                error={touched ? draftError : null}
                onChange={update}
              />

              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>Error message</span>
                <Input placeholder="e.g. Only letters are allowed" value={form.errorMessage} onChange={(e) => update({ errorMessage: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="rule-active" checked={form.isActive} onCheckedChange={(checked) => update({ isActive: checked === true })} />
                <label htmlFor="rule-active" className="cursor-pointer text-xs text-muted-foreground">
                  Active
                </label>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-border text-foreground hover:border-primary/40 hover:text-primary"
              onClick={() => {
                const draft = newDraft(fieldType);
                if (draft.type === VALIDATION_TYPE.Reference && hasOtherReference) draft.type = typeOptions[0];
                setForm(draft);
                setTouched(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Add validation
            </Button>
          )}
        </div>
      </ScrollArea>

      {(status || form) && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 bg-card px-6 py-3">
          <StatusSnackbar status={status} />
          {form && (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-muted-foreground">{isEditing ? "Editing validation" : "New validation"}</span>
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={isPending || Boolean(touched && draftError)} onClick={submit}>
                {isPending ? "Saving…" : isEditing ? "Update" : "Add"}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
