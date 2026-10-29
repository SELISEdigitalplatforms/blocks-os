/**
 * Project access grants — what an owner has given a contributor inside one project group.
 *
 * Three layers exist and only the third lives here:
 *  1. tenant RBAC        — token roles vs `blocks-os::area::action` resource names
 *  2. membership         — a ProjectPeoples row per (person, environment)
 *  3. project access     — this. `menu::action` grants, owner-granted, group-wide.
 *
 * `menuId` matches the ids in `constants/navigation-menus.ts`, so a grant maps straight onto a
 * sidebar entry with no translation table in between.
 */

/** Roles inside one project group. Derived server-side from ProjectPeoples, never stored. */
export type ProjectRole = "owner" | "contributor";

/** One menu and the actions granted inside it. */
export interface IMenuGrant {
  menuId: string;
  actions: string[];
}

export interface IGetMyAccessResponse {
  role: ProjectRole;
  isOwner: boolean;
  /** Only menus with at least one granted action. Owners get the whole catalog. */
  menus: IMenuGrant[];
  /**
   * Environments this person belongs to. Project menus govern the project pages only; the
   * environments stay reachable either way. Returned so "no menus" is never shown as
   * "no access at all".
   */
  environments: string[];
  isSuccess: boolean;
  errors: unknown | null;
}

export interface ISaveAccessPolicyPayload {
  projectGroupId: string;
  userId: string;
  accessPolicies: string[];
}

export interface ISaveAccessPolicyResponse {
  accessPolicies: string[];
  isSuccess: boolean;
  errors: unknown | null;
}

/** Composes a grant string. Two segments, deliberately unlike the three-segment RBAC names. */
export const toPolicy = (menuId: string, action: string) => `${menuId}::${action}`;

/** The read action. Implied by holding any other action on the same menu. */
export const VIEW_ACTION = "view";
