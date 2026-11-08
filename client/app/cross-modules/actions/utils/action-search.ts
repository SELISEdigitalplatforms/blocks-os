import type { IAction } from "../models/actions.model";
import type { IActionGroup } from "./action-groups";

const includesText = (value: string, needle: string): boolean =>
  value.toLowerCase().includes(needle);

/** True when the text is empty or is part of the action's name, label, service or a payload field name. */
export const actionMatchesSearch = (action: IAction, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [action.name, action.label, action.service, ...Object.keys(action.payload)].some((text) =>
    includesText(text, needle),
  );
};

/** Keeps the matching actions in each group and drops groups left empty. */
export const filterActionGroups = (groups: IActionGroup[], search: string): IActionGroup[] =>
  groups
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) => actionMatchesSearch(action, search)),
    }))
    .filter((group) => group.actions.length > 0);
