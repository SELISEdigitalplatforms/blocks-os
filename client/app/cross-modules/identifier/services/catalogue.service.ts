import { http } from "@/lib/http/http-client";
import {
  CATALOGUE_ENDPOINTS,
  USAGE_ENDPOINTS,
} from "@blocks-identifier/constants/endpoint.constant";
import {
  ICatalogueResponse,
  IProjectUsageResponse,
  ISyncUsagePayload,
  ISyncUsageResponse,
} from "@blocks-identifier/models/catalogue.model";

/**
 * Reads the published catalogue and this environment's usage.
 *
 * Neither call takes a meter name and neither response is filtered here: whatever the catalogue
 * defines is what the screens draw.
 */
export class CatalogueService {
  /** Everything needed to draw the environment picker, the limits panel and the top-up grid. */
  getCatalogue(market?: string): Promise<ICatalogueResponse> {
    const url = market
      ? `${CATALOGUE_ENDPOINTS.GET}?market=${encodeURIComponent(market)}`
      : CATALOGUE_ENDPOINTS.GET;
    return http.get(url);
  }

  /**
   * What a project is using, one block per environment, grouped by service.
   *
   * The group is passed explicitly. The server refuses a call without one rather than falling back
   * to the caller's own tenant, which is what used to make this answer for the wrong project.
   */
  getUsage(tenantGroupId: string): Promise<IProjectUsageResponse> {
    return http.get(
      `${USAGE_ENDPOINTS.GET}?tenantGroupId=${encodeURIComponent(tenantGroupId)}`,
    );
  }

  /**
   * Brings one environment's rows in line with the catalogue. This is how a newly published meter
   * reaches an environment that already exists.
   */
  syncUsage(payload: ISyncUsagePayload): Promise<ISyncUsageResponse> {
    return http.post(USAGE_ENDPOINTS.SYNC, payload);
  }
}

export const catalogueService = new CatalogueService();
