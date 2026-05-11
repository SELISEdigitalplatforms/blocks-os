import { http } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { useAuthStore } from "@/store/useAuthStore";
import { AUTH_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthService {
  logout() {
    const isLocalhost = getRuntimeEnv("BLOCKS_API_BASE_URL")?.includes("localhost");
    const refreshToken = isLocalhost ? (useAuthStore.getState().refreshToken || "") : "";
    return http.post(AUTH_ENDPOINTS.LOGOUT, { refreshToken });
  }
}

export const authService = new AuthService();
