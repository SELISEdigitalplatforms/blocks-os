// export interface ILog {
//   Timestamp: string;
//   TenantId: string;
//   ServiceName: string;
//   _id: string;
//   Level: string;
//   SpanId: string;
//   EnvironmentName: string;
//   Exception: string;
//   SourceContext: string;
//   Message: string;
//   MessageTemplate: string;
//   TraceId: string;
//   ParentSpanId: string;
//   Recipients?: string;
// }

export interface ILog {
  timestamp: string;
  level: string;
  message: string;
  traceId: string;
  serviceName?: string;
  // Returned by every log endpoint, but only ever used as part of a row's identity.
  spanId?: string;
  // The full ex.ToString() -- message, frames and inner exceptions. Absent on logs that
  // carried no exception, and deliberately omitted from the live tail response.
  exception?: string;
}

export interface IGetLogsPayload {
  page: number;
  pageSize: number;
  sort?: {
    property?: string;
    isDescending: boolean;
  };
  filter?: {
    startDate?: string;
    endDate?: string;
    level?: string;
    traceId?: string;
    spanId?: string;
  };
  search?: string;
  serviceName: string;
  serviceNames?: string[];
  projectKey: string;
}

export interface IGetRestoredLogsPayload extends IGetLogsPayload {
  requestId: string;
}

export interface IGetLiveLogsPayload {
  serviceName: string;
  serviceNames?: string[];
  lastDate: string;
  projectKey: string;
}

export interface IGetLogsByDatePayload {
  page?: number;
  pageSize: number;
  sort?: {
    property?: string;
    isDescending: boolean;
  };
  filter?: {
    startDate?: string;
    endDate?: string;
    level?: string;
    traceId?: string;
    spanId?: string;
  };
  search?: string;
  serviceName: string;
  serviceNames?: string[];
}

export interface IBlocksServiceItem {
  key: string;
  label: string;
  sortOrder: number;
  apiServiceName: string;
  workerServiceNames: string[];
}
