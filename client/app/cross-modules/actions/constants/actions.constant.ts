export const ACTIONS_I18N_MODULE = "os.actions";

/** Error codes `Actions/Update` returns in `errors.code`. */
export const ACTION_ERROR_CODES = {
  NotFound: "ACTION_NOT_FOUND",
  NotSeeded: "ACTIONS_NOT_SEEDED",
  InvalidTarget: "INVALID_TARGET",
} as const;
