import { http } from "@/lib/http/http-client";
import { AUTH_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthService {
  logout() {
    return http.post(AUTH_ENDPOINTS.LOGOUT, {}, undefined, {
      absoluteUrl: true,
    });
  }
}

export const authService = new AuthService();
