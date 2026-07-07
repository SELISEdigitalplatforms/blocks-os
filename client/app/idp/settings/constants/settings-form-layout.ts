/** Tailwind layout tokens for IDP settings forms. Canonical source: auth-settings-form.tsx */
export const SETTINGS_FORM_LAYOUT = {
  formRoot: "w-full min-w-0",
  formStack: "flex flex-col gap-6",
  sectionHeader: "mb-4",
  sectionHeaderWithActions: "mb-4 flex flex-row items-start justify-between gap-3",
  sectionTitle: "text-base sm:text-lg",
  fieldGrid: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  stackedFields: "space-y-4",
  inputFull: "w-full",
  inputWithSuffix: "w-full pr-[5.5rem]",
  inputSuffix: "text-sm text-muted-foreground",
  toggleRow: "flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between",
  toggleLabelGroup: "min-w-0 flex-1 space-y-1",
  toggleTitle: "!mt-0 text-sm font-semibold sm:text-base",
  toggleDescription: "text-sm text-muted-foreground",
} as const

export type SettingsFormLayoutKey = keyof typeof SETTINGS_FORM_LAYOUT
