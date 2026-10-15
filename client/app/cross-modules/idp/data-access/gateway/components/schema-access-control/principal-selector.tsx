import { useEffect, useRef, useState } from "react";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Input } from "@/components/ui-kits/input/input";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { cn } from "@/lib/utils";
import {
  usePrincipalOptions,
  useStoredPrincipals,
  type PrincipalEntity,
  type PrincipalOption,
  type UserPrincipalValue,
} from "@blocks-idp/data-access/gateway/hooks/use-principal-options";

export const PRINCIPAL_MESSAGES = {
  MISSING_TENANT: "Select a project before loading roles or users.",
  FORBIDDEN: "You do not have permission to view tenant roles or users.",
  ROLES_FAILED: "Roles could not be loaded.",
  USERS_FAILED: "Users could not be loaded.",
  NO_ROLES: "No roles found.",
  NO_USERS: "No users found.",
  UNAVAILABLE: "Unavailable",
} as const;

interface PrincipalSelectorProps {
  entity: PrincipalEntity;
  projectKey: string;
  /** Comma-delimited for multi, plain string for single - the same form state free text used. */
  value: string;
  onChange: (next: string) => void;
  multiple: boolean;
  userValueField?: UserPrincipalValue;
  /**
   * "field" (default) is a form-style select box. "chip" is the compact pill the rule
   * row's other dropdowns use, opening the same-width list directly.
   */
  variant?: "field" | "chip";
}

const splitValue = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Inner selector. Remounted per tenant by the exported wrapper, so obsolete options cannot be
 * rendered even for the single commit before an effect could clear them.
 */
