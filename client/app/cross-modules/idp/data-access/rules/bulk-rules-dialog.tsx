"use client";

import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui-kits/dialog/dialog";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { PLATFORM_SERVICES, type PlatformSchema } from "../data-access.service";
import { StatusSnackbar } from "../gateway/components/primitives";
import { useBulkPlatformFieldDefault, useBulkPlatformValidation } from "../gateway/hooks/use-configuration";
import { useTransientStatus } from "../gateway/hooks/use-transient-status";
import { DefaultValuePanel } from "./default-value-panel";
import { WarningGate } from "./rules-inspector";
import type { ISchemaFieldValidation } from "./rules.types";
import { serverMessage } from "./server-message";
import { ValidationPanel } from "./validation-panel";
import { variableFieldsOf } from "./variable-syntax";
import { bulkPaths, bulkShape, bulkWarning, schemaBlocker, withPairNames, type BulkPanel, type BulkShape } from "./bulk-rules.util";

const LABEL_CLASS = "text-[11px] font-medium uppercase tracking-widest text-muted-foreground";
const RULES_OF: Record<BulkPanel, string> = { validation: "validation rules", default: "a default value" };
const properties = (count: number) => `${count} ${count === 1 ? "property" : "properties"}`;
const PANELS: { value: BulkPanel; label: string }[] = [
  { value: "validation", label: "Validation" },
  { value: "default", label: "Default value" },
];

