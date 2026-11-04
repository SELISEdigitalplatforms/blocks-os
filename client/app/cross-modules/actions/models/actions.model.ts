export const ACTION_TARGETS = ["workflow", "function", "webhook"] as const;

export type ActionTarget = (typeof ACTION_TARGETS)[number];

/** One action as the Actions page shows it. `payload` maps each data field to its type name. */
export interface IAction {
  name: string;
  label: string;
  service: string;
  payload: Record<string, string>;
  workflow: boolean;
  function: boolean;
  webhook: boolean;
}

export interface IUpdateActionPayload {
  name: string;
  target: ActionTarget;
  enabled: boolean;
}
