import { useRef, MouseEvent, useState, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { cn, debounce } from "@/lib/utils";
interface SearchInputProps {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
  className?: string;
}
export const SearchInput: React.FC<SearchInputProps> = ({
  onChange,
  placeholder = "Search...",
  value,
  className = "",
}) => {
  const [state, setState] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setState(value);
  }
  const inputRef = useRef<HTMLInputElement>(null);
  // The debounced wrapper must stay stable for the whole lifetime, but callers pass a new
  // inline onChange every render. Route through a ref refreshed on each render so the
  // debounced call always reaches the latest prop instead of the first render's closure.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const debounced = useMemo(() => debounce((val: string) => onChangeRef.current(val), 300), []);
  useEffect(() => {
    return () => {
      debounced.cancel();
    };
  }, [debounced]);
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    setState(event.target.value);
    debounced(event.target.value);
  };
  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    setState("");
    onChange("");
  };
  return (
    <div className="flex items-center rounded-sm border px-2">
      <Search className="mr-2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={state}
        onChange={handleChange}
        className={cn(
          "h-8 w-52 border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
      />
      <Button
        variant="ghost"
        size="xs"
        className={cn("h-full p-1 pr-0 hover:bg-transparent", !value && "invisible")}
        onClick={handleClear}
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
};
