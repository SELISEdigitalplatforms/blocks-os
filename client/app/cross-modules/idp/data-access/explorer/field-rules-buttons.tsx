import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { Check, RectangleEllipsis } from "lucide-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PlatformSchemaField } from "../data-access.service";
import { formatDefaultSummary } from "../rules/default-value.util";
import type { IPlatformFieldRules, IPlatformSchemaRules } from "../rules/rules.types";
import { isScalarField } from "./explorer-utils";

/** Opens a property's validations or default value; `path` is the dotted name (e.g. `Read.Roles`). */
export type OnOpenFieldRules = (target: { path: string; field: PlatformSchemaField; panel: "validation" | "default" }) => void;

type FieldRulesContextValue = {
  rulesFor: (path: string) => IPlatformFieldRules | undefined;
  /** Set when the whole schema takes no rules (excluded from the allow-list); it replaces the per-property reason. */
  schemaReason: string | null;
  onOpen: OnOpenFieldRules;
};

const FieldRulesContext = createContext<FieldRulesContextValue | null>(null);

/**
 * Hands the schema's allow-list and the open handler to every row, nested tables included, without
 * threading them through each level. With no rules (switched off, or a schema that takes none) every
 * row shows the two buttons disabled, with the reason.
 */
export function FieldRulesProvider({
  rules,
  schemaReason = null,
  onOpen,
  children,
}: Readonly<{ rules: IPlatformSchemaRules | null | undefined; schemaReason?: string | null; onOpen: OnOpenFieldRules; children: ReactNode }>) {
  const value = useMemo<FieldRulesContextValue>(() => {
    const byPath = new Map((rules?.fields ?? []).map((f) => [f.path, f]));
    return { rulesFor: (path) => byPath.get(path), schemaReason, onOpen };
  }, [rules, schemaReason, onOpen]);
  return <FieldRulesContext.Provider value={value}>{children}</FieldRulesContext.Provider>;
}

/** The Data Gateway's Rules-column shapes: Validation fits its count, Default value is square. */
const SHAPE = {
  validation: "flex h-[26px] min-w-[28px] shrink-0 items-center justify-center gap-1 rounded-md border px-1",
  default: "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border",
  wide: "flex w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm",
} as const;

const FOCUS = "transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40";
const TINT_SET = "border-primary/30 bg-primary/10 text-primary";
const TINT_IDLE = "border-border text-muted-foreground hover:border-primary/40 hover:text-primary";

/** Why the Validation button can't be used on this property, or null when it can. */
function validationUnavailable(field: PlatformSchemaField, path: string, rules: IPlatformFieldRules | undefined, schemaReason: string | null): string | null {
  if (!isScalarField(field)) return "Validations are only available for primitive types";
  if (schemaReason) return schemaReason;
  if (!rules || rules.validation === "Blocked") return `Validation rules can't be set on ${path}`;
  return null;
}

/** Why the Default value button can't be used on this property, or null when it can. */
function defaultUnavailable(field: PlatformSchemaField, path: string, rules: IPlatformFieldRules | undefined, schemaReason: string | null): string | null {
  if (!isScalarField(field)) return "Default values are only available for text, number, true/false, date-time and enum properties";
  if (schemaReason) return schemaReason;
  if (!rules || rules.default === "Blocked") return `A default value can't be set on ${path}`;
  if (rules.defaultHasNoEffect) return `${path} is never empty, so a default would never be used`;
  return null;
}

/** A Rules-column button that can't be used here, with the reason on hover and for screen readers. */
function UnavailableButton({ reason, shape, children }: Readonly<{ reason: string; shape: string; children: ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" disabled className={cn(shape, "cursor-not-allowed border-border/60 text-muted-foreground/50")} aria-label={reason}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

type RuleButtonProps = Readonly<{ field: PlatformSchemaField; path: string; wide: boolean; context: FieldRulesContextValue | null }>;

function ValidationButton({ field, path, wide, context }: RuleButtonProps) {
  const reason = validationUnavailable(field, path, context?.rulesFor(path), context?.schemaReason ?? null);
  const shape = wide ? SHAPE.wide : SHAPE.validation;
  const icon = <Check className={wide ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5"} strokeWidth={2.5} />;
  // Outside a provider there are no rules, so the reason is always set there.
  if (reason || !context) {
    return (
      <UnavailableButton reason={reason ?? ""} shape={shape}>
        {icon}
      </UnavailableButton>
    );
  }

  const ruleCount = field.validationRule?.validations.length ?? 0;
  return (
    <button
      type="button"
      onClick={() => context.onOpen({ path, field, panel: "validation" })}
      className={cn(shape, FOCUS, ruleCount > 0 ? TINT_SET : TINT_IDLE)}
      aria-label={ruleCount > 0 ? `Manage validations for ${path} (${ruleCount})` : `Manage validations for ${path}`}
    >
      {icon}
      {ruleCount > 0 && (
        <span aria-hidden className="text-[11px] font-semibold">
          {ruleCount}
        </span>
      )}
    </button>
  );
}

function DefaultValueButton({ field, path, wide, context }: RuleButtonProps) {
  const reason = defaultUnavailable(field, path, context?.rulesFor(path), context?.schemaReason ?? null);
  const shape = wide ? SHAPE.wide : SHAPE.default;
  const icon = <RectangleEllipsis className={wide ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5"} />;
  if (reason || !context) {
    return (
      <UnavailableButton reason={reason ?? ""} shape={shape}>
        {icon}
      </UnavailableButton>
    );
  }

  const defaultValue = field.defaultValue ?? null;
  const summary = defaultValue ? formatDefaultSummary(defaultValue) : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => context.onOpen({ path, field, panel: "default" })}
          className={cn(shape, FOCUS, defaultValue ? TINT_SET : TINT_IDLE)}
          aria-label={summary ? `Default value for ${path} (${summary})` : `Default value for ${path}`}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{summary ? `Default value: ${summary}` : "Set a default value"}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The Validation and Default value buttons after Access, on every property as in the Data Gateway.
 * They open only where the Genesis allow-list opens the property; elsewhere they are disabled with the
 * reason. Tinted once something is set.
 */
export function FieldRulesButtons({ field, path, wide = false }: Readonly<{ field: PlatformSchemaField; path: string; wide?: boolean }>) {
  const context = useContext(FieldRulesContext);
  return (
    <>
      <ValidationButton field={field} path={path} wide={wide} context={context} />
      <DefaultValueButton field={field} path={path} wide={wide} context={context} />
    </>
  );
}