const PrincipalSelectorInner = ({
  entity,
  projectKey,
  value,
  onChange,
  multiple,
  userValueField,
  variant = "field",
}: PrincipalSelectorProps) => {
  const isChip = variant === "chip";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedValues = multiple ? splitValue(value) : value.trim() ? [value.trim()] : [];

  // Browsing is gated on the popover; resolving what is already stored is NOT - a closed selector
  // still has to show its labels and any Unavailable marker.
  const browse = usePrincipalOptions({
    entity,
    projectKey,
    search,
    enabled: open,
    userValueField,
  });
  const stored = useStoredPrincipals({
    entity,
    projectKey,
    values: selectedValues,
    userValueField,
  });

  const failedMessage =
    entity === "role" ? PRINCIPAL_MESSAGES.ROLES_FAILED : PRINCIPAL_MESSAGES.USERS_FAILED;
  const emptyMessage =
    entity === "role" ? PRINCIPAL_MESSAGES.NO_ROLES : PRINCIPAL_MESSAGES.NO_USERS;

  const labelFor = (storedValue: string): string => {
    const known = browse.options.find((o) => o.value === storedValue);
    if (known) return known.primaryLabel;
    const state = stored.stateFor(storedValue);
    if (state.status === "resolved") return state.option.primaryLabel;
    if (state.status === "unavailable") {
      return `${storedValue} — ${PRINCIPAL_MESSAGES.UNAVAILABLE}`;
    }
    // resolving / unresolved / forbidden: show the raw stored value, never a guess.
    return storedValue;
  };

  const toggle = (option: PrincipalOption) => {
    if (!multiple) {
      // Re-selecting the current value clears it. Without this a single unavailable value could
      // never be removed, since it never appears among the browse results.
      onChange(value.trim() === option.value ? "" : option.value);
      setOpen(false);
      return;
    }
    const current = splitValue(value);
    const next = current.includes(option.value)
      ? current.filter((v) => v !== option.value)
      : [...current, option.value];
    onChange(next.join(","));
  };

  if (!projectKey) {
    return (
      <div className="flex h-10 w-full min-w-0 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground lg:flex-1">
        {PRINCIPAL_MESSAGES.MISSING_TENANT}
      </div>
    );
  }

  const triggerLabel = selectedValues.length
    ? selectedValues.map(labelFor).join(", ")
    : entity === "role"
      ? "Select role"
      : "Select user";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {isChip ? (
          <button
            type="button"
            // Empty reads "Not set" like the row's other chips; the label keeps the
            // control findable by what it picks.
            aria-label={selectedValues.length ? undefined : triggerLabel}
            className={cn(
              "flex h-8 min-w-0 max-w-full items-center justify-center truncate rounded-md border px-3 text-center text-xs font-semibold transition-colors",
              selectedValues.length
                ? "border-border/70 bg-muted/70 text-foreground hover:bg-muted"
                : "border-dashed border-border/50 bg-background text-muted-foreground hover:bg-muted/30",
            )}
          >
            <span className="block truncate">
              {selectedValues.length ? triggerLabel : "Not set"}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="flex h-10 w-full min-w-0 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground lg:flex-1"
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-2 shrink-0 opacity-50"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", isChip ? "w-52" : "w-64")} align="start">
        <div className="border-b p-2">
          <Input
            className={cn("h-8", isChip && "text-xs")}
            placeholder={entity === "role" ? "Search roles" : "Search users"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Command shouldFilter={false}>
          <CommandList>
            {browse.isForbidden ? (
              <div className="p-3 text-sm text-destructive">{PRINCIPAL_MESSAGES.FORBIDDEN}</div>
            ) : browse.error ? (
              <div className="flex items-center justify-between gap-2 p-3 text-sm text-destructive">
                <span>{failedMessage}</span>
                <button type="button" className="underline" onClick={() => browse.refetch()}>
                  Retry
                </button>
              </div>
            ) : browse.isLoading ? (
              <div className="p-3 text-sm text-muted-foreground" aria-busy="true">
                Loading…
              </div>
            ) : browse.options.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">{emptyMessage}</div>
            ) : (
              <CommandGroup>
                {browse.options.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      data-testid={`browse-option-${option.value}`}
                      onSelect={() => toggle(option)}
                      className={cn(isSelected && "bg-accent")}
                    >
                      {multiple && (
                        <Checkbox
                          checked={isSelected}
                          tabIndex={-1}
                          aria-label={`${isSelected ? "Deselect" : "Select"} ${option.primaryLabel}`}
                          className="pointer-events-none mr-2 shrink-0"
                        />
                      )}
                      <div className="flex flex-col">
                        <span>{option.primaryLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.secondaryLabel}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
                {browse.hasNextPage && (
                  <CommandItem
                    key="__load_more__"
                    value="__load_more__"
                    onSelect={() => browse.fetchNextPage()}
                  >
                    {browse.isFetchingNextPage ? "Loading…" : "Load more"}
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Keyed on the tenant ONLY - not on the search term. Keying on search too would remount on every
 * keystroke and drop focus, open state and debounce.
 *
 * The wrapper itself is NOT keyed, so it can observe a tenant change and drop a selection made
 * under the previous tenant. Remounting alone would not do this: `value` is controlled by the
 * form, so it survives the remount, and a slug that exists in both tenants would silently be
 * re-resolved as a DIFFERENT principal while still looking valid.
 */
export const PrincipalSelector = (props: PrincipalSelectorProps) => {
  const { projectKey, entity, value, onChange } = props;

  /**
   * A stored principal is only meaningful inside one (tenant, entity) scope: `admin` is a
   * different principal in another tenant, and a role slug read as a user id is a different
   * principal again. So the scope - not the tenant alone - is what the selection is tied to.
   *
   * A blank projectKey is deliberately NOT a scope: the project store can report "" transiently,
   * and treating that as a change would clear a stored value the administrator never touched,
   * which is the H5 data loss this feature exists to avoid.
   *
   * Clearing is the fail-safe direction. An emptied field is visible and blocked by the existing
   * "Value is required" validation; a silently retained wrong principal is neither.
   */
  const scope = projectKey ? `${projectKey}::${entity}` : null;

  /**
   * Bookkeeping lives in a ref that is only ever written inside the effect. The two render-time
   * alternatives are both rejected by this repo's React Compiler lint rules - reading a ref during
   * render, and calling setState synchronously inside an effect - so the scope change is detected
   * after commit rather than during it.
   *
   * Residual, stated rather than hidden: on the single commit where the scope changes, the
   * outgoing value is still displayed until this effect runs. It cannot be PERSISTED, because
   * submission requires an explicit click and the effect has cleared the field long before that;
   * the exposure is visual and lasts one frame.
   */
  const lastScope = useRef<string | null>(null);

  useEffect(() => {
    if (scope === null) return; // transient blank tenant: record nothing, clear nothing
    const previous = lastScope.current;
    lastScope.current = scope;
    if (previous !== null && previous !== scope && value) {
      onChange("");
    }
  }, [scope, value, onChange]);

  return <PrincipalSelectorInner key={scope ?? ""} {...props} />;
};

