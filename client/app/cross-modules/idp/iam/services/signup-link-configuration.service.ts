import { http } from "@/lib/http/http-client";
import { SIGNUP_LINK_CONFIGURATION_ENDPOINTS } from "../constants/endpoint.constant";
import {
  ISignupLinkConfiguration,
  ISignupLinkConfigurationCreatePayload,
  ISignupLinkConfigurationMutationResponse,
  ISignupLinkConfigurationQueryPayload,
  ISignupLinkConfigurationQueryResponse,
  ISignupLinkConfigurationUpdatePayload,
} from "../models/signup-link-configuration";

export class SignupLinkConfigurationService {
  query(
    payload: ISignupLinkConfigurationQueryPayload,
  ): Promise<ISignupLinkConfigurationQueryResponse> {
    return http.post(SIGNUP_LINK_CONFIGURATION_ENDPOINTS.QUERY, payload, undefined, {
      absoluteUrl: true,
    });
  }

  getById(id: string): Promise<ISignupLinkConfiguration> {
    return http.get(`${SIGNUP_LINK_CONFIGURATION_ENDPOINTS.BASE}/${id}`, undefined, {
      absoluteUrl: true,
    });
  }

  create(
    payload: ISignupLinkConfigurationCreatePayload,
  ): Promise<ISignupLinkConfigurationMutationResponse> {
    return http.post(SIGNUP_LINK_CONFIGURATION_ENDPOINTS.BASE, payload, undefined, {
      absoluteUrl: true,
    });
  }

  update({
    itemId,
    ...rest
  }: ISignupLinkConfigurationUpdatePayload): Promise<ISignupLinkConfigurationMutationResponse> {
    return http.patch(
      `${SIGNUP_LINK_CONFIGURATION_ENDPOINTS.BASE}/${itemId}`,
      rest,
      undefined,
      { absoluteUrl: true },
    );
  }

  archive(id: string): Promise<ISignupLinkConfigurationMutationResponse> {
    return http.post(
      `${SIGNUP_LINK_CONFIGURATION_ENDPOINTS.BASE}/${id}/archive`,
      {},
      undefined,
      { absoluteUrl: true },
    );
  }
}

export const signupLinkConfigurationService = new SignupLinkConfigurationService();
