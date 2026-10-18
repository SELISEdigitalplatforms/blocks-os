"use client";

import { Button } from "@/components/ui-kits/button/button";
import { AlertTriangle, Check, TextCursorInput } from "lucide-react";
import { useState } from "react";
import type { PlatformSchemaField, PlatformService } from "../data-access.service";
import { PanelHeader, PanelShell } from "../gateway/components/primitives";
import { DefaultValuePanel } from "./default-value-panel";
import type { IPlatformFieldRules } from "./rules.types";
import type { RuleVariableContext } from "./validation-rules.util";
import { ValidationPanel } from "./validation-panel";

/** Validations or the default value of one property of a platform schema. */
export interface RulesInspectorTarget {
  panel: "validation" | "default";
  schemaId: string;
  schemaName: string;
  service: PlatformService;
  /** The schema is used by sign-in or the console (allow-list level Warned). */
  isWarnedSchema: boolean;
  /** The property, by its dotted path, e.g. Read.Roles. */
  path: string;
  field: PlatformSchemaField;
  rules: IPlatformFieldRules;
  variables: RuleVariableContext;
}

export const rulesInspectorKey = (target: RulesInspectorTarget) => `${target.panel}:${target.schemaId}:${target.path}`;

/** Why this change needs a second look, or null when it doesn't. */
export function rulesWarning(target: RulesInspectorTarget): string | null {
  const access = target.panel === "validation" ? target.rules.validation : target.rules.default;
  if (!target.isWarnedSchema && access !== "Warned") return null;
  const what = target.panel === "validation" ? "rule" : "default";
  return target.isWarnedSchema
    ? `${target.schemaName} is used by sign-in and the console. A wrong ${what} applies to every ${target.schemaName} that ${target.service} saves and can stop users from signing in or the console from saving.`
    : `${target.path} decides who can see or change ${target.schemaName} records. A wrong ${what} applies to every record ${target.service} saves.`;
}

/** Asks before the editor opens on a warned schema or property. */
function WarningGate({ warning, onClose, onContinue }: Readonly<{ warning: string; onClose: () => void; onContinue: () => void }>) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div role="alert" className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p>{warning}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={onContinue}>
          I understand, continue
        </Button>
      </div>
    </div>
  );
}

/** The validation or default-value editor of the target property. */
function RulesPanel({ target }: Readonly<{ target: RulesInspectorTarget }>) {
  if (target.panel === "validation") {
    return (
      <ValidationPanel
        schemaId={target.schemaId}
        fieldName={target.path}
        fieldType={target.field.type}
        enumValues={target.field.enumValues}
        initialRules={target.field.validationRule?.validations ?? []}
        variables={target.variables}
      />
    );
  }
  return (
    <DefaultValuePanel
      schemaId={target.schemaId}
      fieldName={target.path}
      fieldType={target.field.type}
      isArray={target.field.isArray}
      enumValues={target.field.enumValues}
      initialDefault={target.field.defaultValue ?? null}
      variables={target.variables}
    />
  );
}

/**
 * The docked panel for a property's validations or default value, beside the access inspector's slot.
 * Warned schemas and properties ask before the editor opens.
 */
export function RulesInspector({ target, onClose }: Readonly<{ target: RulesInspectorTarget; onClose: () => void }>) {
  const warning = rulesWarning(target);
  const [confirmed, setConfirmed] = useState(warning === null);
  const isValidation = target.panel === "validation";
  const title = isValidation ? "Validations" : "Default value";

  return (
    <PanelShell label={`${title} for ${target.path}`}>
      <PanelHeader
        icon={isValidation ? Check : TextCursorInput}
        title={target.path}
        subtitle={`${title} · Field on ${target.schemaName}`}
        onClose={onClose}
        closeLabel={`Close ${title.toLowerCase()} inspector`}
      />
      {!confirmed && warning ? <WarningGate warning={warning} onClose={onClose} onContinue={() => setConfirmed(true)} /> : <RulesPanel target={target} />}
    </PanelShell>
  );
}
