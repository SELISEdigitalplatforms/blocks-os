import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { ClientCredentialPermissionsSection } from "@blocks-idp/authentication/components/create-client-credential/client-credential-permissions-section";
import { ClientCredentialRolesSection } from "@blocks-idp/authentication/components/create-client-credential/client-credential-roles-section";
import { useGetAuthOidcCredentials } from "@blocks-idp/authentication/hooks/use-auth-oidc";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useEffect, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { SignupLinkConfigurationFormValues } from "./configuration-form-schema";

type Props = {
  form: UseFormReturn<SignupLinkConfigurationFormValues>;
  formLevelError?: string | null;
};

/** The red marker the rest of the console uses on mandatory fields. */
const Required = () => <span className="text-destructive"> *</span>;

export const ConfigurationFormFields = ({ form, formLevelError }: Props) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const mode = form.watch("mode");
  const selectedClientId = form.watch("clientId");

  const { data: oidcData, isLoading: clientsLoading } = useGetAuthOidcCredentials({
    projectKey: tenantId,
  });

  // A signup link lands a browser on a client's registered redirect, so a device-flow client
  // (no browser redirect) and an inactive one are not valid targets. IAM rejects both anyway;
  // leaving them out means the rejection never has to happen.
  const clients = useMemo(() => {
    const raw = oidcData?.oIDCClientCredentials;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
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
    const uris = selectedClient.redirectUris?.length
      ? selectedClient.redirectUris
      : selectedClient.redirectUri
        ? [selectedClient.redirectUri]
        : [];
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
              Name
              <Required />
            </FormLabel>
            <FormControl>
              <Input {...field} placeholder="Partner onboarding" />
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
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea {...field} placeholder="Optional description" />
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
              Mode
              <Required />
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="mode-select">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Oidc">OIDC application</SelectItem>
                <SelectItem value="Embedded">Embedded construct</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              {field.value === "Embedded"
                ? "The construct hosts its own join screen and receives tokens directly."
                : "The invitee is signed in through the OIDC application below."}
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
                  Client
                  <Required />
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="client-select">
                      <SelectValue
                        placeholder={clientsLoading ? "Loading clients…" : "Select an OIDC client"}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.itemId} value={client.itemId}>
                        {client.clientDisplayName || client.itemId}
                      </SelectItem>
                    ))}
                    {/* An archived or deleted client would otherwise vanish from the form and
                        be PATCHed away on the next save. */}
                    {field.value && !clients.some((c) => c.itemId === field.value) && (
                      <SelectItem value={field.value}>{field.value} (unavailable)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormDescription>
                  The application the invitee is signed in to when they open the link.
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
                  Redirect URI
                  <Required />
                </FormLabel>
                {redirectOptions.length > 0 ? (
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="redirect-select">
                        <SelectValue placeholder="Select a registered redirect URI" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {redirectOptions.map((uri) => (
                        <SelectItem key={uri} value={uri}>
                          {uri}
                        </SelectItem>
                      ))}
                      {field.value && !redirectOptions.includes(field.value) && (
                        <SelectItem value={field.value}>{field.value} (unregistered)</SelectItem>
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
                    ? "Must be one of this client's registered redirect URIs."
                    : "Choose a client first to list its registered redirect URIs."}
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
              <FormLabel>Join URL</FormLabel>
              <FormControl>
                <Input {...field} placeholder="https://app.example.com/join (optional)" />
              </FormControl>
              <FormDescription>
                Where your construct hosts its join screen. Used only to build the link handed
                back at generation — leave it empty to compose the link yourself.
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
            <FormLabel>Forwarded path</FormLabel>
            <FormControl>
              <Input {...field} placeholder="/welcome (optional)" />
            </FormControl>
            <FormDescription>Where inside the application the invitee lands.</FormDescription>
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
              Credential mode
              <Required />
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select credential mode" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Passwordless">Passwordless</SelectItem>
                <SelectItem value="PasswordRequired">Password required</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="defaultLifetimeMinutes"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Lifetime (minutes)
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
            <FormDescription>Between 5 and 10080 (7 days).</FormDescription>
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
              label="Default roles"
              // Not marked required: a configuration may grant no roles by default and rely
              // on the generating service to supply them per link.
              required={false}
              description="Granted to the invitee unless the service generating the link sends its own."
              emptyTitle="No default roles"
              emptyHint="Links from this configuration will grant only what the caller sends"
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
              label="Default permissions"
              description="Granted alongside the roles above unless the caller sends its own."
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
