import { http } from "@/lib/http/http-client";
import { SIGNUP_LINK_ENDPOINTS } from "../constants/endpoint.constant";
import {
  ISignupLinkSummary,
  ISignupLinkSummaryPayload,
} from "../models/signup-link-summary";

export class SignupLinkSummaryService {
  getSummary(payload: ISignupLinkSummaryPayload): Promise<ISignupLinkSummary> {
    return http.post(SIGNUP_LINK_ENDPOINTS.SUMMARY, payload, undefined, {
      absoluteUrl: true,
    });
  }
}

export const signupLinkSummaryService = new SignupLinkSummaryService();
