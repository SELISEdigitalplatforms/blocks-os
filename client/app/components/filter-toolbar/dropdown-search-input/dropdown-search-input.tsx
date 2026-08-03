import { useRef, MouseEvent, useState, useEffect, useMemo, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { cn, debounce } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
type ValueType = { selected: string; value: string };
interface DropdownSearchInputProps {
  onChange: (params: ValueType) => void;
  placeholder?: string;
  value: ValueType;
  className?: {
    selectContent?: string;
    SelectItem?: string;
    input?: string;
  };
  options: { label: ReactNode; value: string }[];
  /** Debounce (ms) before propagating a search change. Default 300. */
  debounceMs?: number;
  /** Only search once the trimmed value reaches this length; below it the search is cleared. Default 0 (no minimum). */
  minSearchLength?: number;
  /** Keep the typed value when the user switches the search field instead of clearing it. Default false. */
  keepValueOnTypeChange?: boolean;
}
export const DropdownSearchInput: React.FC<DropdownSearchInputProps> = ({
  onChange,
  placeholder = "Search...",
  value,
  className = {},
  options = [],
  debounceMs = 300,
  minSearchLength = 0,
  keepValueOnTypeChange = false,
}) => {
  const [state, setState] = useState<ValueType>(value);
  const [prevValue, setPrevValue] = useState<ValueType>(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setState(value);
  }
  const inputRef = useRef<HTMLInputElement>(null);
  // See search-input.tsx: the debounced wrapper stays stable while the ref keeps the latest
  // onChange, so a caller passing a new inline callback each render is still called correctly.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const debounced = useMemo(
    () => debounce((val: ValueType) => onChangeRef.current(val), debounceMs),
    [debounceMs],
  );
  useEffect(() => {
    return () => {
      debounced.cancel();
    };
  }, [debounced]);
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const raw = event.target.value;
    setState((prev) => ({ ...prev, value: raw }));
    // Only search once the term is long enough; below the minimum, clear the active search so the
    // list falls back to showing everything rather than filtering on one or two characters.
    const meetsMin = raw.trim().length >= minSearchLength;
    debounced({ selected: state.selected, value: meetsMin ? raw : "" });
  };
  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    const data = { ...state, value: "" };
    setState(data);
    onChange(data);
  };
  const handleSelect = (value: string) => {
    // Keep the current term when switching fields (e.g. name <-> email) so the user can re-run the same
    // search against the other field without retyping; otherwise fall back to clearing it.
    const nextValue = keepValueOnTypeChange ? state.value : "";
    setState({ selected: value, value: nextValue });
    onChange({ selected: value, value: nextValue });
  };
  return (
    <div className="flex items-center gap-2 rounded-md border pr-2">
      <Select onValueChange={handleSelect} value={state.selected}>
        <SelectTrigger className="h-8 w-fit gap-1 rounded-e-none border-0 border-r focus:ring-0 focus:ring-ring focus:ring-offset-0">
          <SelectValue></SelectValue>
        </SelectTrigger>
        <SelectContent className={cn(className.selectContent)}>
          {options.map((item) => (
            <SelectItem key={item.value} value={item.value} className={cn(className.SelectItem)}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={state.value}
        onChange={handleChange}
        className={cn(
          "h-8 w-52 border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0",
          className?.input,
        )}
      />
      <Button
        variant="ghost"
        size="xs"
        className={cn("h-full p-1 pr-0 hover:bg-transparent", !value.value && "invisible")}
        onClick={handleClear}
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
};
