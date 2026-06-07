export interface INotification {
  id: string;
  correlationId: string;
  payload: {
    UserId: string;
    subscriptionFilters: NotificationSubScriptionFilter[];
    notificationType: string;
    responseKey: string;
    responseValue: string;
  };
  denormalizedPayload: string;
  createdTime: string;
  isRead: boolean;
  ReadByRoles: string[] | null;
}

export interface IDenormalizedPayload {
  title: string;
  description: string;
  redirectPath: string;
  toastable: boolean;
  meta:
    | {
        kb_id?: string;
        status?: string;
      }
    | string;
}

export type { INotificationConfigRow as INotificationConfig } from "./notification-config.model";

export interface NotificationSubScriptionFilter {
  context: string;
  actionName: string;
  value: string;
}
