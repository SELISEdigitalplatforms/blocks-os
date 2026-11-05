import {
  IAssignTemplatesRequest,
  IAssignTemplatesResponse,
  ICopyTemplateToOrganizationsRequest,
  IDeleteTemplateAcrossOrganizationsRequest,
  IDeleteTemplateAcrossOrganizationsResponse,
  ICopyTemplateToOrganizationsResponse,
  IEmailConfig,
  IEmailTemplate,
  IEmailUsageResponse,
  IGetMailBoxMailResponse,
  ITemplateOrganizationCopiesResponse,
} from "../models/email";
import { http } from "@/lib/http/http-client";
import {
  EMAIL_TEMPLATE_ENDPOINTS,
  MAIL_CONFIG_ENDPOINTS,
  MAIL_ENDPOINTS,
} from "../constants/endpoint.constant";

export interface ISaveMailConfigPayload {
  configurationName?: string;
  configurationId?: string;
  host?: string;
  port?: number;
  enableSSL?: boolean;
  senderName?: string;
  senderAddress?: string;
  senderUserName?: string;
  accountPassword?: string;
  lastUpdatedDate?: string;
  isInbound?: boolean;
  provider?: number;
  authenticationType?: number;
  securityMode?: number;
  /** The Microsoft Entra tenant id, not the Blocks tenant id. */
  tenantId?: string;
  clientId?: string;
  /** Omitted to keep the secret already on file; never read back. */
  clientSecret?: string;
  mailboxAddress?: string;
  /** Sent only in multi-org projects; the server keeps an edited configuration's organization. */
  organizationId?: string;
  isOrganizationDefault?: boolean;
}

// The file endpoints answer `application/octet-stream`, which the HTTP client hands back as a
// Blob. Anything else (JSON or text from an older API) is not the file.
const requireBlob = (result: unknown, what: string): Blob => {
  if (!(result instanceof Blob)) {
    throw new TypeError(`Unexpected ${what} response`);
  }
  return result;
};

class EmailService {
  fetchEmailConfigs = (pageNumber: number, pageSize: number): Promise<IEmailConfig[]> => {
    return http.get(
      `${MAIL_CONFIG_ENDPOINTS.GET_CONFIGS}?pageNumber=${pageNumber + 1}&pageSize=${pageSize}`,
      undefined,
      { absoluteUrl: true },
    );
  };

  /**
   * Without an organization: every configuration. With one: that organization's configurations
   * plus the Default organization's, which every organization shares.
   */
  getEmailSecretConfigs = (
    pageNumber: number = 0,
    pageSize: number = 10,
    organizationId?: string,
  ): Promise<{ configurations: IEmailConfig[] }> => {
    const organizationQuery = organizationId
      ? `&organizationId=${encodeURIComponent(organizationId)}`
      : "";
    const url = `${MAIL_CONFIG_ENDPOINTS.GET_CONFIGS}?pageNumber=${pageNumber + 1}&pageSize=${pageSize}${organizationQuery}`;
    return http.get<IEmailConfig[]>(url, undefined, { absoluteUrl: true }).then((response) => {
      const list = Array.isArray(response)
        ? response
        : Array.isArray((response as { data?: IEmailConfig[] })?.data)
          ? ((response as { data: IEmailConfig[] }).data as IEmailConfig[])
          : [];
      const configurations = list.map((config) => ({
        ...config,
        configurationId: config.itemId,
        configurationName: config.name ?? config.configurationName,
        name: config.name ?? config.configurationName,
      }));
      return { configurations };
    });
  };

  fetchEmailTemplates = (
    pageNumber: number,
    pageSize: number,
    searchKey: string,
    sortProperty: string = "Name",
    isDescending: boolean = false,
    language: string,
    mailConfigurationId: string,
    organizationId?: string,
  ): Promise<{ templates: IEmailTemplate[]; totalCount: number }> => {
    // Without an organization the server lists the Default organization's templates.
    const organizationQuery = organizationId
      ? `&organizationId=${encodeURIComponent(organizationId)}`
      : "";
    const url = `${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATES}?pageNumber=${pageNumber}&pageSize=${pageSize}&searchKey=${encodeURIComponent(searchKey)}&sortProperty=${sortProperty}&isDescending=${isDescending}&language=${language}&mailConfigurationId=${mailConfigurationId}${organizationQuery}`;
    return http.get(url, undefined, { absoluteUrl: true });
  };

