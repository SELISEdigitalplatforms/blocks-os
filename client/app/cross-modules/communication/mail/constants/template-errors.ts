type TranslateFn = (key: string) => string;

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
};

/** `customMessages` for showErrorToast: each known server message through its English key. */
export const templateErrorMessages = (t: TranslateFn): Record<string, string> =>
  Object.fromEntries(
    Object.entries(TEMPLATE_ERROR_KEYS).map(([message, key]) => [message, t(key)]),
  );
