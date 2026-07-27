import React, { forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useForm } from "react-hook-form";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetEmailConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
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
  // eslint-disable-next-line no-unused-vars
  onSubmit(data: unknown): void;
  templateData: IEmailTemplate;
  onValidityChange?: (isValid: boolean) => void;
  actions?: ReactNode;
}

const schema = z.object({
  mailConfigurationId: z.string().min(1, { message: "MailConfiguration is required" }),
  language: z.string().min(1, { message: "Language is required" }),
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(50, { message: "Name must be less than 50 characters" })
    .regex(/^[^\s-]+$/, { message: "Name cannot contain spaces or hyphens" }),
  templateSubject: z
    .string()
    .min(1, { message: "Subject is required" })
    .max(150, { message: "Subject must be less than 150 characters" })
    .refine((val) => val.trim().length > 0, {
      message: "Subject cannot contain only whitespace",
    }),
});

const RequiredMark = () => (
  <span className="text-destructive" aria-hidden="true">
    *
  </span>
);

const BasicInformationSkeleton = () => (
  <Card className="w-full rounded-sm shadow-none" aria-busy="true" aria-label="Loading form">
    <CardHeader className="space-y-2 px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-36 shrink-0" />
      </div>
      <Skeleton className="h-4 w-80 max-w-full" />
    </CardHeader>
    <CardContent className="px-6 pb-6 pt-0">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const BasicInformation = forwardRef(function Inner(
  { onSubmit, templateData, onValidityChange, actions }: IBasicInformationProps,
  ref,
) {
  const { isLoading: isLanguageListLoading, data: languageListData } = useGetLanguages();
  const [filterData] = useState({ pageNumber: 0, pageSize: 10 });
  const { isLoading, data } = useGetEmailConfigs(filterData.pageNumber, filterData.pageSize);
  const form = useForm<IEmailTemplate>({
    defaultValues: {
      itemId: templateData.itemId,
      mailConfigurationId: templateData.mailConfigurationId,
      language: templateData.language,
      name: templateData.name,
      templateSubject: templateData.templateSubject,
      generatedBy: templateData.generatedBy,
    },
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  React.useEffect(() => {
    onValidityChange?.(form.formState.isValid);
  }, [form.formState.isValid, onValidityChange]);

  useImperativeHandle(
    ref,
    () => ({
      submit() {
        form.handleSubmit(onSubmit)();
      },
      isValid: form.formState.isValid,
    }),
    [form.formState.isValid, form, onSubmit],
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
              <CardTitle className="text-lg">About the Template</CardTitle>
              {actions ? <div className="flex shrink-0">{actions}</div> : null}
            </div>
            <p className="text-sm font-normal text-low-emphasis">
              Set the template identity, delivery configuration, and subject line before designing
              the email body.
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
                      Name <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter name"
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
                      Email Configuration <RequiredMark />
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          className="border-default h-10 shadow-none"
                          aria-required="true"
                        >
                          <SelectValue placeholder="Select Configuration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {data
                          .filter((config) => !config.isInbound)
                          .map((config) => (
                            <SelectItem key={config.itemId} value={config.itemId}>
                              {config.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
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
                      Language <RequiredMark />
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          className="border-default h-10 shadow-none"
                          aria-required="true"
                        >
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(languageListData ?? []).map((language) => (
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

              <FormField
                name="templateSubject"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2 xl:col-span-3">
                    <FormLabel className="font-medium text-high-emphasis">
                      Subject <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter subject"
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