  fetchEmailTemplate = (itemId: string): Promise<IEmailTemplate> => {
    return http.get(`${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATE}?itemId=${itemId}`, undefined, {
      absoluteUrl: true,
    });
  };

  getMailBoxMails = (
    pageNumber: number,
    pageSize: number,
    isInbound: boolean,
    searchText?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
    mailServerConfigurationId?: string,
  ): Promise<IEmailUsageResponse> => {
    const params = new URLSearchParams({
      PageNumber: pageNumber.toString(),
      PageSize: pageSize.toString(),
      IsInbound: isInbound.toString(),
    });

    if (searchText) {
      params.append("SearchText", searchText);
    }
    if (status) {
      params.append("Status", status);
    }
    if (startDate) {
      params.append("SendDateRange.StartDate", startDate);
    }
    if (endDate) {
      params.append("SendDateRange.EndDate", endDate);
    }
    if (mailServerConfigurationId) {
      params.append("MailServerConfigurationId", mailServerConfigurationId);
    }

    return http.get(`${MAIL_ENDPOINTS.GET_MAILBOX_MAILS}?${params.toString()}`, undefined, {
      absoluteUrl: true,
    });
  };

  /** The stored message (`.eml`) as a file. Fetched on demand, never part of the details read. */
  getMailBoxMailSource = (itemId: string): Promise<Blob> => {
    return http
      .get<Blob>(
        `${MAIL_ENDPOINTS.GET_MAILBOX_MAIL_SOURCE}?ItemId=${encodeURIComponent(itemId)}`,
        undefined,
        { absoluteUrl: true },
      )
      .then((result) => requireBlob(result, "message source"));
  };

  /** One attachment of a stored message, by its position, as a file. */
  getMailBoxMailAttachmentFile = (itemId: string, index: number): Promise<Blob> => {
    const params = new URLSearchParams({ ItemId: itemId, Index: String(index) });
    return http
      .get<Blob>(
        `${MAIL_ENDPOINTS.GET_MAILBOX_MAIL_ATTACHMENT_FILE}?${params.toString()}`,
        undefined,
        { absoluteUrl: true },
      )
      .then((result) => requireBlob(result, "attachment"));
  };

  getMailBoxMail = (itemId: string): Promise<IGetMailBoxMailResponse> => {
    return http.get(
      `${MAIL_ENDPOINTS.GET_MAILBOX_MAIL}?ItemId=${encodeURIComponent(itemId)}`,
      undefined,
      {
        absoluteUrl: true,
      },
    );
  };

