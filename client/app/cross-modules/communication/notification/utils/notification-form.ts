import type {
  INotificationAudience,
  INotificationConfigBuiltInFields,
  INotificationConfigRow,
  INotificationSubscriptionFilter,
  ISaveNotificationConfigPayload,
} from "../models/notification-config.model";
import {
  AUDIENCE_LEVEL,
  AUDIENCE_MATCH,
  LIMITS,
  NOTIFICATION_SCOPE,
  NOTIFICATION_TEXT,
} from "../constants/notification-ui.constant";

export interface NotificationFormValues {
  name: string;
  description: string;
  isEnabled: boolean;
  isBuiltIn: boolean;
  sendProject: boolean;
  sendConsole: boolean;
  level: number;
  match: number;
  userIds: string[];
  roles: string[];
  permissions: string[];
  filters: INotificationSubscriptionFilter[];
  alsoNamedUsers: boolean;
  liveEnabled: boolean;
  pushEnabled: boolean;
  enablePersistence: boolean;
  /** Kept as typed text so the user can clear the box; parsed on validate and save. */
  rateLimit: string;
  titleKey: string;
  bodyKey: string;
  link: string;
  importance: number;
  kind: number;
  sourceService: string;
  consumerAppRecommendation: string;
  consumerAppNote: string;
}

export const EMPTY_FORM_VALUES: NotificationFormValues = {
  name: "",
  description: "",
  isEnabled: true,
  isBuiltIn: false,
  sendProject: true,
  sendConsole: false,
  level: AUDIENCE_LEVEL.AffectedOnly,
  match: AUDIENCE_MATCH.Any,
  userIds: [],
  roles: [],
  permissions: [],
  filters: [],
  alsoNamedUsers: false,
  liveEnabled: true,
  pushEnabled: false,
  enablePersistence: false,
  rateLimit: String(LIMITS.rateDefault),
  titleKey: "",
  bodyKey: "",
  link: "",
  importance: 0,
  kind: 0,
  sourceService: "",
  consumerAppRecommendation: "",
  consumerAppNote: "",
};

const scopeToSides = (scope: number | undefined) => ({
  sendProject: scope !== NOTIFICATION_SCOPE.Console,
  sendConsole: scope === NOTIFICATION_SCOPE.Console || scope === NOTIFICATION_SCOPE.Both,
});

export const sidesToScope = (sendProject: boolean, sendConsole: boolean): number => {
  if (sendProject && sendConsole) return NOTIFICATION_SCOPE.Both;
  return sendConsole ? NOTIFICATION_SCOPE.Console : NOTIFICATION_SCOPE.Project;
};

/** The audience the server applies: the tenant's own, else the built-in default, else "affected users". */
export const effectiveAudience = (row?: INotificationConfigRow): INotificationAudience | null =>
  (row?.audienceLocked ? null : row?.audience) ?? row?.defaultAudience ?? null;

const rateToText = (rate: number | undefined) => String(rate || LIMITS.rateDefault);

/** Rows from older servers lack the new fields: they read as in-app on, push off, project users. */
export const toFormValues = (row?: INotificationConfigRow): NotificationFormValues => {
  if (!row) return EMPTY_FORM_VALUES;
  const audience = effectiveAudience(row);
  return {
    name: row.name,
    description: row.description ?? "",
    isEnabled: !(row.isDisabled ?? false),
    isBuiltIn: row.isBuiltIn ?? false,
    ...scopeToSides(row.scope),
    level: audience?.level ?? AUDIENCE_LEVEL.AffectedOnly,
    match: audience?.match ?? AUDIENCE_MATCH.Any,
    userIds: audience?.userIds ?? [],
    roles: audience?.roles ?? [],
    permissions: audience?.permissions ?? [],
    filters: audience?.filters ?? [],
    alsoNamedUsers: audience?.alsoNamedUsers ?? false,
    liveEnabled: row.liveEnabled ?? true,
    pushEnabled: row.pushEnabled ?? false,
    enablePersistence: row.enablePersistence ?? false,
    rateLimit: rateToText(row.rateLimitPerMinute),
    titleKey: row.pushTemplate?.titleKey ?? "",
    bodyKey: row.pushTemplate?.bodyKey ?? "",
    link: row.pushTemplate?.link ?? "",
    importance: row.importance ?? 0,
    kind: row.kind ?? 0,
    sourceService: row.sourceService ?? "",
    consumerAppRecommendation: row.consumerAppRecommendation ?? "",
    consumerAppNote: row.consumerAppNote ?? "",
  };
};

const parseRate = (text: string): number | null => {
  if (!/^\d{1,4}$/.test(text.trim())) return null;
  const rate = Number(text);
  return rate <= LIMITS.rateMax ? rate : null;
};

const isBlankFilter = (f: INotificationSubscriptionFilter) =>
  !f.context.trim() && !f.actionName.trim() && !f.value.trim();

const tooLong = (items: string[]) => items.some((item) => item.length > LIMITS.textLength);

const filtersError = (filters: INotificationSubscriptionFilter[]): string | null => {
  const used = filters.filter((f) => !isBlankFilter(f));
  const invalid =
    used.length > LIMITS.filters ||
    used.some(
      (f) => !f.context.trim() || tooLong([f.context, f.actionName, f.value]),
    );
  return invalid ? NOTIFICATION_TEXT.errors.filters : null;
};

