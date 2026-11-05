import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { format } from "date-fns";
import { ChevronLeft, Shield } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Form } from "@/components/ui-kits/form/form";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { cn } from "@/lib/utils";
import type { IOidcConfig } from "@blocks-idp/authentication/models/auth.oidc.model";
import type { IOidcClientLoginPolicy } from "@blocks-idp/authentication/models/login-policy.model";
import { describeClientLoginPolicy } from "@blocks-idp/authentication/utils/login-policy.util";
import {
  useOidcClientForm,
  type OidcClientFormController,
} from "../create-oidc/use-oidc-client-form";
import { OidcSignInSection } from "../create-oidc/oidc-sign-in-section";
import {
  ApplicationTypeField,
  AutoRedirectField,
  ClientNameField,
  DeviceFlowField,
  IdentityProviderField,
  PkceField,
  RedirectUrisField,
  ScopeField,
  StatusField,
  TokenLifetimesSection,
} from "../create-oidc/oidc-client-fields";
import { deriveApplicationType } from "../create-oidc/utils";
import { maskId } from "../../utils/mask-id.util";
import { OIDC_LIST_PATH } from "./oidc-client-route";

const I18N_MODULE = "os.idp.create-oidc";
const FORM_ID = "oidc-client-page-form";

type SectionId =
  "general" | "redirect-uris" | "sign-in" | "token-lifetimes" | "security" | "identity-provider";

type SectionEntry = { id: SectionId; title: string };

const sectionDomId = (id: SectionId) => `oidc-client-${id}`;

type SectionProps = Readonly<{
  id: SectionId;
  title: string;
  description: string;
  children: ReactNode;
}>;

const Section = ({ id, title, description, children }: SectionProps) => (
  <section
    id={sectionDomId(id)}
    aria-labelledby={`${sectionDomId(id)}-title`}
    className="scroll-mt-4 rounded-lg border bg-card p-5 sm:p-6"
  >
    <div className="mb-5 space-y-1">
      <h2 id={`${sectionDomId(id)}-title`} className="text-base font-semibold text-high-emphasis">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="space-y-5">{children}</div>
  </section>
);

const PageSkeleton = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-5"
      aria-busy="true"
      aria-label={t("OIDC_CLIENT_PAGE.LOADING")}
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
};

const NotFound = ({ listPath }: Readonly<{ listPath: string }>) => {
  const { t } = useT(I18N_MODULE);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 rounded-lg border bg-card p-6">
      <h1 className="text-base font-semibold text-high-emphasis">
        {t("OIDC_CLIENT_PAGE.NOT_FOUND_TITLE")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("OIDC_CLIENT_PAGE.NOT_FOUND_MESSAGE")}</p>
      <Button asChild variant="outline" size="sm">
        <Link to={listPath}>{t("OIDC_CLIENT_PAGE.BACK")}</Link>
      </Button>
    </div>
  );
};

type HeaderProps = Readonly<{
  clientId: string;
  name: string;
  credential: IOidcConfig;
  loginPolicy?: IOidcClientLoginPolicy | null;
}>;

/** Name, status and kind of the saved client, its id to copy, and its sign-in rule in short. */
const OidcClientHeader = ({ clientId, name, credential, loginPolicy }: HeaderProps) => {
  const { t } = useT(I18N_MODULE);
  const appType = (): string => {
    if (credential.isDeviceFlowClient) return t("CREATE_OIDC.DEVICE_FLOW");
    return deriveApplicationType(credential) === "mobile"
      ? t("CREATE_OIDC.APP_TYPE_MOBILE")
      : t("CREATE_OIDC.APP_TYPE_WEB");
  };
  const created = credential.createdDate
    ? format(new Date(credential.createdDate), "dd MMM yyyy")
    : "";

  return (
    <header className="flex items-start gap-3 rounded-lg border bg-card p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Shield className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-all text-xl font-semibold text-high-emphasis">{name}</h1>
          <Badge variant="outline" className="gap-1.5 font-medium">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                credential.isActive ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
            {credential.isActive ? t("CREATE_OIDC.ACTIVE") : t("OIDC_CLIENT_PAGE.INACTIVE")}
          </Badge>
          <Badge variant="outline" className="font-medium">
            {appType()}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            {t("OIDC_CLIENT_PAGE.CLIENT_ID")}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-high-emphasis">
              {maskId(clientId)}
            </code>
            <CopyToClipboardButton textToCopy={clientId}>
              <span />
            </CopyToClipboardButton>
          </span>
          {created && <span>{t("OIDC_CLIENT_PAGE.CREATED", { date: created })}</span>}
          {!credential.isDeviceFlowClient && (
            <span>
              {t("OIDC_CLIENT_PAGE.SIGN_IN_SUMMARY", {
                summary: describeClientLoginPolicy(loginPolicy),
              })}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

type SectionNavProps = Readonly<{
  sections: SectionEntry[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
}>;

const SectionNav = ({ sections, active, onSelect }: SectionNavProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <nav
      aria-label={t("OIDC_CLIENT_PAGE.SECTIONS")}
      className="hidden w-52 shrink-0 flex-col gap-0.5 rounded-lg border bg-card p-2 lg:flex"
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelect(section.id)}
          aria-current={active === section.id ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
            active === section.id
              ? "bg-primary/10 font-medium text-primary"
              : "text-medium-emphasis",
          )}
        >
          {section.title}
        </button>
      ))}
    </nav>
  );
};