function toggled(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function CheckRow({
  label,
  hint,
  checked,
  disabledReason,
  onToggle,
}: Readonly<{ label: string; hint?: string; checked: boolean; disabledReason?: string | null; onToggle: () => void }>) {
  return (
    <label
      className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", disabledReason ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/40")}
      title={disabledReason ?? undefined}
    >
      <Checkbox checked={checked && !disabledReason} disabled={Boolean(disabledReason)} onCheckedChange={onToggle} aria-label={label} />
      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{label}</span>
      {hint && <span className="shrink-0 text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** The properties and schemas to change: only default properties, only schemas that take them. */
function TargetPicker({
  schemas,
  paths,
  panel,
  pickedPaths,
  pickedSchemas,
  onTogglePath,
  onToggleSchema,
  onPickSchemas,
}: Readonly<{
  schemas: PlatformSchema[];
  paths: string[];
  panel: BulkPanel;
  pickedPaths: ReadonlySet<string>;
  pickedSchemas: ReadonlySet<string>;
  onTogglePath: (path: string) => void;
  onToggleSchema: (id: string) => void;
  onPickSchemas: (ids: string[]) => void;
}>) {
  const chosenPaths = paths.filter((p) => pickedPaths.has(p));
  const open = schemas.filter((s) => !schemaBlocker(s, chosenPaths, panel));
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-5 p-4">
        <section className="flex flex-col gap-1">
          <p className={LABEL_CLASS}>Default properties</p>
          {paths.map((path) => (
            <CheckRow
              key={path}
              label={path}
              checked={pickedPaths.has(path)}
              disabledReason={schemas.every((s) => schemaBlocker(s, [path], panel)) ? `No schema takes ${RULES_OF[panel]} on ${path}` : null}
              onToggle={() => onTogglePath(path)}
            />
          ))}
        </section>
        <section className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className={LABEL_CLASS}>Schemas</p>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={open.length === 0} onClick={() => onPickSchemas(open.map((s) => s.id))}>
              Select all
            </Button>
          </div>
          {PLATFORM_SERVICES.map((service) => {
            const inService = schemas.filter((s) => s.service === service);
            if (inService.length === 0) return null;
            return (
              <div key={service} className="flex flex-col gap-0.5">
                <span className="px-2 pt-1 text-[11px] text-muted-foreground">{service}</span>
                {inService.map((schema) => (
                  <CheckRow
                    key={schema.id}
                    label={schema.schemaName}
                    hint={schema.rules?.level === "Warned" ? "warned" : undefined}
                    checked={pickedSchemas.has(schema.id)}
                    disabledReason={schemaBlocker(schema, chosenPaths, panel)}
                    onToggle={() => onToggleSchema(schema.id)}
                  />
                ))}
              </div>
            );
          })}
        </section>
      </div>
    </ScrollArea>
  );
}

/** Rules are built here first, then added to (or replace) every picked property's own. */
function BulkValidationEditor({
  schemaIds,
  paths,
  shape,
  variables,
}: Readonly<{ schemaIds: string[]; paths: string[]; shape: BulkShape; variables: { schemaName: string; fields: ReturnType<typeof variableFieldsOf> } }>) {
  const [rules, setRules] = useState<ISchemaFieldValidation[]>([]);
  const [replace, setReplace] = useState(false);
  const { status, setSuccess, setError } = useTransientStatus();
  const { mutateAsync: bulkValidation, isPending } = useBulkPlatformValidation();
  const count = schemaIds.length * paths.length;

  const apply = async () => {
    try {
      await bulkValidation({ schemaIds, fieldNames: paths, validations: rules, replace });
      setSuccess(`Applied to ${properties(count)}`);
    } catch (error) {
      setError(serverMessage(withPairNames(error)));
    }
  };

  return (
    <>
      <ValidationPanel
        schemaId=""
        fieldName={paths.join(", ")}
        fieldType={shape.type}
        enumValues={shape.enumValues}
        initialRules={[]}
        variables={variables}
        listLabel="Rules to apply"
        onSave={async (next) => setRules(next)}
      />
      <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 bg-card px-6 py-3">
        <StatusSnackbar status={status} />
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Existing rules" className="flex flex-1 items-center gap-3 text-xs">
            {[
              { value: false, label: "Add to existing rules" },
              { value: true, label: "Replace existing rules" },
            ].map((option) => (
              <label key={option.label} className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="bulk-existing-rules" checked={replace === option.value} onChange={() => setReplace(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
          <Button type="button" size="sm" disabled={isPending || (!replace && rules.length === 0)} onClick={() => void apply()}>
            {isPending ? "Applying…" : `Apply to ${properties(count)}`}
          </Button>
        </div>
      </div>
    </>
  );
}

/** One default for every picked property; Save applies it to all of them, Clear removes it from all. */
function BulkDefaultEditor({
  schemaIds,
  paths,
  shape,
  variables,
}: Readonly<{ schemaIds: string[]; paths: string[]; shape: BulkShape; variables: { schemaName: string; fields: ReturnType<typeof variableFieldsOf> } }>) {
  const { mutateAsync: bulkFieldDefault } = useBulkPlatformFieldDefault();
  return (
    <DefaultValuePanel
      schemaId=""
      fieldName={paths.join(", ")}
      fieldType={shape.type}
      isArray={shape.isArray}
      enumValues={shape.enumValues}
      variables={variables}
      savedLabel="Last applied here"
      onSave={async (value) => {
        try {
          await bulkFieldDefault({ schemaIds, fieldNames: paths, defaultValue: value });
        } catch (error) {
          throw withPairNames(error);
        }
      }}
    />
  );
}

/**
 * Validation rules or a default value on several default properties of several system schemas at once.
 * Only the base entity's own properties, only where the allow-list opens them; warned ones ask first.
 * The OS server checks every pair and writes nothing if one is refused.
 */
export function BulkRulesDialog({ schemas, onClose }: Readonly<{ schemas: PlatformSchema[]; onClose: () => void }>) {
  const ruleSchemas = useMemo(() => schemas.filter((s) => s.rules), [schemas]);
  const paths = useMemo(() => bulkPaths(ruleSchemas), [ruleSchemas]);
  const [panel, setPanel] = useState<BulkPanel>("validation");
  const [pickedPaths, setPickedPaths] = useState<ReadonlySet<string>>(new Set());
  const [pickedSchemas, setPickedSchemas] = useState<ReadonlySet<string>>(new Set());
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);

  const chosenPaths = paths.filter((p) => pickedPaths.has(p));
  const targets = ruleSchemas.filter((s) => pickedSchemas.has(s.id) && !schemaBlocker(s, chosenPaths, panel));
  const shape = bulkShape(targets, chosenPaths, panel);
  const warning = bulkWarning(targets, chosenPaths, panel);
  // The editor and the confirmation start over whenever what they apply to changes.
  const selectionKey = `${panel}|${chosenPaths.join(",")}|${targets.map((s) => s.id).join(",")}`;
  const single = targets.length === 1 ? targets[0] : null;
  const variables = { schemaName: single?.schemaName ?? "", fields: single ? variableFieldsOf(single.fields) : {} };

  let body;
  if (targets.length === 0 || chosenPaths.length === 0) {
    body = <p className="p-6 text-sm text-muted-foreground">Pick default properties and the schemas to apply them to.</p>;
  } else if ("problem" in shape) {
    body = <p className="p-6 text-sm text-muted-foreground">{shape.problem}</p>;
  } else if (warning && confirmedKey !== selectionKey) {
    body = <WarningGate warning={warning} onClose={onClose} onContinue={() => setConfirmedKey(selectionKey)} />;
  } else {
    const Editor = panel === "validation" ? BulkValidationEditor : BulkDefaultEditor;
    body = <Editor key={selectionKey} schemaIds={targets.map((s) => s.id)} paths={chosenPaths} shape={shape} variables={variables} />;
  }

  return (
    <DialogContent className="flex h-[85vh] w-[95vw] max-w-5xl flex-col gap-0 p-0">
      <DialogHeader className="border-b border-border/40 px-6 py-4">
        <DialogTitle>Bulk rules for default properties</DialogTitle>
        <DialogDescription>The same validations or default value on default properties of several schemas.</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex max-h-[40%] min-h-0 flex-col border-b border-border/40 md:max-h-none md:w-72 md:border-b-0 md:border-r">
          <TargetPicker
            schemas={ruleSchemas}
            paths={paths}
            panel={panel}
            pickedPaths={pickedPaths}
            pickedSchemas={pickedSchemas}
            onTogglePath={(path) => setPickedPaths(toggled(pickedPaths, path))}
            onToggleSchema={(id) => setPickedSchemas(toggled(pickedSchemas, id))}
            onPickSchemas={(ids) => setPickedSchemas(new Set(ids))}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div role="tablist" aria-label="What to set" className="flex shrink-0 gap-1 border-b border-border/40 px-6">
            {PANELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={panel === value}
                onClick={() => setPanel(value)}
                className={cn(
                  "h-9 border-b-2 px-3 text-xs font-medium transition-colors",
                  panel === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {targets.length > 0 && chosenPaths.length > 0 && (
            <p className="shrink-0 px-6 pt-3 text-xs text-muted-foreground">
              {chosenPaths.join(", ")} on {targets.map((s) => s.schemaName).join(", ")}
            </p>
          )}
          <div className="flex min-h-0 flex-1 flex-col">{body}</div>
        </div>
      </div>
    </DialogContent>
  );
}
