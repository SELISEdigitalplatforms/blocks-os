import {
  LOGICAL_OPERATOR,
  NULL_OPERATORS,
  NUMBER_TO_OPERATOR,
  READABLE_OPERATORS,
} from "../constants/schema-access-control";
import type { AccessTier } from "../components/primitives";
import type { IPolicyItem, IPolicyRule, IPolicyRuleGroup } from "../models/data-service";
import { gt } from "./gateway-i18n";

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

/**
 * The operation tabs. Each sentence has one key per tab, because the verb
 * cannot be spliced into a sentence in every language ("can read X" / "X lesen").
 */
export type OperationTab = "view" | "create" | "edit" | "delete";

export const asOperationTab = (tab: string): OperationTab =>
  tab === "create" || tab === "edit" || tab === "delete" ? tab : "view";

const PUBLIC_TEXT: Record<OperationTab, string> = {
  view: "ACCESS_PHRASE.PUBLIC_VIEW",
  create: "ACCESS_PHRASE.PUBLIC_CREATE",
  edit: "ACCESS_PHRASE.PUBLIC_EDIT",
  delete: "ACCESS_PHRASE.PUBLIC_DELETE",
};
const REQUESTER_TEXT: Record<OperationTab, string> = {
  view: "ACCESS_PHRASE.REQUESTER_VIEW",
  create: "ACCESS_PHRASE.REQUESTER_CREATE",
  edit: "ACCESS_PHRASE.REQUESTER_EDIT",
  delete: "ACCESS_PHRASE.REQUESTER_DELETE",
};
const INHERITED_TEXT: Record<OperationTab, string> = {
  view: "ACCESS_PHRASE.INHERITED_VIEW",
  create: "ACCESS_PHRASE.INHERITED_CREATE",
  edit: "ACCESS_PHRASE.INHERITED_EDIT",
  delete: "ACCESS_PHRASE.INHERITED_DELETE",
};
const NOBODY_TEXT: Record<OperationTab, string> = {
  view: "ACCESS_PHRASE.NOBODY_VIEW",
  create: "ACCESS_PHRASE.NOBODY_CREATE",
  edit: "ACCESS_PHRASE.NOBODY_EDIT",
  delete: "ACCESS_PHRASE.NOBODY_DELETE",
};
const ONE_RULE_SET_TEXT: Record<OperationTab, string> = {
  view: "ACCESS_PHRASE.ONE_SET_VIEW",
  create: "ACCESS_PHRASE.ONE_SET_CREATE",
  edit: "ACCESS_PHRASE.ONE_SET_EDIT",
  delete: "ACCESS_PHRASE.ONE_SET_DELETE",
};
const MANY_RULE_SETS_TEXT: Record<OperationTab, string> = {
  view: "ACCESS_PHRASE.MANY_SETS_VIEW",
  create: "ACCESS_PHRASE.MANY_SETS_CREATE",
  edit: "ACCESS_PHRASE.MANY_SETS_EDIT",
  delete: "ACCESS_PHRASE.MANY_SETS_DELETE",
};

/**
 * Where an operand comes from: 0 Auth, 1 Schema Fields, 2 Static Value. Each
 * phrase takes the operand's name, since the possessive reads differently in
 * other languages ("the record's X" / "X des Datensatzes").
 */
const LEFT_SOURCE_PHRASES: Record<number, string> = {
  0: "ACCESS_PHRASE.OPERAND_AUTH",
  1: "ACCESS_PHRASE.OPERAND_RECORD",
  2: "ACCESS_PHRASE.OPERAND_VALUE",
};

const RIGHT_SOURCE_PHRASES: Record<number, string> = {
  0: "ACCESS_PHRASE.OPERAND_AUTH",
  1: "ACCESS_PHRASE.OPERAND_RECORD",
};

/** An operand with its origin ("the record's OwnerId"); an unknown source is the bare name. */
const operandPhrase = (phrases: Record<number, string>, source: number, name: string): string => {
  const key = phrases[source];
  return (key ? gt(key, { name }) : name).trim();
};