type OidcClientSectionsProps = Readonly<{
  ctl: OidcClientFormController;
  titleOf: (id: SectionId) => string;
  listPath: string;
}>;

/** The form itself: the same fields as the create dialog, grouped into sections. */
const OidcClientSections = ({ ctl, titleOf, listPath }: OidcClientSectionsProps) => {
  const { t } = useT(I18N_MODULE);
  const { form, isDeviceFlowClient, isMobile, isPending } = ctl;
  const { isValid, isSubmitting } = form.formState;

  return (
    <Form {...form}>
      <form id={FORM_ID} onSubmit={ctl.submit} className="min-w-0 flex-1 space-y-5">
        <Section
          id="general"
          title={titleOf("general")}
          description={t("OIDC_CLIENT_PAGE.GENERAL_DESCRIPTION")}
        >
          <ClientNameField ctl={ctl} />
          <DeviceFlowField ctl={ctl} />
          {!isDeviceFlowClient && <ApplicationTypeField ctl={ctl} />}
        </Section>

        {!isDeviceFlowClient && (
          <Section
            id="redirect-uris"
            title={titleOf("redirect-uris")}
            description={t("OIDC_CLIENT_PAGE.REDIRECT_URIS_DESCRIPTION")}
          >
            <RedirectUrisField ctl={ctl} showLabel={false} />
          </Section>
        )}

        {!isDeviceFlowClient && (
          <Section
            id="sign-in"
            title={titleOf("sign-in")}
            description={t("OIDC_CLIENT_PAGE.SIGN_IN_DESCRIPTION")}
          >
            <OidcSignInSection form={form} tenantId={ctl.tenantId} showLabel={false} />
          </Section>
        )}

        <Section
          id="token-lifetimes"
          title={titleOf("token-lifetimes")}
          description={t("OIDC_CLIENT_PAGE.TOKEN_LIFETIMES_DESCRIPTION")}
        >
          <TokenLifetimesSection ctl={ctl} showLabel={false} />
        </Section>

        <Section
          id="security"
          title={titleOf("security")}
          description={t("OIDC_CLIENT_PAGE.SECURITY_DESCRIPTION")}
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <StatusField ctl={ctl} />
            <ScopeField ctl={ctl} />
            {!isDeviceFlowClient && <PkceField ctl={ctl} />}
            {!isDeviceFlowClient && <AutoRedirectField ctl={ctl} />}
          </div>
        </Section>

        {!isDeviceFlowClient && !isMobile && (
          <Section
            id="identity-provider"
            title={titleOf("identity-provider")}
            description={t("OIDC_CLIENT_PAGE.IDENTITY_PROVIDER_DESCRIPTION")}
          >
            <IdentityProviderField ctl={ctl} showLabel={false} />
          </Section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("OIDC_CLIENT_PAGE.SAVE_HINT")}</p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to={listPath}>{t("common:CANCEL")}</Link>
            </Button>
            <Button type="submit" disabled={!isValid || isPending || isSubmitting}>
              {t("common:UPDATE")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

/** Route element: /secret-management/oidc/clients/:clientId. */
export const OidcClientPage = () => {
  const { clientId = "" } = useParams<{ clientId: string }>();
  return <OidcClientEditor clientId={clientId} />;
};

/** Edits one OIDC client on a page of its own, one section per concern. */
export const OidcClientEditor = ({ clientId }: Readonly<{ clientId: string }>) => {
  const { t } = useT(I18N_MODULE);
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const listPath = scoped(OIDC_LIST_PATH);
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const ctl = useOidcClientForm({
    itemId: clientId,
    active: true,
    onSaved: () => {
      void navigate(listPath);
    },
  });
  const { form, isDeviceFlowClient, isMobile, isLoading, loaded } = ctl;
  const credential = loaded?.oIDCClientCredential;

  if (isLoading) return <PageSkeleton />;
  if (!credential) return <NotFound listPath={listPath} />;

  const browserApp = !isDeviceFlowClient;
  const sections: (SectionEntry & { visible: boolean })[] = [
    { id: "general", title: t("OIDC_CLIENT_PAGE.GENERAL"), visible: true },
    { id: "redirect-uris", title: t("CREATE_OIDC.REDIRECT_URIS"), visible: browserApp },
    { id: "sign-in", title: t("OIDC_SIGN_IN_SECTION.SIGN_IN"), visible: browserApp },
    { id: "token-lifetimes", title: t("CREATE_OIDC.TOKEN_LIFETIMES"), visible: true },
    { id: "security", title: t("OIDC_CLIENT_PAGE.SECURITY"), visible: true },
    {
      id: "identity-provider",
      title: t("CREATE_OIDC.IDENTITY_PROVIDER"),
      visible: browserApp && !isMobile,
    },
  ];
  const titleOf = (id: SectionId) => sections.find((section) => section.id === id)?.title ?? "";

  const goTo = (id: SectionId) => {
    setActiveSection(id);
    document
      .getElementById(sectionDomId(id))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const name = form.watch("clientDisplayName") || credential.clientDisplayName || maskId(clientId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link
        to={listPath}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-high-emphasis"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("OIDC_CLIENT_PAGE.BACK")}
      </Link>

      <OidcClientHeader
        clientId={clientId}
        name={name}
        credential={credential}
        loginPolicy={loaded?.loginPolicy}
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <SectionNav
          sections={sections.filter((section) => section.visible)}
          active={activeSection}
          onSelect={goTo}
        />
        <OidcClientSections ctl={ctl} titleOf={titleOf} listPath={listPath} />
      </div>
    </div>
  );
};
