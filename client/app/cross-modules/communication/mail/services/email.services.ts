import {
  IEmailConfig,
  IEmailTemplate,
  IEmailUsageResponse,
  IGetMailBoxMailResponse,
} from "../models/email";
import { http } from "@/lib/http-client";
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
}

class EmailService {
  fetchEmailConfigs = (
    pageNumber: number,
    pageSize: number,
  ): Promise<IEmailConfig[]> => {
    return http.get(
      `${MAIL_CONFIG_ENDPOINTS.GET_CONFIGS}&pageNumber=${pageNumber + 1}&pageSize=${pageSize}`,
       undefined,
      { absoluteUrl: true },
    );
  };

  getEmailSecretConfigs = (
    pageNumber: number = 0,
    pageSize: number = 10,
  ): Promise<{ configurations: IEmailConfig[] }> => {
    const url = `${MAIL_CONFIG_ENDPOINTS.GET_CONFIGS}?pageNumber=${pageNumber + 1}&pageSize=${pageSize}`;
    return http
      .get<IEmailConfig[]>(url, undefined, { absoluteUrl: true })
      .then((response) => {
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
  ): Promise<{ templates: IEmailTemplate[]; totalCount: number }> => {
    const url = `${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATES}?pageNumber=${pageNumber}&pageSize=${pageSize}&searchKey=${searchKey}&sortProperty=${sortProperty}&isDescending=${isDescending}&language=${language}&mailConfigurationId=${mailConfigurationId}`;
    return http.get(url, undefined, { absoluteUrl: true });
  };

  fetchEmailTemplate = (itemId: string): Promise<IEmailTemplate> => {
    return http.get(
      `${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATE}?itemId=${itemId}`,
      undefined,
      { absoluteUrl: true },
    );
  };

  getMailBoxMails = (
    pageNumber: number,
    pageSize: number,
    isInbound: boolean,
    searchText?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
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

    return http.get(`${MAIL_ENDPOINTS.GET_MAILBOX_MAILS}?${params.toString()}`, undefined, { absoluteUrl: true });
  };

  getMailBoxMail = (messageId: string): Promise<IGetMailBoxMailResponse> => {
    return http.get(
      `${MAIL_ENDPOINTS.GET_MAILBOX_MAIL}?MessageId=${messageId}`,
      undefined,
      { absoluteUrl: true },
    );
  };

  saveMailConfig = (payload: ISaveMailConfigPayload): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
    itemId: string;
  }> => {
    return http
      .post<{ errors: unknown; isSuccess: boolean }>(
        MAIL_CONFIG_ENDPOINTS.SAVE_CONFIG,
        payload,
        undefined,
        { absoluteUrl: true },
      )
      .then((response) => ({
        isSuccess: !!response?.isSuccess,
        errors: response?.errors ?? null,
        itemId: payload.configurationId ?? "",
      }));
  };

  sendTestMail = (data: {
    to: string;
    purpose: string;
    language: string;
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
    };
    return http.post(MAIL_ENDPOINTS.SEND_TO_ANY, payload, undefined, { absoluteUrl: true });
  };

  saveMailTemplate(requestBody: {
    itemId: string;
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
      }>(EMAIL_TEMPLATE_ENDPOINTS.SAVE_TEMPLATE, requestBody, undefined, { absoluteUrl: true })
      .then((response) => response);
  }

  cloneMailTemplate(requestBody: {
    itemId: string;
    mailConfigurationId?: string;
    language?: string;
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
      }>(EMAIL_TEMPLATE_ENDPOINTS.CLONE_TEMPLATE, requestBody, undefined, { absoluteUrl: true })
      .then((response) => response);
  }

  deleteMailTemplate(payload: { itemId: string }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return http
      .delete<{
        errors: unknown;
        isSuccess: boolean;
      }>(
        `${EMAIL_TEMPLATE_ENDPOINTS.DELETE_TEMPLATE}?itemId=${payload.itemId}`,
        undefined,
        { absoluteUrl: true },
      )
      .then((response) => response);
  }

  deleteMailConfig(payload: { configurationId: string }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return http
      .delete<{ errors: unknown; isSuccess: boolean }>(
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
