import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";

export type ConnectProjectOption = {
  tenantGroupId: string;
  name: string;
};

type ConnectProjectPickerProps = {
  projects: ConnectProjectOption[];
  value: string | null;
  onValueChange: (tenantGroupId: string) => void;
};

export function ConnectProjectPicker({ projects, value, onValueChange }: Readonly<ConnectProjectPickerProps>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = projects.find((project) => project.tenantGroupId === value);
  const filtered = projects.filter((project) =>
    project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="Project"
          aria-expanded={open}
          className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-input bg-background px-3 text-left text-sm text-high-emphasis transition-colors hover:border-primary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
            {selected?.name ?? "Select a project"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-medium-emphasis" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1 shadow-lg">
        <Command shouldFilter={false} label="Search projects">
          <CommandInput
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder="Search projects..."
            aria-label="Search projects"
          />
          <CommandList className="max-h-64">
            {filtered.length === 0 ? <CommandEmpty>No projects found.</CommandEmpty> : null}
            <CommandGroup>
              {filtered.map((project) => (
                <CommandItem
                  key={project.tenantGroupId}
                  value={project.tenantGroupId}
                  onSelect={() => {
                    onValueChange(project.tenantGroupId);
                    handleOpenChange(false);
                  }}
                  className="min-h-10 gap-2 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {project.tenantGroupId === value && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
