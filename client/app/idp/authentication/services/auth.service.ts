import { http } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { useAuthStore } from "@/store/useAuthStore";
import { AUTH_ENDPOINTS } from "../constants/endpoint.constant";
import { IDP_BASE_URL } from "@/constants/endpoint.constant";

export class AuthService {
  //will be removed soon
  verifyOidc(payload: { code: string; state: string }): Promise<any> {
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", payload.code);
    body.append("state", payload.state);
    body.append("client_secret", "e048ec1b63d548dd85d053f364d5d54c");

    return http.post(
      `${IDP_BASE_URL}${AUTH_ENDPOINTS.TOKEN}`,
      body,
      {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic c2VsaXNlYmxvY2tzOkJsMDNrc0B1JFU3VjEwUw==",
      },
      { absoluteUrl: true },
    );
  }

  logout() {
    const isLocalhost = getRuntimeEnv("BLOCKS_API_BASE_URL")?.includes("localhost");
    const refreshToken = isLocalhost ? (useAuthStore.getState().refreshToken || "") : "";
    return http.post(AUTH_ENDPOINTS.LOGOUT, { refreshToken });
  }
}

export const authService = new AuthService();
