import { Button } from "@/components/ui-kits/button/button";
import { ChevronRight } from "lucide-react";

import type { AccessPreset } from "../../utils/access-presets";

/**
 * Starting points offered when a custom policy has no rule sets yet.
 *
 * The empty state used to be an empty table with an Add button, which told you
 * nothing about what a rule set is for. Each preset fills the form with rules
 * you can read and change before saving.
 */
export function AccessPresetList({
  presets,
  onApply,
  onStartBlank,
}: Readonly<{
  presets: AccessPreset[];
  onApply: (preset: AccessPreset) => void;
  onStartBlank: () => void;
}>) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
        Sample rule set
      </p>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onApply(preset)}
          className="flex w-full items-center gap-3 rounded-md border border-border/50 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-foreground">
              {preset.title}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {preset.hint}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full text-xs text-muted-foreground"
        onClick={onStartBlank}
      >
        Start from an empty rule set
      </Button>
    </div>
  );
}

