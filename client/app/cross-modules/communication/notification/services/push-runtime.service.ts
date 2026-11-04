import { http } from "@/lib/http/http-client";
import { PUSH_RUNTIME_ENDPOINTS } from "../constants/endpoint.constant";
import type {
  IPushDevicesPage,
  IPushDevicesQuery,
  IPushNotificationTestRequest,
  IPushStatus,
  IPushTestRequest,
  IPushTestResult,
} from "../models/push.model";

const ABSOLUTE = { absoluteUrl: true } as const;

const EMPTY_STATUS = { devices: 0, lastTest: null } as const;

/** A platform the logic service leaves out reads as no devices and no test. */
const toStatus = (status: Partial<IPushStatus> | undefined): IPushStatus => ({
  android: status?.android ?? EMPTY_STATUS,
  ios: status?.ios ?? EMPTY_STATUS,
  web: status?.web ?? EMPTY_STATUS,
});

const devicesQuery = (query: IPushDevicesQuery): string => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.platform) params.set("platform", query.platform);
  if (query.search?.trim()) params.set("search", query.search.trim());
  return params.toString();
};

/** The runtime part of push: last test and counts, test sends and the device list. Served by logic. */
export class PushRuntimeService {
  getStatus(): Promise<IPushStatus> {
    return http
      .get<Partial<IPushStatus>>(PUSH_RUNTIME_ENDPOINTS.STATUS(), undefined, ABSOLUTE)
      .then(toStatus);
  }

  sendTest(request: IPushTestRequest): Promise<IPushTestResult> {
    return http.post<IPushTestResult>(PUSH_RUNTIME_ENDPOINTS.TEST(), request, undefined, ABSOLUTE);
  }

  sendNotificationTest(request: IPushNotificationTestRequest): Promise<IPushTestResult> {
    return http.post<IPushTestResult>(
      PUSH_RUNTIME_ENDPOINTS.TEST_NOTIFICATION(),
      request,
      undefined,
      ABSOLUTE,
    );
  }

  getDevices(query: IPushDevicesQuery): Promise<IPushDevicesPage> {
    return http.get<IPushDevicesPage>(
      PUSH_RUNTIME_ENDPOINTS.DEVICES(devicesQuery(query)),
      undefined,
      ABSOLUTE,
    );
  }

  removeDevice(id: string): Promise<void> {
    return http
      .delete<unknown>(PUSH_RUNTIME_ENDPOINTS.DEVICE(id), undefined, ABSOLUTE)
      .then(() => undefined);
  }
}

export const pushRuntimeService = new PushRuntimeService();
