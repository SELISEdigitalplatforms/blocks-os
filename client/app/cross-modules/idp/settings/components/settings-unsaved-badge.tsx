/** Surfaces pending removals too, whose chips are simply gone from the list. */
export const SettingsUnsavedBadge = () => (
  <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-amber-500/60 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-700 dark:text-amber-400">
    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
    Unsaved
  </span>
);
