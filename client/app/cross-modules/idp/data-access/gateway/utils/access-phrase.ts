import {
  LOGICAL_OPERATOR,
  NULL_OPERATORS,
  NUMBER_TO_OPERATOR,
  READABLE_OPERATORS,
} from "../constants/schema-access-control";
import type { AccessTier } from "../components/primitives";
import type { IPolicyItem, IPolicyRule, IPolicyRuleGroup } from "../models/data-service";

/**
 * How alarming an effect is. This is not the access tier: a custom policy with
 * no rule sets is "custom" but grants nothing, and inherited says nothing at all
 * until you look at the schema.
 */
export type AccessRisk = "open" | "caution" | "scoped" | "none" | "inherited" | "unknown";

export type AccessEffect = {
  /** Short label above the sentence. */
  heading: string;
  /** One sentence, in plain English, about who can do this. */
  text: string;
  risk: AccessRisk;
};

/** Verb as it reads mid-sentence: "Anyone on the internet can *read* Order." */
const VERB_PHRASES: Record<string, string> = {
  view: "read",
  create: "create records in",
  edit: "edit",
  delete: "delete from",
};

export const verbPhrase = (tab: string) => VERB_PHRASES[tab] ?? tab;

/** Where an operand comes from. 0 Auth, 1 Schema Fields, 2 Static Value. */
const LEFT_SOURCE_PHRASES: Record<number, string> = {
  0: "the signed-in user's",
  1: "the record's",
  2: "the value",
};

const RIGHT_SOURCE_PHRASES: Record<number, string> = {
  0: "the signed-in user's",
  1: "the record's",
  2: "",
};

const quoteList = (value: string | string[] | null | undefined): string => {
  if (Array.isArray(value)) return value.map((v) => `“${v}”`).join(" or ");
  return `“${value ?? ""}”`;
};

/**
 * One rule as a sentence fragment, e.g.
 * `the record's OwnerId equals the signed-in user's UserId`.
 *
 * `ruleToText` in schema-access-control.utils reads as a debug dump — "Auth's
 * UserId equals Schema Fields's OwnerId". This is the same information written
 * the way the inspector needs to say it out loud.
 */
export function rulePhrase(rule: IPolicyRule): string {
  const left = `${LEFT_SOURCE_PHRASES[rule.leftSource] ?? ""} ${rule.leftOperand}`.trim();
  const operator = READABLE_OPERATORS[rule.operator] ?? `operator(${rule.operator})`;

  if (NULL_OPERATORS.includes(NUMBER_TO_OPERATOR[rule.operator] ?? "")) {
    return `${left} ${operator}`;
  }

  if (rule.rightSource === 2) {
    return `${left} ${operator} ${quoteList(rule.staticValue)}`;
  }

  const rightOperand = rule.rightOperands?.length
    ? rule.rightOperands.join(", ")
    : rule.rightOperand;
  const rightSource = RIGHT_SOURCE_PHRASES[rule.rightSource] ?? "";
  const rightPhrase = `${rightSource} ${rightOperand}`.trim();
  return `${left} ${operator} ${rightPhrase}`;
}

export type RuleSetLine = {
  /** Stable within a rule set: the line's position path, so lists can key on it. */
  id: string;
  /** "when" opens the set; later lines carry the joiner of the group they sit in. */
  lead: string;
  text: string;
  /** 0 at the top of the set, one deeper for each group a line sits inside. */
  depth: number;
  kind: "rule" | "group";
};

/**
 * A rule set as lines: the first reads "when …", the rest carry the joiner the
 * set combines with. A nested group is a line of its own ("any of:" / "all of:")
 * followed by its contents one level deeper, which open with no lead since the
 * group line already says how they combine.
 */
export function ruleSetLines(policy: IPolicyItem): RuleSetLine[] {
  const walk = (group: IPolicyRuleGroup, depth: number, prefix: string): RuleSetLine[] => {
    const joiner = group.logicalOperator === LOGICAL_OPERATOR.AND ? "and" : "or";
    const items = [
      ...(group.rules ?? []).map((rule) => ({ rule })),
      ...(group.nestedGroups ?? []).map((nested) => ({ nested })),
    ];
    return items.flatMap((item, index): RuleSetLine[] => {
      const id = `${prefix}${index}`;
      let lead = joiner;
      if (index === 0) lead = depth === 0 ? "when" : "";
      if ("rule" in item) {
        return [{ id, lead, text: rulePhrase(item.rule), depth, kind: "rule" }];
      }
      const matchesAll = item.nested.logicalOperator === LOGICAL_OPERATOR.AND;
      return [
        { id, lead, text: matchesAll ? "all of:" : "any of:", depth, kind: "group" },
        ...walk(item.nested, depth + 1, `${id}.`),
      ];
    });
  };
  return walk(policy.ruleGroup, 0, "");
}

const listNames = (policies: IPolicyItem[]) => {
  const names = policies.map((p) => p.policyName).filter(Boolean);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`;
};

/**
 * The sentence under the tier selector: who can do this, right now.
 *
 * A deny policy suppresses the claim entirely. The whole sentence rests on
 * "granted when any rule set matches", which is only true of allow-policies —
 * and the UI cannot create a deny policy, but a schema import can
 * (`SchemaImportMapping`). People make security decisions on this line, so
 * where it cannot be stated truthfully it is not stated at all.
 */
export function accessEffect({
  tier,
  tab,
  subject,
  policies = [],
}: {
  tier: AccessTier;
  /** view | create | edit | delete */
  tab: string;
  /** What is being protected, e.g. "Order" or "Order.Email". */
  subject: string;
  policies?: IPolicyItem[];
}): AccessEffect {
  const verb = verbPhrase(tab);

  if (tier === "public") {
    return {
      heading: "Anyone, no sign-in",
      text: `Anyone on the internet can ${verb} ${subject}. This is the widest grant available.`,
      risk: "open",
    };
  }

  if (tier === "user") {
    return {
      heading: "Every signed-in user",
      text: `Any signed-in user in this project can ${verb} ${subject}, with no further checks.`,
      risk: "caution",
    };
  }

  if (tier === "inherited") {
    return {
      heading: "Inherited",
      text: `Follows whatever the schema allows for ${verb === "read" ? "reading" : verb}.`,
      risk: "inherited",
    };
  }

  if (policies.some((policy) => policy.isAllowPolicy === false)) {
    return {
      heading: "Cannot be summarised",
      text:
        `This policy includes a deny rule set, which the editor cannot represent. ` +
        `Read the rule sets below rather than trusting a summary.`,
      risk: "unknown",
    };
  }

  // The trap: custom with nothing in it looks configured and grants nothing.
  if (policies.length === 0) {
    return {
      heading: "Nobody",
      text: `A custom policy with no rule sets allows nobody to ${verb} ${subject}.`,
      risk: "none",
    };
  }

  return {
    heading: "Effect",
    text:
      policies.length === 1
        ? `A signed-in user can ${verb} ${subject} when ${listNames(policies)} matches.`
        : `A signed-in user can ${verb} ${subject} when any of these ${policies.length} rule sets match: ${listNames(policies)}.`,
    risk: "scoped",
  };
}

