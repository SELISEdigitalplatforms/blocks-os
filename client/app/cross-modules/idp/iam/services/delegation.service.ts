import { http } from "@/lib/http/http-client";
import { IDelegationScope } from "@blocks-idp/iam/models/delegation-scope";
import { DELEGATION_ENDPOINTS } from "../constants/endpoint.constant";

export class DelegationService {
  getScope(): Promise<IDelegationScope> {
    return http.get<IDelegationScope>(DELEGATION_ENDPOINTS.SCOPE, undefined, {
      absoluteUrl: true,
    });
  }
}

export const delegationService = new DelegationService();
