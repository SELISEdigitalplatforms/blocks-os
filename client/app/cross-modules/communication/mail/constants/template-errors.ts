type TranslateFn = (key: string) => string;

/**
 * SPEC34 §6.1: the Default template was deleted but its copies' job wasn't queued. The template is
 * gone, so the dialog closes and the list refreshes even though the request failed (C5).
 */
export const DEFAULT_DELETED_COPIES_NOT_STARTED =
  "The Default template was deleted, but deleting organization copies couldn't start. Try again from an organization's template.";

/** The template endpoints' English messages and the keys the console shows them through. */
const TEMPLATE_ERROR_KEYS: Record<string, string> = {
  "A clone keeps the template's name": "TEMPLATE_ERRORS.CLONE_KEEPS_NAME",
  "This template already exists in that language": "TEMPLATE_ERRORS.CLONE_LANGUAGE_EXISTS",
  "An inbound configuration can't send mail": "TEMPLATE_ERRORS.CONFIGURATION_INBOUND",
  "Configuration not found": "TEMPLATE_ERRORS.CONFIGURATION_NOT_FOUND",
  "Template with the same Name and Language already exists": "TEMPLATE_ERRORS.DUPLICATE",
  "A template's language can't be changed": "TEMPLATE_ERRORS.LANGUAGE_LOCKED",
  "Language is required": "TEMPLATE_ERRORS.LANGUAGE_REQUIRED",
  "A template's name can't be changed": "TEMPLATE_ERRORS.NAME_LOCKED",
  "A template's organization can't be changed": "TEMPLATE_ERRORS.ORGANIZATION_LOCKED",
  "Organization not found": "TEMPLATE_ERRORS.ORGANIZATION_NOT_FOUND",
  "Subject is required.": "TEMPLATE_ERRORS.SUBJECT_REQUIRED",
  "Template not found": "TEMPLATE_ERRORS.TEMPLATE_NOT_FOUND",
  "Select at least one template": "TEMPLATE_ERRORS.ASSIGN_NONE_SELECTED",
  "No more than 500 templates per request": "TEMPLATE_ERRORS.ASSIGN_TOO_MANY",
  "Some templates aren't in this configuration's organization":
    "TEMPLATE_ERRORS.ASSIGN_OTHER_ORGANIZATION",
  "Only Default organization templates can be copied": "TEMPLATE_ERRORS.COPY_NOT_DEFAULT",
  "Finish the template before copying": "TEMPLATE_ERRORS.COPY_EMPTY_BODY",
  "Select at least one organization": "TEMPLATE_ERRORS.COPY_NONE_SELECTED",
  "No more than 1000 organizations per request": "TEMPLATE_ERRORS.COPY_TOO_MANY",
  "No more than 25 organizations per request": "TEMPLATE_ERRORS.COPY_LOOKUP_TOO_MANY",
  "Choose keep or replace": "TEMPLATE_ERRORS.COPY_EXISTING_REQUIRED",
  "Copying couldn't start. Try again.": "TEMPLATE_ERRORS.COPY_NOT_STARTED",
  "Only Default organization templates can be deleted across organizations":
    "TEMPLATE_ERRORS.DELETE_NOT_DEFAULT",
  [DEFAULT_DELETED_COPIES_NOT_STARTED]: "TEMPLATE_ERRORS.DELETE_COPIES_NOT_STARTED",
  "Deleting organization copies couldn't start. Try again.": "TEMPLATE_ERRORS.DELETE_NOT_STARTED",
};

/** `customMessages` for showErrorToast: each known server message through its English key. */
export const templateErrorMessages = (t: TranslateFn): Record<string, string> =>
  Object.fromEntries(
    Object.entries(TEMPLATE_ERROR_KEYS).map(([message, key]) => [message, t(key)]),
  );
