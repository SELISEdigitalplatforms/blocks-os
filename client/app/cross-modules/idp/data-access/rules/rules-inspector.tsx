"use client";

import { Button } from "@/components/ui-kits/button/button";
import { tStatic, useT } from "@seliseblocks/genesis-os";
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
  const isRule = target.panel === "validation";
  const params = { schema: target.schemaName, service: target.service, path: target.path };
  if (target.isWarnedSchema) {
    return tStatic("os.idp.rules", isRule ? "RULES_INSPECTOR.WARNING_SCHEMA_RULE" : "RULES_INSPECTOR.WARNING_SCHEMA_DEFAULT", params);
  }
  return tStatic("os.idp.rules", isRule ? "RULES_INSPECTOR.WARNING_PATH_RULE" : "RULES_INSPECTOR.WARNING_PATH_DEFAULT", params);
}

/** Asks before the editor opens on a warned schema or property. */
export function WarningGate({ warning, onClose, onContinue }: Readonly<{ warning: string; onClose: () => void; onContinue: () => void }>) {
  const { t } = useT("os.idp.rules");
  return (
    <div className="flex flex-col gap-4 p-6">
      <div role="alert" className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p>{warning}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("common:CANCEL")}
        </Button>
        <Button type="button" size="sm" onClick={onContinue}>
          {t("RULES_INSPECTOR.UNDERSTAND_CONTINUE")}
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
  const { t } = useT("os.idp.rules");
  const warning = rulesWarning(target);
  const [confirmed, setConfirmed] = useState(warning === null);
  const isValidation = target.panel === "validation";
  const title = isValidation ? t("RULES_INSPECTOR.VALIDATIONS") : t("RULES_INSPECTOR.DEFAULT_VALUE");

  return (
    <PanelShell label={t("RULES_INSPECTOR.TITLE_FOR", { title, path: target.path })}>
      <PanelHeader
        icon={isValidation ? Check : TextCursorInput}
        title={target.path}
        subtitle={t("RULES_INSPECTOR.SUBTITLE", { title, schema: target.schemaName })}
        onClose={onClose}
        closeLabel={t(isValidation ? "RULES_INSPECTOR.CLOSE_VALIDATIONS" : "RULES_INSPECTOR.CLOSE_DEFAULT")}
      />
      {!confirmed && warning ? <WarningGate warning={warning} onClose={onClose} onContinue={() => setConfirmed(true)} /> : <RulesPanel target={target} />}
    </PanelShell>
  );
}
