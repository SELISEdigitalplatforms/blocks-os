import { useProjectStore } from "@seliseblocks/genesis-os";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { emailService } from "@blocks-communication/mail/services/email.services";
import { DEFAULT_ORGANIZATION_ID } from "@blocks-communication/mail/constants/organization";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export const useSendTestMail = () => {
  return useMutation({
    mutationKey: ["test-mail", "send"],
    mutationFn: emailService.sendTestMail,
    onSuccess: () => {},
  });
};

export const useCloneTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["template", "clone"],
    mutationFn: emailService.cloneMailTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
  });
};

/** Assigns templates in bulk; the template lists and the cards' "Used by" counts change with it. */
export const useAssignTemplates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["template", "assign"],
    mutationFn: emailService.assignTemplates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["email-config-usage"] });
    },
  });
};

export const useDeleteEmailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["template", "delete"],
    mutationFn: emailService.deleteMailTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
  });
};

export const useGetEmailTemplates = (
  pageNumber: number,
  pageSize: number,
  searchKey: string,
  sortProperty: string,
  isDescending: boolean,
  language: string,
  mailConfigurationId: string,
  organizationId: string = DEFAULT_ORGANIZATION_ID,
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: [
      "email-templates",
      tenantId,
      organizationId,
      pageNumber,
      pageSize,
      searchKey,
      sortProperty,
      isDescending,
      language,
      mailConfigurationId,
    ],
    staleTime: 0,
    queryFn: () =>
      emailService.fetchEmailTemplates(
        pageNumber,
        pageSize,
        searchKey,
        sortProperty,
        isDescending,
        language,
        mailConfigurationId,
        organizationId,
      ),
  });
};

/** Enough rows for every language a project enables. */
const LANGUAGE_LOOKUP_PAGE_SIZE = 100;

/**
 * The languages a template name already has in an organization, for the clone dialog. The list
 * search matches parts of names and subjects, so only exact name matches count.
 */
export const useGetTemplateLanguages = (name: string, organizationId: string, enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["email-templates", tenantId, organizationId, "languages", name],
    staleTime: 0,
    enabled: enabled && !!name,
    queryFn: async () => {
      const response = await emailService.fetchEmailTemplates(
        0,
        LANGUAGE_LOOKUP_PAGE_SIZE,
        name,
        "Name",
        false,
        "",
        "",
        organizationId,
      );
      return (response?.templates ?? [])
        .filter((template) => template.name === name && !!template.language)
        .map((template) => template.language as string);
    },
  });
};

export const useGetEmailTemplate = (itemId: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["email-template", tenantId, itemId],
    staleTime: 0,
    queryFn: () => emailService.fetchEmailTemplate(itemId),
  });
};

export const useSaveEmailTemplate = () => {
  const [isPending, setIsPending] = useState<boolean>(false);

  const saveEmailTemplate = async (data: IEmailTemplate) => {
    try {
      setIsPending(true);
      const payload = {
        ...data,
        itemId: data.itemId ? data.itemId : "",
      };
      const response = await emailService.saveMailTemplate(payload);
      setIsPending(false);
      return response;
    } catch (error) {
      setIsPending(false);
      throw error;
    }
  };
  return { saveEmailTemplate, isPending };
};
export const useSaveMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["template", "save"],
    mutationFn: emailService.saveMailTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["email-template"] });
    },
  });
};
