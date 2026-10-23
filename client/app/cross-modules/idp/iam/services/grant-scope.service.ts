import { http } from "@/lib/http/http-client";
import { IGrantScope } from "@blocks-idp/iam/models/grant-scope";
import { GRANT_ENDPOINTS } from "../constants/endpoint.constant";

export class GrantScopeService {
  getScope(): Promise<IGrantScope> {
    return http.get<IGrantScope>(GRANT_ENDPOINTS.SCOPE, undefined, {
      absoluteUrl: true,
    });
  }
}

export const grantScopeService = new GrantScopeService();
