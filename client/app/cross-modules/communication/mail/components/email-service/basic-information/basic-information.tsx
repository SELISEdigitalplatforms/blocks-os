import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  type ReactNode,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { showErrorToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useForm, type Resolver } from "react-hook-form";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetEmailSecretConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import {
  useEmailOrganization,
  useOrganizationName,
} from "@blocks-communication/mail/hooks/use-email-organization";
import {
  fromConfigurationValue,
  toConfigurationValue,
} from "@blocks-communication/mail/constants/template-organization";
import {
  ConfigurationHint,
  TemplateConfigurationOptions,
} from "@blocks-communication/mail/components/email-service/template-configuration-options/template-configuration-options";
import { LockedField } from "@blocks-communication/mail/components/email-service/locked-field/locked-field";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import { useSaveMailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

interface IBasicInformationProps {
  templateData: IEmailTemplate;
  onSaveSuccess?: (data: IEmailTemplate) => void;
  onValidityChange?: (isValid: boolean) => void;
  onPendingChange?: (isPending: boolean) => void;
  actions?: ReactNode;
}

type TranslateFn = ReturnType<typeof useT>["t"];

const createSchema = (t: TranslateFn) =>
  z.object({
    mailConfigurationId: z
      .string()
      .min(1, { message: t("BASIC_INFORMATION.ERROR_CONFIGURATION_REQUIRED") }),
    language: z.string().min(1, { message: t("BASIC_INFORMATION.ERROR_LANGUAGE_REQUIRED") }),
    name: z
      .string()
      .min(1, { message: t("BASIC_INFORMATION.ERROR_NAME_REQUIRED") })
      .max(50, { message: t("BASIC_INFORMATION.ERROR_NAME_MAX") })
      .regex(/^[^\s-]+$/, { message: t("BASIC_INFORMATION.ERROR_NAME_PATTERN") }),
    templateSubject: z
      .string()
      .min(1, { message: t("BASIC_INFORMATION.ERROR_SUBJECT_REQUIRED") })
      .max(150, { message: t("BASIC_INFORMATION.ERROR_SUBJECT_MAX") })
      .refine((val) => val.trim().length > 0, {
        message: t("BASIC_INFORMATION.ERROR_SUBJECT_WHITESPACE"),
      }),
  });

const RequiredMark = () => (
  <span className="text-destructive" aria-hidden="true">
    *
  </span>
);

type LanguageOption = {
  itemId?: string;
  languageCode: string;
  languageName: string;
  isDefault?: boolean;
};

const getUniqueLanguages = (languages: LanguageOption[] = []): LanguageOption[] => {
  const uniqueByCode = new Map<string, LanguageOption>();

  for (const language of languages) {
    const existing = uniqueByCode.get(language.languageCode);
    if (!existing || (!existing.isDefault && language.isDefault)) {
      uniqueByCode.set(language.languageCode, language);
    }
  }

  return Array.from(uniqueByCode.values());
};

const BasicInformationSkeleton = () => {
  const { t } = useT("os.communication.mail");
  return (
    <Card
      className="w-full rounded-sm shadow-none"
      aria-busy="true"
      aria-label={t("BASIC_INFORMATION.LOADING_FORM")}
    >
      <CardHeader className="space-y-2 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-36 shrink-0" />
        </div>
        <Skeleton className="h-4 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {["field-1", "field-2", "field-3", "field-4"].map((field) => (
            <div key={field} className="grid gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const BasicInformation = forwardRef(function Inner(
  {
    onSaveSuccess,
    templateData,
    onValidityChange,
    onPendingChange,
    actions,
  }: IBasicInformationProps,
  ref,
) {
  const { t } = useT("os.communication.mail");
  const schema = useMemo(() => createSchema(t), [t]);
  const { isLoading: isLanguageListLoading, data: languageListData } = useGetLanguages();
  // New Template opens in the page's organization; the Default organization with multi-org off.
  const organization = useEmailOrganization();
  const organizationId = organization.selectedOrganizationId;
  const organizationName = useOrganizationName(organizationId);
  const { isLoading, data: configsResponse } = useGetEmailSecretConfigs(organizationId);
  const data = configsResponse?.configurations;
  const { isPending, mutateAsync: saveTemplate } = useSaveMailTemplate();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const uniqueLanguages = getUniqueLanguages(languageListData ?? []);
  const form = useForm<IEmailTemplate>({
    defaultValues: {
      itemId: templateData.itemId,
      // A saved template without a configuration uses "Organization default"; a new one starts
      // with nothing picked, so the required rule asks for a choice.
      mailConfigurationId: templateData.itemId
        ? toConfigurationValue(templateData.mailConfigurationId)
        : (templateData.mailConfigurationId ?? ""),
      language: templateData.language,
      name: templateData.name,
      templateSubject: templateData.templateSubject,
      generatedBy: templateData.generatedBy,
    },
    resolver: zodResolver(schema) as unknown as Resolver<IEmailTemplate>,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  React.useEffect(() => {
    onValidityChange?.(form.formState.isValid);
  }, [form.formState.isValid, onValidityChange]);

  React.useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  // Read itemId into a local so the compiler infers this exact dependency rather than the whole
  // templateData object; the callback keeps its current identity lifetime.
  const templateItemId = templateData?.itemId;
  const handleFormSubmit = useCallback(
    async (data: IEmailTemplate) => {
      try {
        const payload = {
          ...data,
          mailConfigurationId: fromConfigurationValue(data.mailConfigurationId ?? ""),
          organizationId,
          itemId: templateItemId || "",
          projectKey: tenantId,
        };
        const res = await saveTemplate(payload);

        if (res?.isSuccess) {
          onSaveSuccess?.({
            ...data,
            itemId: res.itemId ?? data.itemId,
          });
          return;
        }

        showErrorToast({ errors: res.errors, customMessages: templateErrorMessages(t) });
      } catch (error) {
        if (isErrorWithErrors(error)) {
          showErrorToast({ errors: error.errors, customMessages: templateErrorMessages(t) });
        } else {
          showErrorToast({ errors: t("BASIC_INFORMATION.SOMETHING_WENT_WRONG") });
        }
      }
    },
    [onSaveSuccess, saveTemplate, templateItemId, tenantId, organizationId, t],
  );

  const { isValid } = form.formState;

  useImperativeHandle(
    ref,
    () => ({
      submit() {
        form.handleSubmit(handleFormSubmit)();
      },
      isValid,
    }),
    [isValid, form, handleFormSubmit],
  );

  if (isLoading || isLanguageListLoading || !data) {
    return <BasicInformationSkeleton />;
  }

  return (
    <Card className="w-full rounded-sm shadow-none">
      <Form {...form}>
        <form className="flex h-full flex-col">
          <CardHeader className="space-y-1 px-6 pb-4 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">{t("BASIC_INFORMATION.TITLE")}</CardTitle>
              {actions ? <div className="flex shrink-0">{actions}</div> : null}
            </div>
            <p className="text-sm font-normal text-low-emphasis">
              {t("BASIC_INFORMATION.DESCRIPTION")}
            </p>
          </CardHeader>
          <CardContent className="flex-1 px-6 pb-6 pt-0">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              <FormField
                name="name"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-high-emphasis">
                      {t("common:NAME")} <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("BASIC_INFORMATION.PLACEHOLDER_NAME")}
                        className="border-default shadow-none"
                        aria-required="true"
                        {...field}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "_") {
                            e.preventDefault();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mailConfigurationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-high-emphasis">
                      {t("BASIC_INFORMATION.EMAIL_CONFIGURATION")} <RequiredMark />
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          className="border-default h-10 shadow-none"
                          aria-required="true"
                        >
                          <SelectValue
                            placeholder={t("BASIC_INFORMATION.PLACEHOLDER_CONFIGURATION")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <TemplateConfigurationOptions
                          configs={data}
                          organizationId={organizationId}
                          organizationName={organizationName}
                        />
                      </SelectContent>
                    </Select>
                    <ConfigurationHint value={field.value} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-high-emphasis">
                      {t("BASIC_INFORMATION.LANGUAGE")} <RequiredMark />
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          className="border-default h-10 shadow-none"
                          aria-required="true"
                        >
                          <SelectValue placeholder={t("BASIC_INFORMATION.PLACEHOLDER_LANGUAGE")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uniqueLanguages.map((language) => (
                          <SelectItem key={language.languageCode} value={language.languageCode}>
                            {language.languageName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {organization.isMultiOrgEnabled ? (
                <LockedField
                  id="basic-information-organization"
                  label={t("TEMPLATE_ORGANIZATION.ORGANIZATION")}
                  value={organizationName}
                />
              ) : null}

              <FormField
                name="templateSubject"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2 xl:col-span-3">
                    <FormLabel className="font-medium text-high-emphasis">
                      {t("BASIC_INFORMATION.SUBJECT")} <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("BASIC_INFORMATION.PLACEHOLDER_SUBJECT")}
                        className="border-default shadow-none"
                        aria-required="true"
                        {...field}
                        onBlur={(e) => {
                          field.onChange(e.target.value.trim());
                          field.onBlur();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
});

export default BasicInformation;
