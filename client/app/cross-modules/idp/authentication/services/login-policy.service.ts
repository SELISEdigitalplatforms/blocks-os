import { http } from "@/lib/http/http-client";
import { API_BASES } from "@/constants/endpoint.constant";
import type {
  IGetTenantLoginPolicyResponse,
  ISaveTenantLoginPolicyResponse,
  ITenantLoginPolicy,
} from "@blocks-idp/authentication/models/login-policy.model";

const LOGIN_POLICY_ENDPOINT = `${API_BASES.IAM}/iam/login-policy`;

export class LoginPolicyService {
  getTenantPolicy(): Promise<IGetTenantLoginPolicyResponse> {
    return http.get(LOGIN_POLICY_ENDPOINT, undefined, { absoluteUrl: true });
  }

  saveTenantPolicy(policy: ITenantLoginPolicy): Promise<ISaveTenantLoginPolicyResponse> {
    return http.post(LOGIN_POLICY_ENDPOINT, policy, undefined, { absoluteUrl: true });
  }
}

export const loginPolicyService = new LoginPolicyService();
