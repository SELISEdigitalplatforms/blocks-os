import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { ClientCredentialPermissionsSection } from "@blocks-idp/authentication/components/create-client-credential/client-credential-permissions-section";
import { ClientCredentialRolesSection } from "@blocks-idp/authentication/components/create-client-credential/client-credential-roles-section";
import { useGetAuthOidcCredentials } from "@blocks-idp/authentication/hooks/use-auth-oidc";
import { IOidcConfig } from "@blocks-idp/authentication/models/auth.oidc.model";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { useEffect, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { SignupLinkConfigurationFormValues } from "./configuration-form-schema";

type Props = {
  form: UseFormReturn<SignupLinkConfigurationFormValues>;
  formLevelError?: string | null;
  /** While a save is in flight, the fields whose value was already read into the request lock. */
  isPending?: boolean;
};

/** The red marker the rest of the console uses on mandatory fields. */
const Required = () => <span className="text-destructive"> *</span>;

/**
 * A link finishes at /idp/callback through the identity provider that "Register as a Blocks OIDC
 * identity provider" creates for the client, so a client without it is shown but cannot be
 * picked. IAM refuses it on save either way.
 */
const isRegisteredProvider = (client: IOidcConfig) => client.registerAsIdentityProvider === true;

export const ConfigurationFormFields = ({ form, formLevelError, isPending = false }: Props) => {
  const { t } = useT("os.idp.signup-links");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const mode = form.watch("mode");
  const selectedClientId = form.watch("clientId");
  const credentialMode = form.watch("credentialMode");
  const requireExistingUserPassword = form.watch("requireExistingUserPassword");

  const { data: oidcData, isLoading: clientsLoading } = useGetAuthOidcCredentials({
    projectKey: tenantId,
  });

  // A signup link lands a browser on a client's registered redirect, so a device-flow client
  // (no browser redirect) and an inactive one are not valid targets. IAM rejects both anyway;
  // leaving them out means the rejection never has to happen.
  const clients = useMemo(() => {
    const raw = oidcData?.oIDCClientCredentials;
    let list: IOidcConfig[] = [];
    if (Array.isArray(raw)) list = raw;
    else if (raw) list = [raw];
    return list.filter((client) => client.isActive && !client.isDeviceFlowClient);
  }, [oidcData?.oIDCClientCredentials]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.itemId === selectedClientId),
    [clients, selectedClientId],
  );

  // A client's own registered URIs are the only legal values, so offering anything else just
  // produces "RedirectUri is not registered for this client" after a round trip.
  const redirectOptions = useMemo(() => {
    if (!selectedClient) return [];
    let uris: string[] = [];
    if (selectedClient.redirectUris?.length) uris = selectedClient.redirectUris;
    else if (selectedClient.redirectUri) uris = [selectedClient.redirectUri];
    return [...new Set(uris.filter(Boolean))];
  }, [selectedClient]);

  // Changing the client invalidates a redirect belonging to the previous one.
  useEffect(() => {
    if (mode !== "Oidc" || !selectedClientId) return;
    const current = form.getValues("redirectUri");
    if (current && !redirectOptions.includes(current)) {
      form.setValue("redirectUri", redirectOptions.length === 1 ? redirectOptions[0] : "", {
        shouldDirty: true,
      });
    } else if (!current && redirectOptions.length === 1) {
      form.setValue("redirectUri", redirectOptions[0], { shouldDirty: true });
    }
  }, [form, mode, redirectOptions, selectedClientId]);

  return (
    <div className="flex flex-col gap-5">
      {formLevelError && (
        <p className="text-sm text-destructive" role="alert" data-testid="form-level-error">
          {formLevelError}
        </p>
      )}

      <FormField
        name="name"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("common:NAME")}
              <Required />
            </FormLabel>
            <FormControl>
              <Input {...field} placeholder={t("CONFIGURATION_FORM_FIELDS.NAME_PLACEHOLDER")} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="description"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("common:DESCRIPTION")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder={t("CONFIGURATION_FORM_FIELDS.DESCRIPTION_PLACEHOLDER")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="mode"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("CONFIGURATION_FORM_FIELDS.MODE_LABEL")}
              <Required />
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="mode-select">
                  <SelectValue placeholder={t("CONFIGURATION_FORM_FIELDS.MODE_PLACEHOLDER")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {/* "Blocks OIDC" is the name the rest of the console already uses for this --
                    the client form offers "Register as a Blocks OIDC identity provider", and
                    that registration is exactly what this mode depends on. "Construct" is
                    left out of both labels: whoever is authoring an invitation is thinking
                    about their app, not about what the platform calls it. */}
                <SelectItem value="Oidc">{t("CONFIGURATION_FORM_FIELDS.MODE_OIDC")}</SelectItem>
                <SelectItem value="Embedded">
                  {t("CONFIGURATION_FORM_FIELDS.MODE_EMBEDDED")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              {field.value === "Embedded"
                ? t("CONFIGURATION_FORM_FIELDS.MODE_DESCRIPTION_EMBEDDED")
                : t("CONFIGURATION_FORM_FIELDS.MODE_DESCRIPTION_OIDC")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {mode === "Oidc" && (
        <>
          <FormField
            name="clientId"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("CONFIGURATION_FORM_FIELDS.CLIENT_LABEL")}
                  <Required />
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="client-select">
                      <SelectValue
                        placeholder={
                          clientsLoading
                            ? t("CONFIGURATION_FORM_FIELDS.CLIENTS_LOADING")
                            : t("CONFIGURATION_FORM_FIELDS.CLIENT_PLACEHOLDER")
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((client) => {
                      const registered = isRegisteredProvider(client);
                      // A saved value that cannot be picked is shown once, below.
                      if (!registered && client.itemId === field.value) return null;
                      return (
                        <SelectItem
                          key={client.itemId}
                          value={client.itemId}
                          disabled={!registered}
                        >
                          {client.clientDisplayName || client.itemId}
                          {!registered && (
                            <span className="text-muted-foreground">
                              {" "}
                              — {t("CONFIGURATION_FORM_FIELDS.UNREGISTERED_CLIENT_HINT")}
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                    {/* An archived, deleted or unregistered client would otherwise vanish from
                        the form and be PATCHed away on the next save. */}
                    {field.value &&
                      !clients.some((c) => c.itemId === field.value && isRegisteredProvider(c)) && (
                        <SelectItem value={field.value}>
                          {t("CONFIGURATION_FORM_FIELDS.CLIENT_UNAVAILABLE", {
                            name: selectedClient?.clientDisplayName || field.value,
                          })}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t("CONFIGURATION_FORM_FIELDS.CLIENT_DESCRIPTION")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="redirectUri"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("CONFIGURATION_FORM_FIELDS.REDIRECT_URI_LABEL")}
                  <Required />
                </FormLabel>
                {redirectOptions.length > 0 ? (
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="redirect-select">
                        <SelectValue
                          placeholder={t("CONFIGURATION_FORM_FIELDS.REDIRECT_URI_PLACEHOLDER")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {redirectOptions.map((uri) => (
                        <SelectItem key={uri} value={uri}>
                          {uri}
                        </SelectItem>
                      ))}
                      {field.value && !redirectOptions.includes(field.value) && (
                        <SelectItem value={field.value}>
                          {t("CONFIGURATION_FORM_FIELDS.REDIRECT_URI_UNREGISTERED", {
                            uri: field.value,
                          })}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <FormControl>
                    <Input {...field} placeholder="https://example.com/callback" />
                  </FormControl>
                )}
                <FormDescription>
                  {selectedClient
                    ? t("CONFIGURATION_FORM_FIELDS.REDIRECT_URI_DESCRIPTION")
                    : t("CONFIGURATION_FORM_FIELDS.REDIRECT_URI_CHOOSE_CLIENT")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {mode === "Embedded" && (
        <FormField
          name="joinUrl"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("CONFIGURATION_FORM_FIELDS.JOIN_URL_LABEL")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("CONFIGURATION_FORM_FIELDS.JOIN_URL_PLACEHOLDER")}
                />
              </FormControl>
              <FormDescription>
                {t("CONFIGURATION_FORM_FIELDS.JOIN_URL_DESCRIPTION")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        name="defaultForwardedTo"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("CONFIGURATION_FORM_FIELDS.FORWARDED_PATH_LABEL")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t("CONFIGURATION_FORM_FIELDS.FORWARDED_PATH_PLACEHOLDER")}
              />
            </FormControl>
            <FormDescription>
              {t("CONFIGURATION_FORM_FIELDS.FORWARDED_PATH_DESCRIPTION")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="credentialMode"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("CONFIGURATION_FORM_FIELDS.CREDENTIAL_MODE_LABEL")}
              <Required />
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="credential-mode-select">
                  <SelectValue
                    placeholder={t("CONFIGURATION_FORM_FIELDS.CREDENTIAL_MODE_PLACEHOLDER")}
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Passwordless">
                  {t("CONFIGURATION_FORM_FIELDS.CREDENTIAL_MODE_PASSWORDLESS")}
                </SelectItem>
                <SelectItem value="PasswordRequired">
                  {t("CONFIGURATION_FORM_FIELDS.CREDENTIAL_MODE_PASSWORD_REQUIRED")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {credentialMode === "PasswordRequired" && (
        <FormField
          name="signInAfterActivation"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("CONFIGURATION_FORM_FIELDS.AFTER_ACTIVATION_LABEL")}</FormLabel>
              <div className="flex items-start gap-2">
                <FormControl>
                  <Checkbox
                    id="signInAfterActivation"
                    className="mt-0.5 shrink-0"
                    data-testid="sign-in-after-activation"
                    checked={!!field.value}
                    onCheckedChange={(checked) => field.onChange(!!checked)}
                  />
                </FormControl>
                <label
                  htmlFor="signInAfterActivation"
                  className="cursor-pointer text-sm text-high-emphasis"
                >
                  {t("CONFIGURATION_FORM_FIELDS.AFTER_ACTIVATION_CHECKBOX")}
                </label>
              </div>
              <FormDescription>
                {t("CONFIGURATION_FORM_FIELDS.AFTER_ACTIVATION_DESCRIPTION")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Offered only for PasswordRequired: Passwordless issues no activation key, so there
          is no activation for this to act on and the server rejects it. */}

      {/* Shown in every mode and credential mode: it governs how a link treats someone who
          already has an account, which is independent of how new users get a password. */}
      <FormField
        name="requireExistingUserPassword"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-4 rounded-sm border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-sm">
                  {t("CONFIGURATION_FORM_FIELDS.EXISTING_PASSWORD_LABEL")}
                </FormLabel>
                <FormDescription className="text-xs">
                  {t("CONFIGURATION_FORM_FIELDS.EXISTING_PASSWORD_DESCRIPTION")}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  size="md"
                  data-testid="require-existing-user-password"
                  checked={field.value !== false}
                  onCheckedChange={(checked) => field.onChange(checked)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  disabled={isPending}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {requireExistingUserPassword === false && (
        <Banner
          variant="warning"
          className="mb-0"
          compact={false}
          title={t("CONFIGURATION_FORM_FIELDS.EXISTING_PASSWORD_WARNING_TITLE")}
        >
          {t("CONFIGURATION_FORM_FIELDS.EXISTING_PASSWORD_WARNING_BODY")}
        </Banner>
      )}

      <FormField
        name="defaultLifetimeMinutes"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("CONFIGURATION_FORM_FIELDS.LIFETIME_LABEL")}
              <Required />
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                {...field}
                value={field.value === undefined || field.value === null ? "" : field.value}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "") {
                    // Empty falls back to 1440 on submit rather than null.
                    field.onChange(1440);
                    return;
                  }
                  field.onChange(Number(raw));
                }}
              />
            </FormControl>
            <FormDescription>{t("CONFIGURATION_FORM_FIELDS.LIFETIME_DESCRIPTION")}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="defaultMaxRedemptions"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("CONFIGURATION_FORM_FIELDS.MAX_REDEMPTIONS_LABEL")}</FormLabel>
            <FormControl>
              <Input
                type="text"
                inputMode="numeric"
                data-testid="default-max-redemptions"
                placeholder={t("CONFIGURATION_FORM_FIELDS.MAX_REDEMPTIONS_PLACEHOLDER")}
                {...field}
                value={field.value ?? ""}
                disabled={isPending}
              />
            </FormControl>
            <FormDescription>
              {t("CONFIGURATION_FORM_FIELDS.MAX_REDEMPTIONS_DESCRIPTION")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="defaultRoles"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <ClientCredentialRolesSection
              selectedSlugs={field.value}
              onChange={field.onChange}
              label={t("CONFIGURATION_FORM_FIELDS.DEFAULT_ROLES_LABEL")}
              // Not marked required: a configuration may grant no roles by default and rely
              // on the generating service to supply them per link.
              required={false}
              description={t("CONFIGURATION_FORM_FIELDS.DEFAULT_ROLES_DESCRIPTION")}
              emptyTitle={t("CONFIGURATION_FORM_FIELDS.DEFAULT_ROLES_EMPTY_TITLE")}
              emptyHint={t("CONFIGURATION_FORM_FIELDS.DEFAULT_ROLES_EMPTY_HINT")}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="defaultPermissions"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <ClientCredentialPermissionsSection
              selectedResources={field.value}
              onChange={field.onChange}
              maxPermissions={50}
              label={t("CONFIGURATION_FORM_FIELDS.DEFAULT_PERMISSIONS_LABEL")}
              description={t("CONFIGURATION_FORM_FIELDS.DEFAULT_PERMISSIONS_DESCRIPTION")}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