const quoteList = (value: string | string[] | null | undefined): string => {
  if (Array.isArray(value)) {
    return value
      .map((v) => gt("ACCESS_PHRASE.QUOTED", { value: v }))
      .join(gt("ACCESS_PHRASE.OR_JOIN"));
  }
  return gt("ACCESS_PHRASE.QUOTED", { value: value ?? "" });
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
  const left = operandPhrase(LEFT_SOURCE_PHRASES, rule.leftSource, rule.leftOperand);
  const operator =
    READABLE_OPERATORS[rule.operator] ??
    gt("ACCESS_PHRASE.UNKNOWN_OPERATOR", { operator: rule.operator });

  if (NULL_OPERATORS.includes(NUMBER_TO_OPERATOR[rule.operator] ?? "")) {
    return `${left} ${operator}`;
  }

  if (rule.rightSource === 2) {
    return `${left} ${operator} ${quoteList(rule.staticValue)}`;
  }

  const rightOperand = rule.rightOperands?.length
    ? rule.rightOperands.join(", ")
    : rule.rightOperand;
  const rightPhrase = operandPhrase(RIGHT_SOURCE_PHRASES, rule.rightSource, rightOperand);
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
    const joiner =
      group.logicalOperator === LOGICAL_OPERATOR.AND
        ? gt("ACCESS_PHRASE.JOIN_AND")
        : gt("ACCESS_PHRASE.JOIN_OR");
    const items = [
      ...(group.rules ?? []).map((rule) => ({ rule })),
      ...(group.nestedGroups ?? []).map((nested) => ({ nested })),
    ];
    return items.flatMap((item, index): RuleSetLine[] => {
      const id = `${prefix}${index}`;
      let lead = joiner;
      if (index === 0) lead = depth === 0 ? gt("ACCESS_PHRASE.LEAD_WHEN") : "";
      if ("rule" in item) {
        return [{ id, lead, text: rulePhrase(item.rule), depth, kind: "rule" }];
      }
      const matchesAll = item.nested.logicalOperator === LOGICAL_OPERATOR.AND;
      return [
        {
          id,
          lead,
          text: matchesAll ? gt("ACCESS_PHRASE.GROUP_ALL_OF") : gt("ACCESS_PHRASE.GROUP_ANY_OF"),
          depth,
          kind: "group",
        },
        ...walk(item.nested, depth + 1, `${id}.`),
      ];
    });
  };
  return walk(policy.ruleGroup, 0, "");
}

const listNames = (policies: IPolicyItem[]) => {
  const names = policies.map((p) => p.policyName).filter(Boolean);
  if (names.length <= 1) return names.join("");
  return gt("ACCESS_PHRASE.NAMES_LIST_OR", {
    head: names.slice(0, -1).join(", "),
    last: names.at(-1) ?? "",
  });
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
  const operationTab = asOperationTab(tab);

  if (tier === "public") {
    return {
      heading: gt("ACCESS_PHRASE.HEADING_PUBLIC"),
      text: gt(PUBLIC_TEXT[operationTab], { subject }),
      risk: "open",
    };
  }

  if (tier === "user") {
    return {
      heading: gt("ACCESS_PHRASE.HEADING_REQUESTER"),
      text: gt(REQUESTER_TEXT[operationTab], { subject }),
      risk: "caution",
    };
  }

  if (tier === "inherited") {
    return {
      heading: gt("ACCESS_PHRASE.HEADING_INHERITED"),
      text: gt(INHERITED_TEXT[operationTab]),
      risk: "inherited",
    };
  }

  if (policies.some((policy) => policy.isAllowPolicy === false)) {
    return {
      heading: gt("ACCESS_PHRASE.HEADING_UNKNOWN"),
      text: gt("ACCESS_PHRASE.DENY_RULE_SET"),
      risk: "unknown",
    };
  }

  // The trap: custom with nothing in it looks configured and grants nothing.
  if (policies.length === 0) {
    return {
      heading: gt("ACCESS_PHRASE.HEADING_NOBODY"),
      text: gt(NOBODY_TEXT[operationTab], { subject }),
      risk: "none",
    };
  }

  const names = listNames(policies);
  return {
    heading: gt("ACCESS_PHRASE.HEADING_EFFECT"),
    text:
      policies.length === 1
        ? gt(ONE_RULE_SET_TEXT[operationTab], { subject, names })
        : gt(MANY_RULE_SETS_TEXT[operationTab], { subject, names, count: policies.length }),
    risk: "scoped",
  };
}
