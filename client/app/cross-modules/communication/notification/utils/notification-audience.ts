import {
  AUDIENCE_MODE_EVERYONE,
  AUDIENCE_MODE_RULES,
  AUDIENCE_MODE_SENDER,
} from "../constants/notification.constant";
import type {
  INotificationAudience,
  INotificationAudienceFilter,
} from "../models/notification-config.model";

export type AudienceMode =
  typeof AUDIENCE_MODE_SENDER | typeof AUDIENCE_MODE_EVERYONE | typeof AUDIENCE_MODE_RULES;

/** The audience part of the modal form. */
export interface IAudienceFormValues {
  audienceMode: AudienceMode;
  audienceMatch: number;
  audienceUserIds: string[];
  audienceOrganizationIds: string[];
  audienceRoles: string[];
  audiencePermissions: string[];
  audienceFilters: INotificationAudienceFilter[];
}

export const emptyAudienceForm: IAudienceFormValues = {
  audienceMode: AUDIENCE_MODE_SENDER,
  audienceMatch: 0,
  audienceUserIds: [],
  audienceOrganizationIds: [],
  audienceRoles: [],
  audiencePermissions: [],
  audienceFilters: [],
};

const ruleCount = (audience?: INotificationAudience | null): number =>
  (audience?.userIds?.length ?? 0) +
  (audience?.organizationIds?.length ?? 0) +
  (audience?.roles?.length ?? 0) +
  (audience?.permissions?.length ?? 0) +
  (audience?.filters?.length ?? 0);

/** Rows from older servers have no audience: the sender decides. */
export const audienceToFormValues = (
  audience?: INotificationAudience | null,
): IAudienceFormValues => {
  if (!audience) return emptyAudienceForm;
  let audienceMode: AudienceMode = AUDIENCE_MODE_SENDER;
  if (audience.everyoneInTenant) audienceMode = AUDIENCE_MODE_EVERYONE;
  else if (ruleCount(audience) > 0) audienceMode = AUDIENCE_MODE_RULES;
  return {
    audienceMode,
    audienceMatch: audience.match ?? 0,
    audienceUserIds: audience.userIds ?? [],
    audienceOrganizationIds: audience.organizationIds ?? [],
    audienceRoles: audience.roles ?? [],
    audiencePermissions: audience.permissions ?? [],
    audienceFilters: audience.filters ?? [],
  };
};

const trimmed = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

/**
 * The audience the server stores for these form values. "Sender decides" is an empty audience,
 * which the server stores as no audience. Lists are always sent: the server rejects a null list.
 */
export const formValuesToAudience = (values: IAudienceFormValues): INotificationAudience => {
  const everyone = values.audienceMode === AUDIENCE_MODE_EVERYONE;
  const rules = values.audienceMode === AUDIENCE_MODE_RULES;
  return {
    everyoneInTenant: everyone,
    match: rules ? values.audienceMatch : 0,
    userIds: rules ? trimmed(values.audienceUserIds) : [],
    organizationIds: rules ? trimmed(values.audienceOrganizationIds) : [],
    roles: rules ? trimmed(values.audienceRoles) : [],
    permissions: rules ? trimmed(values.audiencePermissions) : [],
    filters: rules
      ? values.audienceFilters.map((filter) => ({
          context: filter.context.trim(),
          actionName: filter.actionName.trim(),
          value: filter.value.trim(),
        }))
      : [],
  };
};

/** The audience to send, or undefined when it did not change (the server then keeps the stored one). */
export const buildAudiencePayload = (
  data: IAudienceFormValues,
  before: IAudienceFormValues,
): INotificationAudience | undefined => {
  const next = formValuesToAudience(data);
  return JSON.stringify(next) === JSON.stringify(formValuesToAudience(before)) ? undefined : next;
};

/** Text for the list: who receives the notification. */
export const audienceSummary = (audience?: INotificationAudience | null): string => {
  if (audience?.everyoneInTenant) return "Everyone";
  const count = ruleCount(audience);
  return count > 0 ? `Rules (${count})` : "Code decides";
};
