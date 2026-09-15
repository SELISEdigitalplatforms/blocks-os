import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import {
  SECRET_TAG_MAX_PER_SECRET,
  isValidSecretTag,
  secretTagLabel,
  toSecretTagKey,
  type SecretTagEntry,
} from "@/cross-modules/secrets/models/secret.model";

interface SecretTagInputProps {
  /** Canonical tag keys. */
  value: string[];
  onChange: (tags: string[]) => void;
  /** The tenant catalogue, for suggestions and for resolving a key to its label. */
  catalogue: SecretTagEntry[];
  disabled?: boolean;
}

/**
 * Chip editor for a secret's tags.
 *
 * The catalogue supplies suggestions but does not constrain the field — anything typed can be
 * added, and the server adds it to the catalogue once the secret saves. Free text is slugified
 * on the way in (`toSecretTagKey`), so someone typing "Payments Team" gets `payments-team`
 * rather than a validation error about spaces.
 */
export function SecretTagInput({ value, onChange, catalogue, disabled }: SecretTagInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const atLimit = value.length >= SECRET_TAG_MAX_PER_SECRET;

  const suggestions = useMemo(
    () => catalogue.filter((entry) => !value.includes(entry.key)),
    [catalogue, value],
  );

  // What the typed text would become. Offered only when it is usable and not already present,
  // in the list or in the catalogue — the catalogue entry would otherwise be shown twice, once
  // as itself and once as a thing to create.
  const typedKey = toSecretTagKey(query);
  const canCreateTyped =
    isValidSecretTag(typedKey) &&
    !value.includes(typedKey) &&
    !suggestions.some((entry) => entry.key === typedKey);

  const add = (key: string) => {
    if (atLimit || value.includes(key)) return;
    onChange([...value, key]);
    setQuery("");
  };

  const remove = (key: string) => onChange(value.filter((tag) => tag !== key));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {value.map((key) => (
            <li key={key}>
              <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                {secretTagLabel(key, catalogue)}
                <button
                  type="button"
                  onClick={() => remove(key)}
                  disabled={disabled}
                  aria-label={`Remove ${secretTagLabel(key, catalogue)}`}
                  className="rounded-sm opacity-60 transition-opacity hover:opacity-100 disabled:pointer-events-none"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            // Deliberately not role="combobox": the popup Radix announces is a dialog, and a
            // combobox takes its accessible name from aria-label rather than its content, so
            // the role would leave this button nameless to a screen reader.
            aria-expanded={open}
            disabled={disabled || atLimit}
            className="h-8 border-dashed"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command
            // The create affordance is driven by the raw query, so filtering has to be ours:
            // Command's own filter would hide the typed text once nothing matches it.
            shouldFilter={false}
          >
            <CommandInput
              placeholder="Search or type a new tag"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {suggestions.length === 0 && !canCreateTyped && (
                <CommandEmpty>
                  {query ? "That tag is already added." : "No tags yet — type one to create it."}
                </CommandEmpty>
              )}

              {canCreateTyped && (
                <CommandGroup heading="Create">
                  <CommandItem value={`create-${typedKey}`} onSelect={() => add(typedKey)}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="truncate">{typedKey}</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {suggestions.length > 0 && (
                <CommandGroup heading="Suggested">
                  {suggestions
                    .filter(
                      (entry) =>
                        !query ||
                        entry.label.toLowerCase().includes(query.toLowerCase()) ||
                        entry.key.includes(toSecretTagKey(query)),
                    )
                    .map((entry) => (
                      <CommandItem key={entry.key} value={entry.key} onSelect={() => add(entry.key)}>
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        <span className="truncate">{entry.label}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {atLimit && (
        <p className="text-xs text-muted-foreground">
          A secret may carry at most {SECRET_TAG_MAX_PER_SECRET} tags.
        </p>
      )}
    </div>
  );
}
