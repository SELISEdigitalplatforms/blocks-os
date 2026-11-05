import type { ICopyTemplateToOrganizationsRequest } from "@blocks-communication/mail/models/email";

/** What happens to an organization that already has its own template with the same name and language. */
export type ExistingCopies = "keep" | "replace";

/**
 * A copy-to-organizations choice (SPEC33). New Template keeps it in the page across both steps and
 * sends it only after the step-2 save (§6.4); the details page dialog sends it at once.
 */
export interface ShareChoice {
  /** False: only the Default organization has the template. */
  copy: boolean;
  allOrganizations: boolean;
  /** The chosen organizations, id to name (the names are shown, the ids sent). */
  selected: ReadonlyMap<string, string>;
  existing: ExistingCopies;
}

export const NO_SHARE: ShareChoice = {
  copy: false,
  allOrganizations: false,
  selected: new Map(),
  existing: "keep",
};

/** The most organizations one copy request names (SPEC33 §6.1). */
export const MAX_COPY_ORGANIZATIONS = 1000;

/** Whether the choice can be sent: no copy, all organizations, or 1 to 1000 chosen (C8). */
export const isShareReady = (choice: ShareChoice) =>
  !choice.copy ||
  choice.allOrganizations ||
  (choice.selected.size > 0 && choice.selected.size <= MAX_COPY_ORGANIZATIONS);

export const toCopyRequest = (
  templateId: string,
  choice: ShareChoice,
): ICopyTemplateToOrganizationsRequest =>
  choice.allOrganizations
    ? { templateId, allOrganizations: true, existing: choice.existing }
    : {
        templateId,
        allOrganizations: false,
        organizationIds: [...choice.selected.keys()],
        existing: choice.existing,
      };

type TranslateFn = (key: string, values?: Readonly<Record<string, string | number>>) => string;

const SHOWN_NAMES = 3;

/** "A", "A and B", "A, B and C", or "A, B, C and N more", through the English list keys. */
export const joinNames = (names: readonly string[], t: TranslateFn): string => {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= SHOWN_NAMES) {
    return t("SHARE_WITH_ORGANIZATIONS.LIST_AND", {
      items: names.slice(0, -1).join(", "),
      last: names.at(-1) ?? "",
    });
  }
  return t("SHARE_WITH_ORGANIZATIONS.LIST_MORE", {
    items: names.slice(0, SHOWN_NAMES).join(", "),
    count: names.length - SHOWN_NAMES,
  });
};