  saveMailConfig = (
    payload: ISaveMailConfigPayload,
  ): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
    itemId: string;
  }> => {
    return http
      .post<{
        errors: unknown;
        isSuccess: boolean;
        itemId?: string;
      }>(MAIL_CONFIG_ENDPOINTS.SAVE_CONFIG, payload, undefined, { absoluteUrl: true })
      .then((response) => ({
        isSuccess: !!response?.isSuccess,
        errors: response?.errors ?? null,
        // The server's id, not the one that was sent. On a create the request
        // carries no id, so echoing the payload back reported an empty string
        // for the record it had just written.
        itemId: response?.itemId ?? payload.configurationId ?? "",
      }));
  };

  /** How many templates name the configuration, across every organization and language. */
  getConfigurationUsage = (configurationId: string): Promise<number> =>
    http
      .get<{ isSuccess: boolean; templateCount?: number }>(
        `${MAIL_CONFIG_ENDPOINTS.GET_CONFIG_USAGE}?configurationId=${encodeURIComponent(configurationId)}`,
        undefined,
        { absoluteUrl: true },
      )
      .then((response) => {
        if (!response?.isSuccess || typeof response.templateCount !== "number") {
          throw new Error("Mail/GetConfigurationUsage failed");
        }
        return response.templateCount;
      });

  /** A test mail of exactly this template: blocks-logic sends the template by its id. */
  sendTestMail = (data: {
    to: string;
    purpose: string;
    language: string;
    templateId: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
    itemId: string;
  }> => {
    const payload = {
      to: [data.to],
      purpose: data.purpose,
      language: data.language,
      replyTo: [data.to],
      isTestMail: true,
      templateId: data.templateId,
    };
    return http.post(MAIL_ENDPOINTS.SEND_TO_ANY, payload, undefined, {
      absoluteUrl: true,
    });
  };

  saveMailTemplate(requestBody: {
    itemId: string;
    /** On create only; an edit keeps the stored organization. */
    organizationId?: string;
    mailConfigurationId?: string;
    language?: string;
    name?: string;
    templateSubject?: string;
    generatedBy?: string;
    templateBody?: string;
    jsonContent?: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
    itemId: string;
  }> {
    return http
      .post<{
        errors: null | unknown;
        isSuccess: boolean;
        itemId: string;
      }>(EMAIL_TEMPLATE_ENDPOINTS.SAVE_TEMPLATE, requestBody, undefined, {
        absoluteUrl: true,
      })
      .then((response) => response);
  }

  /** A clone keeps the source's name and organization, in another language. */
  cloneMailTemplate(requestBody: {
    itemId: string;
    mailConfigurationId?: string;
    language: string;
    name?: string;
    templateSubject?: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
    itemId: string;
  }> {
    return http
      .post<{
        errors: null | unknown;
        isSuccess: boolean;
        itemId: string;
      }>(EMAIL_TEMPLATE_ENDPOINTS.CLONE_TEMPLATE, requestBody, undefined, {
        absoluteUrl: true,
      })
      .then((response) => response);
  }

  /**
   * Points many templates of the configuration's organization at the configuration in one
   * update: the given ids, or with `allMatching` every template matching the list's filters.
   */
  assignTemplates(requestBody: IAssignTemplatesRequest): Promise<IAssignTemplatesResponse> {
    return http.post<IAssignTemplatesResponse>(
      EMAIL_TEMPLATE_ENDPOINTS.ASSIGN_TEMPLATES,
      requestBody,
      undefined,
      { absoluteUrl: true },
    );
  }

  /** Queues the Worker job that copies a Default organization template to organizations. */
  copyTemplateToOrganizations(
    requestBody: ICopyTemplateToOrganizationsRequest,
  ): Promise<ICopyTemplateToOrganizationsResponse> {
    return http.post<ICopyTemplateToOrganizationsResponse>(
      EMAIL_TEMPLATE_ENDPOINTS.COPY_TEMPLATE_TO_ORGANIZATIONS,
      requestBody,
      undefined,
      { absoluteUrl: true },
    );
  }

  /** Which of these organizations (at most 25) already have their own copy of the template. */
  getTemplateOrganizationCopies(
    templateId: string,
    organizationIds: string[],
  ): Promise<ITemplateOrganizationCopiesResponse> {
    const query = new URLSearchParams({
      templateId,
      organizationIds: organizationIds.join(","),
    });
    return http.get<ITemplateOrganizationCopiesResponse>(
      `${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATE_ORGANIZATION_COPIES}?${query.toString()}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  /**
   * Deletes a Default organization template now and queues the deletion of the organizations'
   * copies with the same name and language (SPEC34 §6.1). The Default-only delete stays on
   * DeleteTemplate.
   */
  deleteTemplateAcrossOrganizations(
    requestBody: IDeleteTemplateAcrossOrganizationsRequest,
  ): Promise<IDeleteTemplateAcrossOrganizationsResponse> {
    return http.post<IDeleteTemplateAcrossOrganizationsResponse>(
      EMAIL_TEMPLATE_ENDPOINTS.DELETE_TEMPLATE_ACROSS_ORGANIZATIONS,
      requestBody,
      undefined,
      { absoluteUrl: true },
    );
  }

  deleteMailTemplate(payload: { itemId: string }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return http
      .delete<{
        errors: unknown;
        isSuccess: boolean;
      }>(`${EMAIL_TEMPLATE_ENDPOINTS.DELETE_TEMPLATE}?itemId=${payload.itemId}`, undefined, {
        absoluteUrl: true,
      })
      .then((response) => response);
  }

  deleteMailConfig(payload: { configurationId: string }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return http
      .delete<{
        errors: unknown;
        isSuccess: boolean;
      }>(
        `${MAIL_CONFIG_ENDPOINTS.DELETE_CONFIG}?configurationId=${encodeURIComponent(payload.configurationId)}`,
        undefined,
        { absoluteUrl: true },
      )
      .then((response) => ({
        isSuccess: !!response?.isSuccess,
        errors: response?.errors ?? null,
      }));
  }
}
export default EmailService;
export const emailService = new EmailService();
