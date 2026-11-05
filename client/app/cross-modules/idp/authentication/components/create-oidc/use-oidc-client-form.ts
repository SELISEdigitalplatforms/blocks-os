import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import type {
  IOidcConfig,
  ISaveOidcCredentialPayload,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  useGetAuthOidcCredential,
  useSaveAuthOidc,
} from "@blocks-idp/authentication/hooks/use-auth-oidc";
import { useGetAuthConfig } from "@blocks-idp/authentication/hooks/use-auth-config";
import { normalizeAuthConfigResponse } from "@blocks-idp/settings/utils/normalize-auth-config";
import {
  ApplicationType,
  buildLoginPolicyFields,
  buildTokenLifetimesPayload,
  createOIDCFormDefaultValue,
  CreateOIDCFormValues,
  createOidcSchema,
  deriveApplicationType,
  getRedirectUriSchema,
  loginPolicyToForm,
  type TokenLifetimeFormValues,
  tokenLifetimesToForm,
} from "./utils";
import type { OneTimeSecret } from "../one-time-secret-dialog";
import { maskId } from "../../utils/mask-id.util";

const I18N_MODULE = "os.idp.create-oidc";

export type TokenLifetimeMode = "project" | "custom";

const hasAnyLifetime = (values: TokenLifetimeFormValues) =>
  Object.values(values).some((value) => value.trim() !== "");

const modeForLifetimes = (values: TokenLifetimeFormValues): TokenLifetimeMode =>
  hasAnyLifetime(values) ? "custom" : "project";

const toProjectConfig = (raw: Parameters<typeof normalizeAuthConfigResponse>[0] | undefined) =>
  raw ? normalizeAuthConfigResponse(raw) : undefined;

/** The saved redirect URIs, the older single-URI field, or one empty row to type into. */
const storedRedirectUris = (credential: IOidcConfig): string[] => {
  if (credential.redirectUris?.length) return credential.redirectUris;
  return credential.redirectUri ? [credential.redirectUri] : [""];
};

/** Device-flow clients have no response type; others default to the authorization code. */
const storedResponseTypes = (credential: IOidcConfig): string[] => {
  if (credential.isDeviceFlowClient) return [];
  return credential.allowedResponseTypes?.length ? credential.allowedResponseTypes : ["code"];
};

type UseOidcClientFormArgs = {
  /** The client being edited; none creates a new one. */
  itemId?: string;
  /** Loads and resets only while the dialog is open or the page is shown. */
  active: boolean;
  /** After a successful save. A new client hands back its secret, the only time the API sends it. */
  onSaved: (createdSecret: OneTimeSecret | null) => void;
};

/**
 * The OIDC client form: load, reset, application type rules and save. Shared by the create dialog
 * and the edit page, so both send exactly the same payload.
 */
