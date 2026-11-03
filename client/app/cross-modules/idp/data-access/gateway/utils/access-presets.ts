import { RULE_SOURCE_TYPES } from "../constants/schema-access-control";
import type { IField } from "../models/data-service";
import { gt } from "./gateway-i18n";

/** One row of the rule-set form, in the shape `ruleSetSchema` expects. */
export type PresetRuleRow = {
  source: string;
  field: string;
  operator: string;
  compareSource: string;
  compareValue: string;
};

export type PresetRuleSet = {
  name: string;
  logicalOperator: "AND" | "OR";
  rules: PresetRuleRow[];
};

export type AccessPreset = {
  id: string;
  title: string;
  hint: string;
  /** More than one set means each grants access on its own — they combine with OR. */
  ruleSets: PresetRuleSet[];
};

/**
 * Owner column, in the order we would rather find it.
 *
 * `CreatedBy` is a default property on every entity schema, so it is the one
 * ownership column we can count on; a project that models ownership explicitly
 * usually calls it `OwnerId`, and that should win when it exists.
 */
const OWNER_FIELD_CANDIDATES = ["OwnerId", "UserId", "CreatedBy"];

export const pickOwnerField = (fields: Pick<IField, "name">[] = []): string | null => {
  const names = new Set(fields.map((f) => f.name));
  return OWNER_FIELD_CANDIDATES.find((candidate) => names.has(candidate)) ?? null;
};

const ownerSet = (ownerField: string): PresetRuleSet => ({
  name: gt("ACCESS_PRESETS.OWNER_ACCESS"),
  logicalOperator: "AND",
  rules: [
    {
      source: RULE_SOURCE_TYPES.SCHEMA_FIELD,
      field: ownerField,
      operator: "EQUAL",
      compareSource: RULE_SOURCE_TYPES.AUTH,
      compareValue: "userId",
    },
  ],
});

const roleSet = (): PresetRuleSet => ({
  name: gt("ACCESS_PRESETS.ROLE_ACCESS"),
  logicalOperator: "AND",
  rules: [
    {
      source: RULE_SOURCE_TYPES.AUTH,
      field: "roles",
      operator: "CONTAIN",
      compareSource: RULE_SOURCE_TYPES.STATIC_VALUE,
      // Left blank on purpose: which roles is the one decision only the project
      // can make, and a plausible-looking default would get saved unread.
      compareValue: "",
    },
  ],
});

/**
 * Starting points for a custom policy.
 *
 * A preset fills the rule-set form rather than saving straight away, so the
 * rules it wrote are reviewed before they grant anything — and so there is one
 * payload builder rather than two that can drift.
 *
 * Presets needing an ownership column disappear when the schema has none,
 * instead of offering a rule that points at a field that is not there.
 */
export function accessPresets(fields: Pick<IField, "name">[] = []): AccessPreset[] {
  const ownerField = pickOwnerField(fields);

  return [
    ...(ownerField
      ? [
          {
            id: "owner",
            title: gt("ACCESS_PRESETS.ONLY_OWNER_TITLE"),
            hint: gt("ACCESS_PRESETS.ONLY_OWNER_HINT", { field: ownerField }),
            ruleSets: [ownerSet(ownerField)],
          },
        ]
      : []),
    {
      id: "roles",
      title: gt("ACCESS_PRESETS.ROLES_TITLE"),
      hint: gt("ACCESS_PRESETS.ROLES_HINT"),
      ruleSets: [roleSet()],
    },
    ...(ownerField
      ? [
          {
            id: "owner-plus-support",
            title: gt("ACCESS_PRESETS.OWNER_PLUS_SUPPORT_TITLE"),
            hint: gt("ACCESS_PRESETS.OWNER_PLUS_SUPPORT_HINT"),
            ruleSets: [
              ownerSet(ownerField),
              { ...roleSet(), name: gt("ACCESS_PRESETS.SUPPORT_OVERRIDE") },
            ],
          },
        ]
      : []),
  ];
}
