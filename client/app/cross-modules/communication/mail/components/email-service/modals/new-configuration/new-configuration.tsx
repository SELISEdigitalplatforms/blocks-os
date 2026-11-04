import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui-kits/input/input";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useForm, type Control, type Resolver } from "react-hook-form";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
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
  getAuthenticationOptions,
  getFixedTransport,
  getMailProvider,
  getMailProvidersFor,
  IEmailConfig,
  getMailAuthenticationLabel,
  MailAuthenticationType,
  MailServiceProvider,
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
import { Banner } from "@/components/ui-kits/banner/banner";
import { isBrokenLinkedSecretStatus } from "@/cross-modules/secrets/models/secret.model";
import {
  LINKED_SECRET_REPAIR_NOTICE,
  linkedSecretRepairRequiredMessage,
} from "@/cross-modules/secrets/components/linked-secret-status/linked-secret-status";
import { Label } from "@/components/ui-kits/label/label";
import { OrganizationCombobox } from "@blocks-idp/iam/components/organization-combobox";
import { DEFAULT_ORGANIZATION_ID, organizationOf } from "../../../../constants/organization";
interface NewConfigurationProps {
  dialogTitle: string;
  onClose: () => void;
  previousData?: IEmailConfig;
  isEdit?: boolean;
  /**
   * Multi-org projects only: the page's organization on create, the card's on edit. Without it
   * the form has no organization field and no organization-default option, as before.
   */
  organization?: { id: string; name: string };
  /** Whether the page's organization already has a default; on create the option starts ticked when it hasn't. */
  organizationHasDefault?: boolean;
}

/** Server field errors this form shows under its own fields, as English keys. */
const ORGANIZATION_ERROR_KEYS: Record<string, Record<string, string>> = {
  OrganizationId: {
    "Organization not found": "NEW_CONFIGURATION.ERROR_ORGANIZATION_NOT_FOUND",
    "A configuration's organization can't be changed":
      "NEW_CONFIGURATION.ERROR_ORGANIZATION_CHANGED",
  },
  IsOrganizationDefault: {
    "An inbound configuration can't be the organization default":
      "NEW_CONFIGURATION.ERROR_INBOUND_ORGANIZATION_DEFAULT",
  },
};

/**
 * Splits a save's errors into the organization ones this form shows under its fields (as keys)
 * and the rest, which keep going to the toast as before.
 */
const splitOrganizationErrors = (errors: Record<string, string | string[]>) => {
  const fieldKeys: Partial<Record<"OrganizationId" | "IsOrganizationDefault", string>> = {};
  const rest: Record<string, string | string[]> = {};
  for (const [field, value] of Object.entries(errors)) {
    const message = Array.isArray(value) ? value[0] : value;
    const key = ORGANIZATION_ERROR_KEYS[field]?.[message];
    if (key) {
      fieldKeys[field as "OrganizationId" | "IsOrganizationDefault"] = key;
    } else {
      rest[field] = value;
    }
  }
  return { fieldKeys, rest };
};
const EMAIL_PATTERN = /^(?=.{1,320}$)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * The form's rules, built per render because two of them depend on state the
 * schema cannot see: whether this is an edit, and whether the record already
 * has a client secret on file. Without that, an Office 365 edit would demand a
 * secret the user has no reason to retype.
 */
type TranslateFn = ReturnType<typeof useT>["t"];

type FormIssue = { message: string; path: string };
type ConfigValues = {
  provider: number;
  isInbound: boolean;
  senderName?: string;
  senderAddress?: string;
  senderUserName?: string;
  accountPassword?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  mailboxAddress?: string;
};

const providerIssues = (t: TranslateFn, data: ConfigValues): FormIssue[] => {
  const provider = getMailProvider(data.provider);
  if (!provider || (data.isInbound ? provider.supportsInbound : provider.supportsOutbound)) {
    return [];
  }
  const key = data.isInbound
    ? "NEW_CONFIGURATION.ERROR_PROVIDER_NOT_INBOUND"
    : "NEW_CONFIGURATION.ERROR_PROVIDER_NOT_OUTBOUND";
  return [{ message: t(key, { provider: provider.label }), path: "provider" }];
};

