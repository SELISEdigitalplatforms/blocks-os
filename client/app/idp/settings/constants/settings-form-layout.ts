/** Tailwind layout tokens for IDP settings forms. Canonical source: auth-settings-form.tsx */
export const SETTINGS_FORM_LAYOUT = {
  formRoot: "w-full min-w-0",
  formStack: "flex flex-col gap-6",
  sectionHeader: "mb-4",
  sectionHeaderWithActions: "mb-4 flex flex-row items-start justify-between gap-3",
  tabLabel: "text-sm font-medium",
  sectionTitle: "text-base font-semibold leading-snug sm:text-lg",
  fieldLabel: "text-sm font-medium leading-none",
  fieldDescription: "text-sm leading-snug text-muted-foreground",
  fieldValue: "text-sm font-normal text-high-emphasis",
  fieldGrid: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  stackedFields: "space-y-4",
  inputFull: "w-full",
  inputWithSuffix: "w-full pr-[5.5rem]",
  inputSuffix: "text-xs font-normal text-muted-foreground sm:text-sm",
  toggleRow: "flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between",
  toggleLabelGroup: "min-w-0 flex-1 space-y-1",
  toggleTitle: "text-sm font-semibold leading-snug sm:text-base",
  toggleDescription: "text-sm leading-snug text-muted-foreground",
  emptyState: "text-sm text-muted-foreground",
  linkText: "text-sm font-medium text-high-emphasis underline",
  overviewSectionTitle: "text-sm font-semibold sm:text-base",
  overviewMetaLabel: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
  chipTitleBadge: "text-sm font-medium",
  chipSubtitleBadge: "text-xs text-muted-foreground",
} as const

export type SettingsFormLayoutKey = keyof typeof SETTINGS_FORM_LAYOUT
