import { Button } from "@/components/ui-kits/button/button";
import { CardContent } from "@/components/ui-kits/card/card";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { useGetEmailSecretConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import {
  useEmailOrganization,
  useOrganizationName,
} from "@blocks-communication/mail/hooks/use-email-organization";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { organizationOf } from "@blocks-communication/mail/constants/organization";
import {
  fromConfigurationValue,
  languageNameOf,
  toConfigurationValue,
} from "@blocks-communication/mail/constants/template-organization";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import {
  ConfigurationHint,
  TemplateConfigurationOptions,
} from "@blocks-communication/mail/components/email-service/template-configuration-options/template-configuration-options";
import { LockedField } from "@blocks-communication/mail/components/email-service/locked-field/locked-field";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import { useSaveMailTemplate } from "../../../../hooks/use-email-template";

interface EditCommunicationProps {
  dialogTitle: string;
  templateData: IEmailTemplate;
  onClose: () => void;
}

type EditForm = { templateSubject: string; mailConfigurationId: string };

/**
 * SPEC31 §4 EditTemplate design. Name and language are fixed after creation (another language is a clone),
 * so only the subject and the configuration are edited and sent; the server keeps the stored
 * name, language and organization.
 */
const EditCommunication = (props: EditCommunicationProps) => {
  const { t } = useT("os.communication.mail");
  const organizationId = organizationOf(props.templateData);
  const { isMultiOrgEnabled } = useEmailOrganization();
  const organizationName = useOrganizationName(organizationId);
  const { isLoading, data: configsResponse } = useGetEmailSecretConfigs(organizationId);
  const configs = configsResponse?.configurations;
  const { isPending: isSaveTemplateLoading, mutateAsync: saveTemplate } = useSaveMailTemplate();
  const { isLoading: isLanguageListLoading, data: languageListData } = useGetLanguages();
  const languageName = languageNameOf(
    props.templateData.language,
    Array.isArray(languageListData) ? languageListData : [],
  );
  const schema = z.object({
    mailConfigurationId: z
      .string()
      .min(1, { message: t("EDIT_COMMUNICATION.ERROR_CONFIGURATION_REQUIRED") }),
    templateSubject: z
      .string()
      .min(1, { message: t("EDIT_COMMUNICATION.ERROR_SUBJECT_REQUIRED") })
      .max(150, { message: t("EDIT_COMMUNICATION.ERROR_SUBJECT_MAX") }),
  });
  const form = useForm<EditForm>({
    values: {
      mailConfigurationId: toConfigurationValue(props.templateData.mailConfigurationId),
      templateSubject: props.templateData.templateSubject ?? "",
    },
    resolver: zodResolver(schema) as unknown as Resolver<EditForm>,
  });
  const formSubmitHandler = async (data: EditForm) => {
    const customMessages = templateErrorMessages(t);
    try {
      const res = await saveTemplate({
        itemId: props.templateData.itemId,
        templateSubject: data.templateSubject,
        mailConfigurationId: fromConfigurationValue(data.mailConfigurationId),
      });
      props.onClose();
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EDIT_COMMUNICATION.TEMPLATE_UPDATED"),
        });
      } else {
        showErrorToast({ errors: res.errors, customMessages });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors, customMessages });
      } else {
        showErrorToast({ errors: t("EDIT_COMMUNICATION.SOMETHING_WENT_WRONG") });
      }
    }
  };
  const summary = isMultiOrgEnabled
    ? t("EDIT_COMMUNICATION.SUMMARY_ORGANIZATION", {
        organization: organizationName,
        name: props.templateData.name ?? "",
        language: languageName,
      })
    : t("EDIT_COMMUNICATION.SUMMARY", {
        name: props.templateData.name ?? "",
        language: languageName,
      });
  return (
    <DialogContent className="rounded-md sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle className="text-left">{props.dialogTitle}</DialogTitle>
        <DialogDescription className="text-left">{summary}</DialogDescription>
      </DialogHeader>
      {configs && !isLoading && !isLanguageListLoading && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(formSubmitHandler)}>
            <CardContent className="flex flex-col gap-4 px-0 pb-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <LockedField
                  id="edit-template-name"
                  label={t("EDIT_COMMUNICATION.TEMPLATE_NAME")}
                  value={props.templateData.name ?? ""}
                  hint={t("EDIT_COMMUNICATION.NAME_LOCKED_HINT")}
                />
                <LockedField
                  id="edit-template-language"
                  label={t("EDIT_COMMUNICATION.LANGUAGE")}
                  value={languageName}
                  hint={t("EDIT_COMMUNICATION.LANGUAGE_LOCKED_HINT")}
                />
              </div>
              <FormField
                name="templateSubject"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-left font-medium text-high-emphasis">
                      {t("EDIT_COMMUNICATION.SUBJECT")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("EDIT_COMMUNICATION.PLACEHOLDER_SUBJECT")}
                        className="border-default mt-1 border shadow-none"
                        {...field}
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
                    <FormLabel className="text-left font-medium text-high-emphasis">
                      {t("EDIT_COMMUNICATION.EMAIL_CONFIGURATION")}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-default flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none">
                          <SelectValue
                            placeholder={t("EDIT_COMMUNICATION.PLACEHOLDER_CONFIGURATION")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <TemplateConfigurationOptions
                          configs={configs}
                          organizationId={organizationId}
                          organizationName={organizationName}
                          showOrganization={isMultiOrgEnabled}
                        />
                      </SelectContent>
                    </Select>
                    <ConfigurationHint value={field.value} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <DialogFooter className="flex flex-row gap-2">
              <DialogTrigger asChild>
                <Button type="button" disabled={isSaveTemplateLoading} variant="secondary">
                  {t("common:CANCEL")}
                </Button>
              </DialogTrigger>
              <Button type="submit" disabled={isSaveTemplateLoading}>
                {t("common:SAVE")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      )}
    </DialogContent>
  );
};
export default EditCommunication;
