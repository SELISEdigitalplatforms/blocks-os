import React, { useEffect, useMemo } from "react";
import { Input } from "@/components/ui-kits/input/input";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import {
  getMailProvider,
  getMailProvidersFor,
  IEmailConfig,
  MailAuthenticationType,
  MailSecurityMode,
  usesPasswordAuthentication,
} from "../../../../models/email";
import { useSaveEmailConfig } from "../../../../hooks/use-email-config";
import type { ISaveMailConfigPayload } from "../../../../services/email.services";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
interface NewConfigurationProps {
  dialogTitle: string;
  onClose: () => void;
  previousData?: IEmailConfig;
  isEdit?: boolean;
}
const EMAIL_PATTERN = /^(?=.{1,320}$)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * The form's rules, built per render because two of them depend on state the
 * schema cannot see: whether this is an edit, and whether the record already
 * has a client secret on file. Without that, an Office 365 edit would demand a
 * secret the user has no reason to retype.
 */
const createSchema = ({ hasClientSecretOnFile }: { hasClientSecretOnFile: boolean }) =>
  z
    .object({
      configurationName: z
        .string()
        .min(3, { message: "Configuration name must be at least 3 characters" })
        .max(100, { message: "Configuration name must be at most 100 characters" }),
      host: z
        .string()
        .regex(/^([\w-]+\.)*[\w-]+\.[a-z]{2,}$/, { message: "Host must be a valid domain" }),
      port: z.coerce
        .number()
        .min(1, { message: "Port must be between 1 and 65535" })
        .max(65535, { message: "Port must be between 1 and 65535" }),
      enableSSL: z.boolean(),
      senderName: z.string().optional(),
      senderAddress: z.string().optional(),
      senderUserName: z.string().optional(),
      accountPassword: z.string().optional(),
      isInbound: z.boolean(),
      provider: z.coerce.number(),
      tenantId: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      mailboxAddress: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const provider = getMailProvider(data.provider);

      if (provider && (data.isInbound ? !provider.supportsInbound : !provider.supportsOutbound)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${provider.label} is not supported for ${data.isInbound ? "inbound" : "outbound"} configurations`,
          path: ["provider"],
        });
      }

      if (!data.isInbound) {
        if (!data.senderName || data.senderName.length < 3 || data.senderName.length > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sender name must be between 3 and 100 characters",
            path: ["senderName"],
          });
        }
        if (!data.senderAddress || !EMAIL_PATTERN.test(data.senderAddress)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sender Address must be a valid email",
            path: ["senderAddress"],
          });
        }
      }

      // Username and password belong to password authentication, not to a
      // particular provider id, so a later OAuth provider needs no change here.
      if (usesPasswordAuthentication(data.provider)) {
        if (!data.senderUserName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sender username is required",
            path: ["senderUserName"],
          });
        }
        if (!data.accountPassword) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Password is required",
            path: ["accountPassword"],
          });
        } else if (data.accountPassword.length < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Password must be at least 6 characters long",
            path: ["accountPassword"],
          });
        }
        return;
      }

      if (!data.tenantId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tenant ID is required",
          path: ["tenantId"],
        });
      }
      if (!data.clientId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client ID is required",
          path: ["clientId"],
        });
      }
      if (!data.mailboxAddress || !EMAIL_PATTERN.test(data.mailboxAddress)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mailbox address must be a valid email",
          path: ["mailboxAddress"],
        });
      }

      // Empty means "keep the secret on file", which is only an option when
      // there is one. A value of pure whitespace is a mistake either way.
      if (!data.clientSecret) {
        if (!hasClientSecretOnFile) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Client secret is required",
            path: ["clientSecret"],
          });
        }
      } else if (!data.clientSecret.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client secret must not be blank",
          path: ["clientSecret"],
        });
      }
    });

const NewConfiguration: React.FC<NewConfigurationProps> = ({
  dialogTitle,
  onClose,
  previousData,
  isEdit,
}) => {
  // const { saveEmailConfig, isPending } = useSaveEmailConfig();
  const { isPending, mutateAsync } = useSaveEmailConfig();

  // Only an existing record can have a secret on file, and the API reports it
  // as a flag because the value and its reference never leave the server.
  const hasClientSecretOnFile = Boolean(isEdit && previousData?.isClientSecretConfigured);
  const schema = useMemo(() => createSchema({ hasClientSecretOnFile }), [hasClientSecretOnFile]);

  const form = useForm<IEmailConfig>({
    defaultValues:
      isEdit && previousData && previousData.itemId !== ""
        ? {
            configurationId: previousData?.itemId,
            configurationName: previousData?.name,
            host: previousData?.host,
            port: previousData?.port,
            enableSSL: previousData?.enableSSL,
            senderName: previousData?.senderName,
            senderAddress: previousData?.senderAddress,
            senderUserName: previousData?.senderUserName,
            // accountPassword: previousData?.accountPassword,
            accountPassword: "",
            isInbound: previousData?.isInbound,
            provider: previousData?.provider,
            tenantId: previousData?.tenantId ?? "",
            clientId: previousData?.clientId ?? "",
            mailboxAddress: previousData?.mailboxAddress ?? "",
            // Never prefilled, for the same reason the password is not: a value
            // rendered here is a value that can be read back out.
            clientSecret: "",
          }
        : {
            configurationId: "",
            configurationName: "",
            host: "",
            port: 0,
            enableSSL: false,
            senderName: "",
            senderAddress: "",
            senderUserName: "",
            accountPassword: "",
            isInbound: false,
            provider: 0,
            tenantId: "",
            clientId: "",
            mailboxAddress: "",
            clientSecret: "",
          },
    resolver: zodResolver(schema),
    mode: "onChange",
  });
  const isInbound = form.watch("isInbound");
  const provider = form.watch("provider");
  const providerCapability = getMailProvider(provider);
  const usesPassword = usesPasswordAuthentication(provider);
  const fixedTransport = providerCapability?.transport;

  const availableProviders = useMemo(() => getMailProvidersFor(isInbound), [isInbound]);

  useEffect(() => {
    // Switching direction can leave a provider selected that the new direction
    // does not offer. Fall back to the first one that does.
    if (availableProviders.length > 0 && !availableProviders.some((p) => p.value === provider)) {
      form.setValue("provider", availableProviders[0].value, { shouldValidate: true });
    }
  }, [availableProviders, provider, form]);

  useEffect(() => {
    // A provider whose transport is part of the integration prefills and locks
    // the host and port, so the read-only fields and the payload agree.
    if (!fixedTransport) {
      return;
    }
    form.setValue("host", fixedTransport.host, { shouldValidate: true });
    form.setValue("port", fixedTransport.port, { shouldValidate: true });
    form.setValue("enableSSL", fixedTransport.enableSSL);
  }, [fixedTransport, form]);

  if (isEdit && previousData?.itemId == "") {
    return <div>loading</div>;
  }
  const formSubmitHandler = async (data: IEmailConfig) => {
    try {
      const capability = getMailProvider(data.provider);
      const isPasswordProvider = usesPasswordAuthentication(data.provider);

      const payload: ISaveMailConfigPayload = {
        configurationName: data.configurationName,
        configurationId: isEdit && previousData?.itemId ? previousData.itemId : "",
        host: capability?.transport?.host ?? data.host,
        port: capability?.transport?.port ?? data.port,
        enableSSL: capability?.transport?.enableSSL ?? data.enableSSL,
        senderName: data.senderName || "",
        senderAddress: data.senderAddress || "",
        isInbound: data.isInbound,
        provider: data.provider,
        authenticationType: capability?.authentication ?? MailAuthenticationType.Password,
        securityMode: capability?.transport?.securityMode ?? MailSecurityMode.Legacy,
      };

      if (isPasswordProvider) {
        payload.senderUserName = data.senderUserName;
        payload.accountPassword = data.accountPassword || "";
      } else {
        payload.tenantId = data.tenantId?.trim();
        payload.clientId = data.clientId?.trim();
        payload.mailboxAddress = data.mailboxAddress?.trim();
        // Omitted when blank, which the server reads as "keep the secret on
        // file". Sending "" would mean the same thing, but leaving the key out
        // keeps a secret-shaped field out of the request entirely.
        if (data.clientSecret) {
          payload.clientSecret = data.clientSecret;
        }
      }
      const res = await mutateAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: isEdit
            ? "Configuration updated successfully."
            : "Configuration created successfully.",
        });
        form.reset();
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors as Record<string, string | string[]> });
      }
    }
  };
  return (
    <DialogContent className="rounded-md sm:max-w-[700px]">
      <Form {...form}>
        {" "}
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader>
            <DialogTitle className="mb-2 text-left">{dialogTitle}</DialogTitle>
            <DialogDescription asChild>
              <div className="pb-4 pt-4 text-left">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    name="configurationName"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          {" "}
                          Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="configName"
                            placeholder="Enter name"
                            className="border-default col-span-3 mt-1 border shadow-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <FormField
                    name="isInbound"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Type <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "true")}
                          value={field.value ? "true" : "false"}
                        >
                          <FormControl>
                            <SelectTrigger className="border-default col-span-3 mt-1 border shadow-none">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">Inbound</SelectItem>
                            <SelectItem value="false">Outbound</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="provider"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Provider <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="border-default col-span-3 mt-1 border shadow-none">
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableProviders.map((available) => (
                              <SelectItem key={available.value} value={available.value.toString()}>
                                {available.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <FormField
                    name="host"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          {" "}
                          {isInbound ? "Server Name" : "Host"}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={isInbound ? "Enter Server Name" : "Enter Host"}
                            className="border-default col-span-3 mt-1 border shadow-none"
                            readOnly={Boolean(fixedTransport)}
                            disabled={Boolean(fixedTransport)}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="port"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          {" "}
                          Port <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter port"
                            className="border-default col-span-3 mt-1 border shadow-none"
                            readOnly={Boolean(fixedTransport)}
                            disabled={Boolean(fixedTransport)}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {!isInbound && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <FormField
                        name="senderName"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              {" "}
                              Sender Name <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter sender name"
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <FormField
                        name="senderAddress"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              {" "}
                              Sender Address <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter sender address"
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                {usesPassword ? (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <FormField
                        name="senderUserName"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              {" "}
                              {isInbound ? "Username" : "Sender Username"}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={isInbound ? "Enter username" : "Enter sender username"}
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <FormField
                        name="accountPassword"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              {" "}
                              Account password <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Enter password"
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <FormField
                        name="tenantId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              Tenant ID <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter Microsoft Entra tenant ID"
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="clientId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              Client ID <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter client ID"
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <FormField
                        name="clientSecret"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              Client Secret{" "}
                              {hasClientSecretOnFile ? null : (
                                <span className="text-destructive">*</span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={
                                  hasClientSecretOnFile
                                    ? "Leave blank to keep the current secret"
                                    : "Enter client secret"
                                }
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="mailboxAddress"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              Mailbox Address <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter mailbox address"
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
                {!fixedTransport && (
                  <div className="mt-4">
                    <FormField
                      name="enableSSL"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Checkbox
                              className="mr-2"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                          <FormLabel className="flex-start inline-flex"> Enable SSL </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <div className="flex flex-row justify-end gap-2">
              <DialogTrigger asChild>
                <Button variant="outline" size="default" disabled={isPending}>
                  Cancel
                </Button>
              </DialogTrigger>
              <Button disabled={isPending || !form.formState.isValid} size="default">
                {isPending
                  ? isEdit
                    ? "Updating..."
                    : "Saving..."
                  : isEdit
                    ? "Update Changes"
                    : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
};
export default NewConfiguration;
