import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { Check, TextCursorInput } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import type { PlatformSchemaField } from "../data-access.service";
import { formatDefaultSummary } from "../rules/default-value.util";
import type { IPlatformFieldRules, IPlatformSchemaRules } from "../rules/rules.types";

/** Opens a property's validations or default value; `path` is the dotted name (e.g. `Read.Roles`). */
export type OnOpenFieldRules = (target: { path: string; field: PlatformSchemaField; panel: "validation" | "default" }) => void;

type FieldRulesContextValue = { rulesFor: (path: string) => IPlatformFieldRules | undefined; onOpen: OnOpenFieldRules };

const FieldRulesContext = createContext<FieldRulesContextValue | null>(null);

/**
 * Hands the schema's allow-list and the open handler to every row, nested tables included, without
 * threading them through each level. With no rules (switched off, or a schema that takes none) the
 * rows show access only, as before.
 */
export function FieldRulesProvider({
  rules,
  onOpen,
  children,
}: Readonly<{ rules: IPlatformSchemaRules | null | undefined; onOpen: OnOpenFieldRules; children: ReactNode }>) {
  if (!rules) return <>{children}</>;
  const byPath = new Map(rules.fields.map((f) => [f.path, f]));
  return <FieldRulesContext.Provider value={{ rulesFor: (path) => byPath.get(path), onOpen }}>{children}</FieldRulesContext.Provider>;
}

const SHAPE = {
  square: "flex h-[26px] min-w-[26px] shrink-0 items-center justify-center gap-1 rounded-md border px-1",
  wide: "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm",
} as const;

const TINT_SET = "border-primary/30 bg-primary/10 text-primary";
const TINT_IDLE = "border-border text-muted-foreground hover:border-primary/40 hover:text-primary";

/**
 * The Validation and Default value buttons after Access, only on properties the Genesis allow-list
 * opens (and only those the schema list has). Tinted once something is set.
 */
export function FieldRulesButtons({ field, path, wide = false }: Readonly<{ field: PlatformSchemaField; path: string; wide?: boolean }>) {
  const context = useContext(FieldRulesContext);
  const rules = context?.rulesFor(path);
  if (!context || !rules) return null;

  const shape = wide ? SHAPE.wide : SHAPE.square;
  const icon = wide ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5";
  const ruleCount = field.validationRule?.validations.length ?? 0;
  const defaultValue = field.defaultValue ?? null;

  return (
    <>
      {rules.validation !== "Blocked" && (
        <button
          type="button"
          onClick={() => context.onOpen({ path, field, panel: "validation" })}
          className={cn(shape, "transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40", ruleCount > 0 ? TINT_SET : TINT_IDLE)}
          aria-label={`Manage validations for ${path}${ruleCount > 0 ? ` (${ruleCount})` : ""}`}
        >
          <Check className={icon} strokeWidth={2.5} />
          {ruleCount > 0 && (
            <span aria-hidden className="text-[11px] font-semibold">
              {ruleCount}
            </span>
          )}
        </button>
      )}
      {rules.default !== "Blocked" &&
        (rules.defaultHasNoEffect ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled
                className={cn(shape, "cursor-not-allowed border-border/60 text-muted-foreground/50")}
                aria-label={`${path} is never empty, so a default would never be used`}
              >
                <TextCursorInput className={icon} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{path} is never empty, so a default would never be used</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => context.onOpen({ path, field, panel: "default" })}
                className={cn(shape, "transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40", defaultValue ? TINT_SET : TINT_IDLE)}
                aria-label={`Default value for ${path}${defaultValue ? ` (${formatDefaultSummary(defaultValue)})` : ""}`}
              >
                <TextCursorInput className={icon} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{defaultValue ? `Default value: ${formatDefaultSummary(defaultValue)}` : "Set a default value"}</TooltipContent>
          </Tooltip>
        ))}
    </>
  );
}