const senderIssues = (t: TranslateFn, data: ConfigValues): FormIssue[] => {
  if (data.isInbound) return [];
  const issues: FormIssue[] = [];
  if (!data.senderName || data.senderName.length < 3 || data.senderName.length > 100) {
    issues.push({ message: t("NEW_CONFIGURATION.ERROR_SENDER_NAME_LENGTH"), path: "senderName" });
  }
  if (!data.senderAddress || !EMAIL_PATTERN.test(data.senderAddress)) {
    issues.push({
      message: t("NEW_CONFIGURATION.ERROR_SENDER_ADDRESS_INVALID"),
      path: "senderAddress",
    });
  }
  return issues;
};

// Username and password belong to password authentication, not to a
// particular provider id, so a later OAuth provider needs no change here.
const passwordIssues = (t: TranslateFn, data: ConfigValues): FormIssue[] => {
  const issues: FormIssue[] = [];
  if (!data.senderUserName) {
    issues.push({
      message: t("NEW_CONFIGURATION.ERROR_SENDER_USERNAME_REQUIRED"),
      path: "senderUserName",
    });
  }
  if (!data.accountPassword) {
    issues.push({
      message: t("NEW_CONFIGURATION.ERROR_PASSWORD_REQUIRED"),
      path: "accountPassword",
    });
  } else if (data.accountPassword.length < 6) {
    issues.push({ message: t("NEW_CONFIGURATION.ERROR_PASSWORD_MIN"), path: "accountPassword" });
  }
  return issues;
};

// Empty means "keep the secret on file", which is only an option when
// there is one. A value of pure whitespace is a mistake either way.
const clientSecretIssue = (
  t: TranslateFn,
  clientSecret: string | undefined,
  hasClientSecretOnFile: boolean,
  needsNewClientSecret: boolean,
): FormIssue | null => {
  if (clientSecret) {
    return clientSecret.trim()
      ? null
      : { message: t("NEW_CONFIGURATION.ERROR_CLIENT_SECRET_BLANK"), path: "clientSecret" };
  }
  if (hasClientSecretOnFile) return null;
  return {
    message: needsNewClientSecret
      ? linkedSecretRepairRequiredMessage()
      : t("NEW_CONFIGURATION.ERROR_CLIENT_SECRET_REQUIRED"),
    path: "clientSecret",
  };
};

const oauthIssues = (
  t: TranslateFn,
  data: ConfigValues,
  hasClientSecretOnFile: boolean,
  needsNewClientSecret: boolean,
): FormIssue[] => {
  const issues: FormIssue[] = [];
  if (!data.tenantId?.trim()) {
    issues.push({ message: t("NEW_CONFIGURATION.ERROR_TENANT_ID_REQUIRED"), path: "tenantId" });
  }
  if (!data.clientId?.trim()) {
    issues.push({ message: t("NEW_CONFIGURATION.ERROR_CLIENT_ID_REQUIRED"), path: "clientId" });
  }
  if (!data.mailboxAddress || !EMAIL_PATTERN.test(data.mailboxAddress)) {
    issues.push({
      message: t("NEW_CONFIGURATION.ERROR_MAILBOX_ADDRESS_INVALID"),
      path: "mailboxAddress",
    });
  }
  const secretIssue = clientSecretIssue(
    t,
    data.clientSecret,
    hasClientSecretOnFile,
    needsNewClientSecret,
  );
  if (secretIssue) issues.push(secretIssue);
  return issues;
};

const createSchema = ({
  t,
  hasClientSecretOnFile,
  needsNewClientSecret = false,
}: {
  t: TranslateFn;
  hasClientSecretOnFile: boolean;
  /** The linked secret is archived or missing, so the required-secret error explains a repair. */
  needsNewClientSecret?: boolean;
}) =>
  z
    .object({
      configurationName: z
        .string()
        .min(3, { message: t("NEW_CONFIGURATION.ERROR_NAME_MIN") })
        .max(100, { message: t("NEW_CONFIGURATION.ERROR_NAME_MAX") }),
      host: z.string().regex(/^([\w-]+\.)*[\w-]+\.[a-z]{2,}$/, {
        message: t("NEW_CONFIGURATION.ERROR_HOST_INVALID"),
      }),
      port: z.coerce
        .number<number>()
        .min(1, { message: t("NEW_CONFIGURATION.ERROR_PORT_RANGE") })
        .max(65535, { message: t("NEW_CONFIGURATION.ERROR_PORT_RANGE") }),
      enableSSL: z.boolean(),
      senderName: z.string().optional(),
      senderAddress: z.string().optional(),
      senderUserName: z.string().optional(),
      accountPassword: z.string().optional(),
      isInbound: z.boolean(),
      provider: z.coerce.number<number>(),
      authenticationType: z.coerce.number<number>().optional(),
      tenantId: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      mailboxAddress: z.string().optional(),
      isOrganizationDefault: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      const issues = [
        ...providerIssues(t, data),
        ...senderIssues(t, data),
        ...(usesPasswordAuthentication(data.provider, data.isInbound, data.authenticationType)
          ? passwordIssues(t, data)
          : oauthIssues(t, data, hasClientSecretOnFile, needsNewClientSecret)),
      ];
      for (const issue of issues) {
        ctx.addIssue({ code: "custom", message: issue.message, path: [issue.path] });
      }
    });

