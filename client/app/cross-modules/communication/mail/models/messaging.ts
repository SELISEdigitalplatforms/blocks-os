export interface IMessagingServiceData {
  id?: number | string;
  name: string;
  configuration: string;
  protocol: string;
  lastModified: Date;
  createdOn: Date;
  createdBy: string;
}