const selectedErrors = (v: NotificationFormValues): string[] => {
  if (v.level !== AUDIENCE_LEVEL.Selected) return [];
  const errors: string[] = [];
  const tooMany =
    v.userIds.length > LIMITS.userIds ||
    v.roles.length > LIMITS.roles ||
    v.permissions.length > LIMITS.permissions;
  if (tooMany) errors.push(NOTIFICATION_TEXT.errors.limits);
  const filterError = filtersError(v.filters);
  if (filterError) errors.push(filterError);
  return errors;
};

export interface ValidationContext {
  /** Personal notices: the receivers and push text are fixed, so they are not checked. */
  locked: boolean;
  isEdit: boolean;
}

/** One message per broken rule; the page shows them in the footer and keeps Save off. */
export const validateNotificationForm = (
  v: NotificationFormValues,
  { locked, isEdit }: ValidationContext,
): string[] => {
  const errors: string[] = [];
  const name = v.name.trim();
  if (!isEdit && (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax)) {
    errors.push(NOTIFICATION_TEXT.errors.name);
  }
  if (!locked && !v.sendProject && !v.sendConsole) errors.push(NOTIFICATION_TEXT.errors.sendTo);
  if (!v.liveEnabled && !v.pushEnabled) errors.push(NOTIFICATION_TEXT.errors.channel);
  if (!locked && v.pushEnabled && (!v.titleKey || !v.bodyKey)) {
    errors.push(NOTIFICATION_TEXT.errors.pushKeys);
  }
  if (!locked && v.link.length > LIMITS.textLength) errors.push(NOTIFICATION_TEXT.errors.link);
  if (parseRate(v.rateLimit) === null) errors.push(NOTIFICATION_TEXT.errors.rate);
  if (!locked) errors.push(...selectedErrors(v));
  return errors;
};

const TEXT_FIELDS = [
  "description",
  "sourceService",
  "consumerAppRecommendation",
  "consumerAppNote",
] as const;
const NUMBER_FIELDS = ["importance", "kind"] as const;

/**
 * Builds only the metadata fields the request needs: on update those that changed, on create those
 * the user filled. When nothing applies the payload keeps its old shape.
 */
export const buildBuiltInPayload = (
  data: NotificationFormValues,
  previous: INotificationConfigRow | undefined,
  isEdit: boolean,
) => {
  const before = toFormValues(isEdit ? previous : undefined);
  const out: Partial<INotificationConfigBuiltInFields> = {};
  for (const key of TEXT_FIELDS) {
    const value = data[key].trim();
    if (value !== before[key].trim()) out[key] = value || null;
  }
  for (const key of NUMBER_FIELDS) {
    if (data[key] !== before[key]) out[key] = data[key];
  }
  if (data.isBuiltIn !== before.isBuiltIn) out.isBuiltIn = data.isBuiltIn;
  if (data.isEnabled !== before.isEnabled) out.isDisabled = !data.isEnabled;
  return out;
};

const cleanList = (items: string[]) => [...new Set(items.map((i) => i.trim()).filter(Boolean))];

/** Only the Selected level carries rules; the other levels send them empty so nothing stale stays. */
export const buildAudience = (v: NotificationFormValues): INotificationAudience => {
  const selected = v.level === AUDIENCE_LEVEL.Selected;
  return {
    level: v.level,
    match: selected ? v.match : AUDIENCE_MATCH.Any,
    userIds: selected ? cleanList(v.userIds) : [],
    roles: selected ? cleanList(v.roles) : [],
    permissions: selected ? cleanList(v.permissions) : [],
    filters: selected
      ? v.filters
          .filter((f) => !isBlankFilter(f))
          .map((f) => ({
            context: f.context.trim(),
            actionName: f.actionName.trim(),
            value: f.value.trim(),
          }))
      : [],
    alsoNamedUsers: selected && v.alsoNamedUsers,
  };
};

/**
 * Personal notices (locked): the server refuses a new audience, scope or push text, so none is sent.
 * The legacy fields stay as the row has them; the server maps them to the new channel fields.
 */
export const buildSavePayload = (
  v: NotificationFormValues,
  previous: INotificationConfigRow | undefined,
  isEdit: boolean,
  projectKey: string,
): ISaveNotificationConfigPayload => {
  const locked = isEdit && !!previous?.audienceLocked;
  const name = v.name.trim();
  const base: ISaveNotificationConfigPayload = {
    name,
    projectKey,
    itemId: isEdit ? previous?.itemId : undefined,
    channelToNotify: previous?.channelToNotify ?? 0,
    notificationType: previous?.notificationType ?? 0,
    notifyMethod: previous?.notifyMethod || name,
    enablePersistence: v.enablePersistence,
    liveEnabled: v.liveEnabled,
    pushEnabled: v.pushEnabled,
    rateLimitPerMinute: parseRate(v.rateLimit) ?? LIMITS.rateDefault,
    ...buildBuiltInPayload(v, previous, isEdit),
  };
  if (locked) return base;
  return {
    ...base,
    scope: sidesToScope(v.sendProject, v.sendConsole),
    audience: buildAudience(v),
    // Keys stay saved while push is off, so turning it on again needs no re-pick.
    pushTemplate:
      v.titleKey || v.bodyKey
        ? { titleKey: v.titleKey, bodyKey: v.bodyKey, link: v.link.trim() }
        : null,
  };
};
