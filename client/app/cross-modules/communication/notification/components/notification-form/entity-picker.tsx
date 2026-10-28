import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui-kits/input/input";
import { NOTIFICATION_TEXT } from "../../constants/notification-ui.constant";

export interface PickerOption {
  value: string;
  label: string;
}

export interface PickerSearchResult {
  options: PickerOption[];
  isLoading: boolean;
}

interface EntityPickerProps {
  label: string;
  placeholder: string;
  values: string[];
  max: number;
  onChange: (values: string[]) => void;
  /** Runs the search; called on every render, so it must be a hook. */
  useSearch: (term: string, enabled: boolean) => PickerSearchResult;
  /** Text shown on a chip; the stored value when the picker has no better name. */
  labelOf?: (value: string) => string;
}

const SEARCH_DEBOUNCE_MS = 300;

const useDebounced = (value: string) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = globalThis.setTimeout(() => setDebounced(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => globalThis.clearTimeout(timer);
  }, [value]);
  return debounced;
};

/** Selected values as removable chips, with a search box that lists matches to add. */
export function EntityPicker({
  label,
  placeholder,
  values,
  max,
  onChange,
  useSearch,
  labelOf = (value) => value,
}: Readonly<EntityPickerProps>) {
  const listId = useId();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(term);
  const { options, isLoading } = useSearch(debounced, open);
  const choices = options.filter((o) => !values.includes(o.value));
  const full = values.length >= max;

  const add = (option: PickerOption) => {
    if (full) return;
    onChange([...values, option.value]);
    setTerm("");
  };

  return (
    <div className="relative flex flex-wrap items-center gap-1.5 rounded-sm border px-2 py-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="flex h-fit items-center gap-1.5 rounded-sm border bg-muted px-2 py-0.5 text-sm"
        >
          <span className="break-all">{labelOf(value)}</span>
          <button
            type="button"
            aria-label={`Remove ${labelOf(value)}`}
            onClick={() => onChange(values.filter((v) => v !== value))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <Input
        aria-label={label}
        value={term}
        disabled={full}
        placeholder={placeholder}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="h-fit min-w-40 flex-1 border-0 p-0 py-0.5 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {open && (
        <ul
          id={listId}
          aria-label={label}
          className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border bg-popover p-1 shadow-md"
        >
          {isLoading && <li className="px-2 py-1.5 text-sm text-medium-emphasis">{NOTIFICATION_TEXT.loading}</li>}
          {!isLoading && choices.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-medium-emphasis">{NOTIFICATION_TEXT.noMatches}</li>
          )}
          {choices.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
