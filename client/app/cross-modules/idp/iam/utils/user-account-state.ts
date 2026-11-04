import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.idp.iam";

/**
 * An account's lifecycle state, as IAM derives it (`UserAccountStates` in blocks-iam) and reports
 * it on each user as `accountState`. Neither `active` nor `status` is the state on its own -- an
 * invited user is inactive with `status` already Active -- so the UI reads this field rather than
 * re-deriving it.
 */
export type UserAccountState = "Active" | "PendingVerification" | "Suspended" | "Deactivated";

/** Filter value for a lockout still in force. Not a lifecycle state: it sits on top of one. */
export const LOCKED_OUT_FILTER = "LockedOut";

type BadgeVariant = "success" | "warning" | "error" | "secondary";

// `label` is a getter so it is translated when it is read (at render), not when this file loads.
export const USER_ACCOUNT_STATE_META: Record<
  UserAccountState,
  { label: string; variant: BadgeVariant }
> = {
  Active: {
    get label() {
      return tStatic(I18N_MODULE, "USER_ACCOUNT_STATE.ACTIVE");
    },
    variant: "success",
  },
  // Labelled "Inactive", as the column read before account states existed; it is the
  // never-activated account, distinct from one an admin turned off (Deactivated).
  PendingVerification: {
    get label() {
      return tStatic(I18N_MODULE, "USER_ACCOUNT_STATE.INACTIVE");
    },
    variant: "error",
  },
  Suspended: {
    get label() {
      return tStatic(I18N_MODULE, "USER_ACCOUNT_STATE.SUSPENDED");
    },
    variant: "warning",
  },
  Deactivated: {
    get label() {
      return tStatic(I18N_MODULE, "USER_ACCOUNT_STATE.DEACTIVATED");
    },
    variant: "secondary",
  },
};

/** The Status filter's options: the four lifecycle states, then Locked out. */
export const USER_ACCOUNT_STATE_FILTER_OPTIONS = [
  ...(Object.keys(USER_ACCOUNT_STATE_META) as UserAccountState[]).map((state) => ({
    get label() {
      return USER_ACCOUNT_STATE_META[state].label;
    },
    value: state as string,
  })),
  {
    get label() {
      return tStatic(I18N_MODULE, "USER_ACCOUNT_STATE.LOCKED_OUT");
    },
    value: LOCKED_OUT_FILTER,
  },
];

/** The recognised values of a Status selection read from the URL, deduplicated, in option order. */
export const toAccountStatesFilter = (values: readonly string[] | null | undefined): string[] =>
  USER_ACCOUNT_STATE_FILTER_OPTIONS.map((option) => option.value).filter((value) =>
    (values ?? []).includes(value),
  );

/**
 * The state to show for a user. A record without `accountState` (an IAM build that predates the
 * field) falls back to IAM's own rule for an Active or missing `status`: active is Active, and an
 * inactive account is Deactivated if it was ever verified, PendingVerification if not.
 */
export const resolveUserAccountState = (user: {
  accountState?: string | null;
  active: boolean;
  isVerified?: boolean;
}): UserAccountState => {
  if (user.accountState && Object.hasOwn(USER_ACCOUNT_STATE_META, user.accountState)) {
    return user.accountState as UserAccountState;
  }
  if (user.active) return "Active";
  return user.isVerified ? "Deactivated" : "PendingVerification";
};
