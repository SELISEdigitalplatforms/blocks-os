"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { useT } from "@seliseblocks/genesis-os";
import { useQuery } from "@tanstack/react-query";
import { platformDataAccessService, type PlatformSchema } from "../data-access.service";
import { DEFAULT_REFERENCE_FIELD } from "./validation-rules.util";

const TEXT_TYPES = ["String", "ID", "Enum"];
const NUMBER_TYPES = ["Int", "Float"];

function typeFamily(type: string): string[] {
  if (TEXT_TYPES.includes(type)) return TEXT_TYPES;
  return NUMBER_TYPES.includes(type) ? NUMBER_TYPES : [];
}

/**
 * Fields of the target a value of `sourceType` may be matched against: single values of the same kind
 * (text with text, numbers with numbers). ItemId is a text id on every record.
 */
export function compatibleTargetFields(target: PlatformSchema | undefined, sourceType: string): string[] {
  const family = typeFamily(sourceType);
  const names = (target?.fields ?? [])
    .filter((f) => !f.isArray && !f.fields?.length && family.includes(f.type) && f.name !== DEFAULT_REFERENCE_FIELD)
    .map((f) => f.name);
  return family === TEXT_TYPES ? [DEFAULT_REFERENCE_FIELD, ...names] : names;
}

/**
 * Picks where a Reference rule on a platform schema looks: another platform schema (system entities only,
 * as the server requires), then one of its fields, ItemId by default.
 */
export function ReferenceTargetPicker({
  sourceType,
  schemaName,
  fieldName,
  onChange,
}: Readonly<{
  /** Type of the property the rule is on, e.g. String or Int. */
  sourceType: string;
  schemaName: string;
  fieldName: string;
  onChange: (target: { schemaName: string; fieldName: string }) => void;
}>) {
  const { t } = useT("os.idp.rules");
  // The page already holds this list; reading the same query shares it.
  const { data } = useQuery({ queryKey: ["platform-data-access-schemas"], queryFn: platformDataAccessService.getSchemas });
  const schemas = data?.data ?? [];
  const selected = schemas.find((s) => s.schemaName === schemaName);
  const fieldOptions = compatibleTargetFields(selected, sourceType);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {/* A heading, not a <label>: the select below names itself (aria-label). */}
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {t("REFERENCE_TARGET_PICKER.MUST_EXIST_IN")} <span className="text-rose-500">*</span>
        </span>
        <Select
          value={schemaName || undefined}
          onValueChange={(value) =>
            onChange({ schemaName: value, fieldName: compatibleTargetFields(schemas.find((s) => s.schemaName === value), sourceType)[0] ?? "" })
          }
        >
          <SelectTrigger className="h-9 w-full" aria-label={t("REFERENCE_TARGET_PICKER.TARGET_SCHEMA")}>
            <SelectValue placeholder={t("REFERENCE_TARGET_PICKER.SELECT_SCHEMA")} />
          </SelectTrigger>
          <SelectContent>
            {schemas.map((schema) => (
              <SelectItem key={schema.id} value={schema.schemaName}>
                {schema.schemaName} <span className="text-muted-foreground">· {schema.service}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {schemaName && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{t("REFERENCE_TARGET_PICKER.TARGET_FIELD")}</span>
          {fieldOptions.length === 0 ? (
            <p className="text-xs text-rose-500">
              {t(NUMBER_TYPES.includes(sourceType) ? "REFERENCE_TARGET_PICKER.NO_NUMBER_FIELD" : "REFERENCE_TARGET_PICKER.NO_TEXT_FIELD", { schema: schemaName })}
            </p>
          ) : (
            <Select value={fieldName || undefined} onValueChange={(value) => onChange({ schemaName, fieldName: value })}>
              <SelectTrigger className="h-9 w-full" aria-label={t("REFERENCE_TARGET_PICKER.TARGET_FIELD")}>
                <SelectValue placeholder={t("REFERENCE_TARGET_PICKER.SELECT_FIELD")} />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