const clientSecretPlaceholderKey = (needsNew: boolean, keepsOnFile: boolean) => {
  if (needsNew) return "NEW_CONFIGURATION.PLACEHOLDER_NEW_CLIENT_SECRET";
  if (keepsOnFile) return "NEW_CONFIGURATION.PLACEHOLDER_KEEP_CLIENT_SECRET";
  return "NEW_CONFIGURATION.PLACEHOLDER_CLIENT_SECRET";
};

const submitLabelKey = (isPending: boolean, isEdit?: boolean) => {
  if (isPending) return isEdit ? "NEW_CONFIGURATION.UPDATING" : "NEW_CONFIGURATION.SAVING";
  return isEdit ? "NEW_CONFIGURATION.UPDATE_CHANGES" : "common:SAVE";
};

/** An edit keeps the stored organization; a create starts from the page's. */
const initialOrganizationId = (
  isEdit: boolean | undefined,
  previousData: IEmailConfig | undefined,
  organization: { id: string } | undefined,
) => (isEdit && previousData ? organizationOf(previousData) : (organization?.id ?? ""));

/** The save request for the form's values; `configurationId` is the edited record's id, if any. */
const buildSavePayload = (data: IEmailConfig, configurationId?: string): ISaveMailConfigPayload => {
  const transport = getFixedTransport(data.provider, data.isInbound);
  const options = getAuthenticationOptions(data.provider, data.isInbound);
  const selectedAuthentication =
    data.authenticationType !== undefined && options.includes(data.authenticationType)
      ? data.authenticationType
      : options[0];

  const payload: ISaveMailConfigPayload = {
    configurationName: data.configurationName,
    configurationId: configurationId ?? "",
    host: transport?.host ?? data.host,
    port: transport?.port ?? data.port,
    enableSSL: transport?.enableSSL ?? data.enableSSL,
    senderName: data.senderName || "",
    senderAddress: data.senderAddress || "",
    isInbound: data.isInbound,
    provider: data.provider,
    authenticationType: selectedAuthentication,
    securityMode: transport?.securityMode ?? MailSecurityMode.Legacy,
  };

  if (selectedAuthentication === MailAuthenticationType.Password) {
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
  return payload;
};

interface OrganizationFieldProps {
  isEdit: boolean;
  organization: { id: string; name: string };
  organizationId: string;
  /** The page organization's name while it is the one selected. */
  hintName?: string;
  errorKey: string | null;
  projectKey: string;
  onChange: (organizationId: string) => void;
}

/** Organization: picked on create (pre-filled from the page), read-only on edit. */
function OrganizationField({
  isEdit,
  organization,
  organizationId,
  hintName,
  errorKey,
  projectKey,
  onChange,
}: Readonly<OrganizationFieldProps>) {
  const { t } = useT("os.communication.mail");
  // The Default organization's configurations are shared, so no "only".
  const showHint = !!hintName && organizationId !== DEFAULT_ORGANIZATION_ID;
  return (
    <div className="mb-4 flex flex-col gap-2">
      <Label
        htmlFor="mail-configuration-organization"
        className="text-left font-medium text-high-emphasis"
      >
        {t("NEW_CONFIGURATION.ORGANIZATION")} <span className="text-destructive">*</span>
      </Label>
      {isEdit ? (
        <>
          {/* Read-only, not disabled: it stays focusable and readable under its label. */}
          <Input
            id="mail-configuration-organization"
            value={organization.name}
            readOnly
            className="border-default mt-1 border shadow-none"
          />
          <p className="text-sm text-muted-foreground">
            {t("NEW_CONFIGURATION.ORGANIZATION_READ_ONLY")}
          </p>
        </>
      ) : (
        <>
          <OrganizationCombobox
            id="mail-configuration-organization"
            projectKey={projectKey}
            value={organizationId}
            onValueChange={onChange}
            excludeNotEnabled
            defaultOptionLabel={t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION")}
          />
          {showHint && (
            <p className="text-sm text-muted-foreground">
              {t("NEW_CONFIGURATION.ORGANIZATION_HINT", { organization: hintName })}
            </p>
          )}
        </>
      )}
      {errorKey && <p className="text-sm font-medium text-destructive">{t(errorKey)}</p>}
    </div>
  );
}

interface OrganizationDefaultFieldProps {
  control: Control<IEmailConfig>;
  hintName?: string;
  /** A create for an organization without a default: the hint says this one becomes it. */
  isFirstDefault: boolean;
}

/** "Use as organization default", for outbound configurations in multi-org projects. */
function OrganizationDefaultField({
  control,
  hintName,
  isFirstDefault,
}: Readonly<OrganizationDefaultFieldProps>) {
  const { t } = useT("os.communication.mail");
  const hintKey = isFirstDefault
    ? "NEW_CONFIGURATION.ORGANIZATION_DEFAULT_HINT_FIRST"
    : "NEW_CONFIGURATION.ORGANIZATION_DEFAULT_HINT";
  return (
    <div className="mt-4">
      <FormField
        name="isOrganizationDefault"
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Checkbox
                className="mr-2"
                checked={!!field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            </FormControl>
            <FormLabel className="flex-start inline-flex">
              {t("NEW_CONFIGURATION.USE_AS_ORGANIZATION_DEFAULT")}
            </FormLabel>
            {hintName && (
              <p className="text-sm text-muted-foreground">
                {t(hintKey, { organization: hintName })}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

const NewConfiguration: React.FC<NewConfigurationProps> = ({
  dialogTitle,
  onClose,
  previousData,
  isEdit,
  organization,
  organizationHasDefault = false,
}) => {
  const { t } = useT("os.communication.mail");
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  // An edit keeps the stored organization; a create starts from the page's and may pick another.
  const [organizationId, setOrganizationId] = useState(() =>
    initialOrganizationId(isEdit, previousData, organization),
  );
  const [organizationErrorKey, setOrganizationErrorKey] = useState<string | null>(null);
  // const { saveEmailConfig, isPending } = useSaveEmailConfig();
  const { isPending, mutateAsync } = useSaveEmailConfig();

  // Only an existing record can have a secret on file, and the API reports it
  // as a flag because the value and its reference never leave the server.
  const hasClientSecretOnFile = Boolean(isEdit && previousData?.isClientSecretConfigured);
  // Repair mode: the reference points at an archived or missing secret. There is nothing to
  // keep, so a new value is required, and the server stores it as a new secret.
  const clientSecretStatus = isEdit ? previousData?.clientSecretStatus : undefined;
  const brokenClientSecretStatus = isBrokenLinkedSecretStatus(clientSecretStatus)
    ? clientSecretStatus
    : null;
  const needsNewClientSecret = !!brokenClientSecretStatus;
  const schema = useMemo(
    () =>
      createSchema({
        t,
        // A broken secret is never "on file", whatever the flag says.
        hasClientSecretOnFile: hasClientSecretOnFile && !needsNewClientSecret,
        needsNewClientSecret,
      }),
    [t, hasClientSecretOnFile, needsNewClientSecret],
  );
  const keepsSecretOnFile = hasClientSecretOnFile && !needsNewClientSecret;
  const clientSecretPlaceholder = t(
    clientSecretPlaceholderKey(needsNewClientSecret, keepsSecretOnFile),
  );
  const submitLabel = t(submitLabelKey(isPending, isEdit));

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
            authenticationType: previousData?.authenticationType,
            tenantId: previousData?.tenantId ?? "",
            clientId: previousData?.clientId ?? "",
            mailboxAddress: previousData?.mailboxAddress ?? "",
            // Never prefilled, for the same reason the password is not: a value
            // rendered here is a value that can be read back out.
            clientSecret: "",
            isOrganizationDefault: !!previousData?.isOrganizationDefault,
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
            authenticationType: MailAuthenticationType.Password,
            tenantId: "",
            clientId: "",
            mailboxAddress: "",
            clientSecret: "",
            // An organization's first configuration becomes its default unless unticked.
            isOrganizationDefault: !!organization && !organizationHasDefault,
          },
    resolver: zodResolver(schema) as unknown as Resolver<IEmailConfig>,
    mode: "onChange",
  });
  const isInbound = form.watch("isInbound");
  const provider = form.watch("provider");
  const authenticationType = form.watch("authenticationType");
  const authenticationOptions = getAuthenticationOptions(provider, isInbound);
  const usesPassword = usesPasswordAuthentication(provider, isInbound, authenticationType);
  const fixedTransport = getFixedTransport(provider, isInbound);
  const isGmail = provider === MailServiceProvider.Gmail;

  const availableProviders = useMemo(() => getMailProvidersFor(isInbound), [isInbound]);

  useEffect(() => {
    // Switching direction can leave a provider selected that the new direction
    // does not offer. Fall back to the first one that does.
    if (availableProviders.length > 0 && !availableProviders.some((p) => p.value === provider)) {
      form.setValue("provider", availableProviders[0].value, { shouldValidate: true });
    }
  }, [availableProviders, provider, form]);

  // The provider/direction the authentication method was last chosen for, so a
  // change resets it while the initial render keeps an edited record's method.
  const authenticationScope = useRef(`${provider}|${isInbound}`);

  useEffect(() => {
    // A provider or direction change starts from that provider's default (its
    // first option), and nothing may stay selected that is not offered, e.g. a
    // password on Office 365 inbound.
    const scope = `${provider}|${isInbound}`;
    const scopeChanged = authenticationScope.current !== scope;
    authenticationScope.current = scope;

    if (
      scopeChanged ||
      authenticationType === undefined ||
      !authenticationOptions.includes(authenticationType)
    ) {
      if (authenticationType !== authenticationOptions[0]) {
        form.setValue("authenticationType", authenticationOptions[0], { shouldValidate: true });
      }
    }
  }, [provider, isInbound, authenticationOptions, authenticationType, form]);

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
    return <div>{t("NEW_CONFIGURATION.LOADING")}</div>;
  }
  const formSubmitHandler = async (data: IEmailConfig) => {
    try {
      const payload = buildSavePayload(data, isEdit ? previousData?.itemId : undefined);
      if (organization) {
        payload.organizationId = organizationId;
        // Inbound configurations are never an organization's default.
        payload.isOrganizationDefault = !data.isInbound && !!data.isOrganizationDefault;
      }
      setOrganizationErrorKey(null);
      const res = await mutateAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: isEdit
            ? t("NEW_CONFIGURATION.UPDATED_SUCCESS")
            : t("NEW_CONFIGURATION.CREATED_SUCCESS"),
        });
        form.reset();
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showSaveErrors(error.errors);
      }
    }
  };
  /** Organization errors go under their fields as English keys; the rest keep going to the toast. */
  const showSaveErrors = (errors: Record<string, string | string[]>) => {
    const { fieldKeys, rest } = splitOrganizationErrors(errors);
    if (fieldKeys.OrganizationId) {
      setOrganizationErrorKey(fieldKeys.OrganizationId);
    }
    if (fieldKeys.IsOrganizationDefault) {
      form.setError("isOrganizationDefault", { message: t(fieldKeys.IsOrganizationDefault) });
    }
    if (Object.keys(rest).length > 0) {
      showErrorToast({ errors: rest });
    }
  };
  const organizationHintName = organization?.id === organizationId ? organization?.name : undefined;
  // Another organization than the page's: its default is unknown here, so the option starts
  // unticked rather than silently replacing that organization's default.
  const changeOrganization = (nextOrganizationId: string) => {
    setOrganizationId(nextOrganizationId);
    setOrganizationErrorKey(null);
    form.setValue(
      "isOrganizationDefault",
      nextOrganizationId === organization?.id ? !organizationHasDefault : false,
    );
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
                {organization && (
                  <OrganizationField
                    isEdit={!!isEdit}
                    organization={organization}
                    organizationId={organizationId}
                    hintName={organizationHintName}
                    errorKey={organizationErrorKey}
                    projectKey={tenantId}
                    onChange={changeOrganization}
                  />
                )}
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    name="configurationName"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          {" "}
                          {t("common:NAME")} <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="configName"
                            placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_NAME")}
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
                          {t("common:TYPE")} <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "true")}
                          value={field.value ? "true" : "false"}
                        >
                          <FormControl>
                            <SelectTrigger className="border-default col-span-3 mt-1 border shadow-none">
                              <SelectValue placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_TYPE")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">{t("NEW_CONFIGURATION.INBOUND")}</SelectItem>
                            <SelectItem value="false">{t("NEW_CONFIGURATION.OUTBOUND")}</SelectItem>
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
                          {t("NEW_CONFIGURATION.PROVIDER")}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="border-default col-span-3 mt-1 border shadow-none">
                              <SelectValue
                                placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_PROVIDER")}
                              />
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
                          {isInbound
                            ? t("NEW_CONFIGURATION.SERVER_NAME")
                            : t("NEW_CONFIGURATION.HOST")}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              isInbound
                                ? t("NEW_CONFIGURATION.PLACEHOLDER_SERVER_NAME")
                                : t("NEW_CONFIGURATION.PLACEHOLDER_HOST")
                            }
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
                          {t("NEW_CONFIGURATION.PORT")} <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_PORT")}
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
                {authenticationOptions.length > 1 && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <FormField
                      name="authenticationType"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-left font-medium text-high-emphasis">
                            {t("NEW_CONFIGURATION.AUTHENTICATION")}{" "}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value?.toString()}
                            // The server refuses to switch an existing record's
                            // method, since that would strand or lack a secret.
                            disabled={isEdit}
                          >
                            <FormControl>
                              <SelectTrigger className="border-default col-span-3 mt-1 border shadow-none">
                                <SelectValue
                                  placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_AUTHENTICATION")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {authenticationOptions.map((option) => (
                                <SelectItem key={option} value={option.toString()}>
                                  {getMailAuthenticationLabel(option)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
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
                              {t("NEW_CONFIGURATION.SENDER_NAME")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_SENDER_NAME")}
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
                              {t("NEW_CONFIGURATION.SENDER_ADDRESS")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_SENDER_ADDRESS")}
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
                              {isInbound
                                ? t("NEW_CONFIGURATION.USERNAME")
                                : t("NEW_CONFIGURATION.SENDER_USERNAME")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={
                                  isInbound
                                    ? t("NEW_CONFIGURATION.PLACEHOLDER_USERNAME")
                                    : t("NEW_CONFIGURATION.PLACEHOLDER_SENDER_USERNAME")
                                }
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
                              {isGmail
                                ? t("NEW_CONFIGURATION.APP_PASSWORD")
                                : t("NEW_CONFIGURATION.ACCOUNT_PASSWORD")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={
                                  isGmail
                                    ? t("NEW_CONFIGURATION.PLACEHOLDER_APP_PASSWORD")
                                    : t("NEW_CONFIGURATION.PLACEHOLDER_PASSWORD")
                                }
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            {isGmail && (
                              <p className="mt-1 text-xs text-medium-emphasis">
                                {t("NEW_CONFIGURATION.APP_PASSWORD_HINT")}
                              </p>
                            )}
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
                              {t("NEW_CONFIGURATION.TENANT_ID")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_TENANT_ID")}
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
                              {t("NEW_CONFIGURATION.CLIENT_ID")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_CLIENT_ID")}
                                className="border-default col-span-3 mt-1 border shadow-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {brokenClientSecretStatus && (
                      <Banner variant="warning" compact className="mb-0 mt-4">
                        {LINKED_SECRET_REPAIR_NOTICE[brokenClientSecretStatus]}
                      </Banner>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <FormField
                        name="clientSecret"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-left font-medium text-high-emphasis">
                              {t("NEW_CONFIGURATION.CLIENT_SECRET")}{" "}
                              {keepsSecretOnFile ? null : (
                                <span className="text-destructive">*</span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={clientSecretPlaceholder}
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
                              {t("NEW_CONFIGURATION.MAILBOX_ADDRESS")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("NEW_CONFIGURATION.PLACEHOLDER_MAILBOX_ADDRESS")}
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
                          <FormLabel className="flex-start inline-flex">
                            {" "}
                            {t("NEW_CONFIGURATION.ENABLE_SSL")}{" "}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                {organization && !isInbound && (
                  <OrganizationDefaultField
                    control={form.control}
                    hintName={organizationHintName}
                    isFirstDefault={!isEdit && !organizationHasDefault}
                  />
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <div className="flex flex-row justify-end gap-2">
              <DialogTrigger asChild>
                <Button variant="outline" size="default" disabled={isPending}>
                  {t("common:CANCEL")}
                </Button>
              </DialogTrigger>
              {/* In repair mode the button stays enabled so an empty submit can explain, inline,
                  that a new secret is required — rather than sitting disabled with no reason. */}
              <Button
                disabled={isPending || (!needsNewClientSecret && !form.formState.isValid)}
                size="default"
              >
                {submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
};
export default NewConfiguration;