export const useOidcClientForm = ({ itemId, active, onSaved }: UseOidcClientFormArgs) => {
  const { t } = useT(I18N_MODULE);
  const [tokenMode, setTokenMode] = useState<TokenLifetimeMode>("project");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useSaveAuthOidc();
  // Guards against a second POST while a save is still in flight (C12).
  const submittingRef = useRef(false);
  const isEditMode = !!itemId;
  const { data: existingOidc, isLoading } = useGetAuthOidcCredential(
    { projectKey: tenantId, clientId: itemId! },
    active && isEditMode,
  );
  const { data: authConfig } = useGetAuthConfig({ projectKey: tenantId }, active);
  const projectConfig = toProjectConfig(authConfig);

  const form = useForm<CreateOIDCFormValues>({
    resolver: zodResolver(createOidcSchema),
    mode: "onChange",
    defaultValues: createOIDCFormDefaultValue,
  });

  const redirectUris = useFieldArray({ control: form.control, name: "redirectUris" });

  const isDeviceFlowClient = form.watch("isDeviceFlowClient");
  const applicationType = form.watch("applicationType");
  const isMobile = applicationType === "mobile";

  const handleApplicationTypeChange = (next: ApplicationType) => {
    form.setValue("applicationType", next, { shouldDirty: true, shouldValidate: true });
    if (next === "mobile") {
      form.setValue("requirePkce", true, { shouldDirty: true });
      form.setValue("registerAsIdentityProvider", false, { shouldDirty: true });
    }
    // Re-check the entries already typed so a type switch flags (or clears) them at once.
    const filled = form
      .getValues("redirectUris")
      .map((entry, idx) => (entry.value.trim() ? idx : -1))
      .filter((idx) => idx >= 0)
      .map((idx) => `redirectUris.${idx}.value` as const);
    if (filled.length) void form.trigger(filled);
  };

  useEffect(() => {
    if (isEditMode && existingOidc?.oIDCClientCredential && active) {
      const credential = existingOidc.oIDCClientCredential;
      const loadedApplicationType = deriveApplicationType(credential);
      const loadedTokenLifetimes = tokenLifetimesToForm(existingOidc.tokenLifetimes);
      form.reset({
        redirectUris: storedRedirectUris(credential).map((u) => ({ value: u })),
        scope: credential.scope || "openid",
        clientDisplayName: credential.clientDisplayName || "",
        isAutoRedirect: !credential.isDeviceFlowClient && (credential.isAutoRedirect ?? false),
        isActive: credential.isActive ?? true,
        requirePkce: credential.requirePkce ?? true,
        registerAsIdentityProvider: credential.registerAsIdentityProvider ?? false,
        isDeviceFlowClient: credential.isDeviceFlowClient ?? false,
        allowedResponseTypes: storedResponseTypes(credential),
        applicationType: loadedApplicationType,
        storedClientType: credential.clientType ?? null,
        storedUseTokensCookie: credential.useTokensCookie ?? true,
        loadedApplicationType,
        ...loadedTokenLifetimes,
        loadedTokenLifetimes,
        ...loginPolicyToForm(existingOidc.loginPolicy),
      });
      const loadedMode = modeForLifetimes(loadedTokenLifetimes);
      setTokenMode(loadedMode);
      // A stored value the rules reject is flagged at once, not only after the user edits it.
      if (loadedMode === "custom") {
        void form.trigger([
          "accessTokenLifetime",
          "refreshTokenLifetime",
          "absoluteRefreshTokenLifetime",
        ]);
      }
    } else if (!isEditMode && active) {
      form.reset(createOIDCFormDefaultValue);
      setTokenMode("project");
    }
  }, [existingOidc, isEditMode, active, form]);

  const buildClientTypeFields = (
    data: CreateOIDCFormValues,
  ): Pick<
    ISaveOidcCredentialPayload,
    "clientType" | "useTokensCookie" | "requirePkce" | "registerAsIdentityProvider"
  > => {
    // Spec 6.4 payload mapping.
    if (data.isDeviceFlowClient) {
      return {
        ...(isEditMode ? { clientType: data.storedClientType } : {}),
        useTokensCookie: data.storedUseTokensCookie,
        requirePkce: false,
        registerAsIdentityProvider: false,
      };
    }
    if (data.applicationType === "mobile") {
      return {
        clientType: "public",
        useTokensCookie: false,
        requirePkce: true,
        registerAsIdentityProvider: false,
      };
    }
    const keepStored = isEditMode && data.loadedApplicationType === "web";
    return {
      clientType: keepStored ? data.storedClientType : "confidential",
      useTokensCookie: keepStored ? data.storedUseTokensCookie : true,
      requirePkce: data.requirePkce,
      registerAsIdentityProvider: data.registerAsIdentityProvider,
    };
  };

  const flagRedirectUris = (data: CreateOIDCFormValues): boolean => {
    if (data.isDeviceFlowClient) return true;
    const redirectResult = getRedirectUriSchema(data.applicationType).safeParse(data.redirectUris);
    if (redirectResult.success) return true;
    redirectResult.error.issues.forEach((issue) => {
      const path = issue.path as (string | number)[];
      form.setError(
        `redirectUris.${path[0]}.value` as keyof CreateOIDCFormValues,
        { type: "validate", message: issue.message },
        { shouldFocus: true },
      );
    });
    return false;
  };

  const onSubmit = async (data: CreateOIDCFormValues) => {
    if (submittingRef.current) return;
    if (!flagRedirectUris(data)) return;
    const isDeviceFlowClient = data.isDeviceFlowClient;
    submittingRef.current = true;
    try {
      // Sent only when a lifetime input changed; otherwise the server keeps the stored values.
      const tokenLifetimes = buildTokenLifetimesPayload(data, data.loadedTokenLifetimes);
      const payload: ISaveOidcCredentialPayload = {
        redirectUris: isDeviceFlowClient
          ? []
          : data.redirectUris.map((entry) => entry.value.trim()).filter(Boolean),
        scope: data.scope,
        isAutoRedirect: !isDeviceFlowClient && data.isAutoRedirect,
        isActive: data.isActive,
        ...buildClientTypeFields(data),
        isDeviceFlowClient,
        allowedResponseTypes: isDeviceFlowClient ? [] : data.allowedResponseTypes,
        itemId: isEditMode ? itemId : "",
        clientDisplayName: data.clientDisplayName,
        ...(tokenLifetimes ? { tokenLifetimes } : {}),
        // Always sent from this form; device-flow clients have no sign-in rule.
        ...buildLoginPolicyFields(data),
      };
      const res = await mutateAsync(payload);
      if (!res.isSuccess) {
        showErrorToast({ errors: res.error });
        return;
      }
      const message = isEditMode ? t("CREATE_OIDC.TOAST_UPDATED") : t("CREATE_OIDC.TOAST_CREATED");
      showSuccessToast({ description: message });
      // Create is the only time the API returns the secret; list and get never do.
      const createdSecret: OneTimeSecret | null =
        !isEditMode && res.clientSecret
          ? {
              label: data.clientDisplayName || maskId(res.itemId),
              clientId: res.itemId ?? "",
              clientSecret: res.clientSecret,
              reason: "created",
            }
          : null;
      if (!isEditMode) form.reset();
      onSaved(createdSecret);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: t("CREATE_OIDC.ERROR_GENERIC") });
    } finally {
      submittingRef.current = false;
    }
  };

  return {
    form,
    redirectUris,
    tokenMode,
    setTokenMode,
    projectConfig,
    tenantId,
    isEditMode,
    isDeviceFlowClient,
    applicationType,
    isMobile,
    handleApplicationTypeChange,
    submit: form.handleSubmit(onSubmit),
    isPending,
    isLoading,
    loaded: existingOidc,
  };
};

export type OidcClientFormController = ReturnType<typeof useOidcClientForm>;
