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
import { secretsService } from "@/services/secrets.service";

class EmailService {
  fetchEmailConfigs = (
    projectKey: string,
    pageNumber: number,
    pageSize: number,
  ): Promise<IEmailConfig[]> => {
    return http.get(
      `${MAIL_CONFIG_ENDPOINTS.GET_CONFIGS}&pageNumber=${pageNumber + 1}&pageSize=${pageSize}`,
       undefined,
      { absoluteUrl: true },
    );
  };

  getEmailSecretConfigs = (projectKey: string): Promise<{ configurations: IEmailConfig[] }> => {
    return secretsService.gets("email").then((secrets) => {
      if (!secrets?.length) return { configurations: [] };
      return {
        configurations: secrets.map((secret) => {
          const kv = secret.keyValuePairs;
          return {
            configurationId: secret.itemId,
            itemId: secret.itemId,
            name: kv.configurationName,
            configurationName: kv.configurationName,
            host: kv.host,
            port: Number(kv.port),
            enableSSL: typeof kv.enableSSL === "string" ? kv.enableSSL === "true" : Boolean(kv.enableSSL),
            senderName: kv.senderName,
            senderAddress: kv.senderAddress,
            senderUserName: kv.senderUserName,
            accountPassword: kv.accountPassword,
            isInbound: typeof kv.isInbound === "string" ? kv.isInbound === "true" : Boolean(kv.isInbound),
            provider: Number(kv.provider),
            isDefault: typeof kv.isDefault === "string" ? kv.isDefault === "true" : Boolean(kv.isDefault),
          } as IEmailConfig;
        }),
      };
    });
  };

  fetchEmailTemplates = (
    pageNumber: number,
    pageSize: number,
    projectKey: string,
    searchKey: string,
    sortProperty: string = "Name",
    isDescending: boolean = false,
    language: string,
    mailConfigurationId: string,
  ): Promise<{ templates: IEmailTemplate[]; totalCount: number }> => {
    const url = `${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATES}?pageNumber=${pageNumber}&pageSize=${pageSize}&projectKey=${projectKey}&searchKey=${searchKey}&sortProperty=${sortProperty}&isDescending=${isDescending}&language=${language}&mailConfigurationId=${mailConfigurationId}`;
    return http.get(url, undefined, { absoluteUrl: true });
  };

  fetchEmailTemplate = (projectKey: string, itemId: string): Promise<IEmailTemplate> => {
    return http.get(
      `${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATE}?itemId=${itemId}&projectKey=${projectKey}`,
      undefined,
      { absoluteUrl: true },
    );
  };

  getMailBoxMails = (
    projectKey: string,
    pageNumber: number,
    pageSize: number,
    isInbound: boolean,
    searchText?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<IEmailUsageResponse> => {
    const params = new URLSearchParams({
      ProjectKey: projectKey,
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

  getMailBoxMail = (projectKey: string, messageId: string): Promise<IGetMailBoxMailResponse> => {
    return http.get(
      `${MAIL_ENDPOINTS.GET_MAILBOX_MAIL}?MessageId=${messageId}`,
      undefined,
      { absoluteUrl: true },
    );
  };

  saveMailConfig = (payload: {
    secretKey: string;
    keyValuePairs: Record<string, string>;
    itemId?: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
    itemId: string;
  }> => {
    return secretsService.save(payload).then((item) => ({ isSuccess: true, errors: null, itemId: item.itemId }));
  };

  sendTestMail = (data: {
    to: string;
    purpose: string;
    language: string;
    projectKey: string;
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
      projectKey: data.projectKey,
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
    projectKey?: string;
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
    projectKey: string;
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

  deleteMailTemplate(payload: { itemId: string; projectKey: string }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return http
      .delete<{
        errors: unknown;
        isSuccess: boolean;
      }>(
        `${EMAIL_TEMPLATE_ENDPOINTS.DELETE_TEMPLATE}?itemId=${payload.itemId}&projectKey=${payload.projectKey}`,
        undefined,
        { absoluteUrl: true },
      )
      .then((response) => response);
  }

  deleteMailConfig(payload: { configurationId: string; projectKey: string }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return secretsService
      .delete(payload.configurationId)
      .then(() => ({ isSuccess: true, errors: null }))
      .catch((error) => ({ isSuccess: false, errors: error }));
  }
}
export default EmailService;
export const emailService = new EmailService();
