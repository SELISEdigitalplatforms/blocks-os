import { http } from "@/lib/http/http-client";
import { SECURITY_ENDPOINTS } from "../constants/security-endpoints";
import type {
  IActivityPageResponseApi,
  IGetActivitiesPayload,
  IGeneratePATPayload,
  IPATApi,
  IRevokeSessionResponseApi,
  ISecuritySummaryApi,
  ISessionDetailsApi,
  IUserSessionApi,
} from "../api";

const appendUid = (url: string, uid?: string) =>
  uid ? `${url}${url.includes("?") ? "&" : "?"}uid=${encodeURIComponent(uid)}` : url;

export class SecurityService {
  getSummary(uid?: string): Promise<ISecuritySummaryApi> {
    return http.get<ISecuritySummaryApi>(appendUid(SECURITY_ENDPOINTS.SUMMARY, uid), undefined, {
      absoluteUrl: true,
    });
  }

  getSessions(uid?: string): Promise<IUserSessionApi[]> {
    return http.get<IUserSessionApi[]>(appendUid(SECURITY_ENDPOINTS.SESSIONS, uid), undefined, {
      absoluteUrl: true,
    });
  }

  getSessionDetails(sessionId: string, uid?: string): Promise<ISessionDetailsApi> {
    return http.get<ISessionDetailsApi>(
      appendUid(
        SECURITY_ENDPOINTS.SESSION_DETAILS.replace("{sessionId}", encodeURIComponent(sessionId)),
        uid,
      ),
      undefined,
      { absoluteUrl: true },
    );
  }

  revokeSession(
    sessionId: string,
    reason?: string,
    userId?: string,
  ): Promise<IRevokeSessionResponseApi> {
    return http.post<IRevokeSessionResponseApi>(
      SECURITY_ENDPOINTS.REVOKE_SESSION.replace("{sessionId}", encodeURIComponent(sessionId)),
      { ...(reason ? { reason } : {}), ...(userId ? { userId } : {}) },
      undefined,
      { absoluteUrl: true },
    );
  }

  revokeRefreshToken(
    tokenId: string,
    reason?: string,
    userId?: string,
  ): Promise<IRevokeSessionResponseApi> {
    return http.post<IRevokeSessionResponseApi>(
      SECURITY_ENDPOINTS.REVOKE_REFRESH_TOKEN.replace("{tokenId}", encodeURIComponent(tokenId)),
      { ...(reason ? { reason } : {}), ...(userId ? { userId } : {}) },
      undefined,
      { absoluteUrl: true },
    );
  }

  getActivities(payload: IGetActivitiesPayload): Promise<IActivityPageResponseApi> {
    return http.post<IActivityPageResponseApi>(
      SECURITY_ENDPOINTS.ACTIVITY,
      {
        ...(payload.userId ? { userId: payload.userId } : {}),
        ...(payload.page !== undefined ? { page: payload.page } : {}),
        ...(payload.pageSize !== undefined ? { pageSize: payload.pageSize } : {}),
        ...(payload.filter ? { filter: payload.filter } : {}),
      },
      undefined,
      { absoluteUrl: true },
    );
  }

  getPats(): Promise<IPATApi[]> {
    return http.get(SECURITY_ENDPOINTS.GET_USER_CODES, undefined, { absoluteUrl: true });
  }

  generatePats(payload: IGeneratePATPayload): Promise<IPATApi[]> {
    return http.post(SECURITY_ENDPOINTS.GENERATE_USER_CODE, payload, undefined, {
      absoluteUrl: true,
    });
  }
}

export const securityService = new SecurityService();
