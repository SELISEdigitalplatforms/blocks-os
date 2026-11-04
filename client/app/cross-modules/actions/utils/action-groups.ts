import type { IAction } from "../models/actions.model";

export interface IActionGroup {
  /** `iam.user`, `iam.organization`, or the service name for everything else. */
  id: string;
  actions: IAction[];
}

const IAM_SERVICE = "IAM";
const IAM_PREFIXES = ["iam.user", "iam.organization"] as const;

/** IAM is split by what the action is about; every other service is one group. */
export const getActionGroupId = (action: IAction): string => {
  if (action.service.toUpperCase() !== IAM_SERVICE) return action.service;
  return IAM_PREFIXES.find((prefix) => action.name.startsWith(`${prefix}.`)) ?? action.service;
};

/** Groups keep the order the server sent them in. */
export const groupActions = (actions: IAction[]): IActionGroup[] => {
  const groups = new Map<string, IAction[]>();
  for (const action of actions) {
    const id = getActionGroupId(action);
    groups.set(id, [...(groups.get(id) ?? []), action]);
  }
  return [...groups].map(([id, list]) => ({ id, actions: list }));
};

const EXAMPLE_TIME = "2026-01-01T09:00:00Z";

const exampleForScalar = (field: string, type: string): unknown => {
  switch (type.toLowerCase()) {
    case "bool":
    case "boolean":
      return true;
    case "int":
    case "long":
    case "number":
    case "double":
      return 1;
    case "datetime":
    case "date":
      return EXAMPLE_TIME;
    default:
      return field.endsWith("Id") ? `${field.slice(0, -2) || "id"}_123` : "example";
  }
};

/** Example value for one payload field, by its type name (`string[]` gives a one-item list). */
export const exampleValue = (field: string, type: string): unknown =>
  type.endsWith("[]")
    ? [exampleForScalar(field, type.slice(0, -2))]
    : exampleForScalar(field, type);

/** The JSON every target (workflow, function, webhook) receives for this action. */
export const buildPayloadExample = (action: IAction): string => {
  const data = Object.fromEntries(
    Object.entries(action.payload).map(([field, type]) => [field, exampleValue(field, type)]),
  );
  const isLocalization = action.service.toLowerCase() === "localization";
  return JSON.stringify(
    {
      id: "evt_01JC9Z3K7Q",
      action: action.name,
      time: EXAMPLE_TIME,
      organizationId: isLocalization ? null : "org_41c",
      data,
    },
    null,
    2,
  );
};
