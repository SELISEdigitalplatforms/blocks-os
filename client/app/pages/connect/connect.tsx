import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CircleCheck, GitBranch, Loader2, Plug } from "lucide-react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import {
  ProjectEnvironmentCheckboxes,
  sortEnvironments,
} from "@/components/create-project/form/project-environment-checkboxes";
import { getEnvironmentOptions } from "@/components/create-project/form/create-project-environments-form/utils";
import { ProjectTermsCheckboxes } from "@/components/create-project/form/project-terms-checkboxes";
import { integrationConnectService } from "@/cross-modules/integration/services/integration-connect.service";
import {
  useApproveConnectRequest,
  useCancelConnectRequest,
  useConnectRequest,
  useReadinessWait,
  type ReadinessState,
} from "@/cross-modules/integration/hooks/use-connect";
import { projectService } from "@/services/project.service";
import { useCreateProject } from "@/hooks/use-project";
import { buildCreateProjectPayload } from "@/utils/create-project-payload";
import {
  clearPendingConnectRequest,
  readPendingConnectRequest,
  savePendingConnectRequest,
} from "@/lib/pending-connect";
import { hasErrorCode, isErrorWithErrors } from "@/lib/error";
import { showErrorToast } from "@/hooks/use-toast";
import { ConnectProjectPicker } from "./connect-project-picker";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const KEY_CONNECT_TO_BLOCKS_OS = "CONNECT.CONNECT_TO_BLOCKS_OS";
const KEY_CONNECT_WITH_BLOCKS_OS = "CONNECT.CONNECT_WITH_BLOCKS_OS";
const KEY_COMMON_RETRY = "common:RETRY";

const I18N_MODULE = "os.connect";

const PROJECTS_QUERY_KEY = ["identifier", "projects", "connect"] as const;
const environmentLabel = (value: string) =>
  getEnvironmentOptions().find((option) => option.value === value)?.label ?? value;

/**
 * The "Connect with Blocks OS" page (P3-11 entry, P3-13 approve screen, P3-14 no-project branch,
 * P3-15 readiness wait). Reached from a CMS redirect; every step must survive a login
 * round-trip via the localStorage pending-request hand-off.
 */
const createdBannerKey = (hasGroup: boolean, loadFailed: boolean) => {
  if (hasGroup) return "CONNECT.CHOOSE_AN_ENVIRONMENT_FOR_TO";
  return loadFailed
    ? "CONNECT.COULD_NOT_LOAD_ENVIRONMENTS_FOR"
    : "CONNECT.LOADING_ENVIRONMENTS_FOR";
};

const connectLabelKey = (isConnecting: boolean, isChecking: boolean) => {
  if (isConnecting) return "CONNECT.CONNECTING";
  return isChecking ? "CONNECT.CHECKING" : "CONNECT.CONNECT";
};

export default function ConnectPage() {
  const { t } = useT(I18N_MODULE);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  // ── Entry step (P3-11) ──
  const [requestId, setRequestId] = useState<string | null>(searchParams.get("request"));
  const [entryError, setEntryError] = useState<string | null>(null);
  const entryStarted = useRef(false);
  const queryEntryError = useMemo(() => {
    const redirectUri = searchParams.get("redirect_uri");
    if (redirectUri) {
      try {
        new URL(redirectUri);
      } catch {
        return t("CONNECT.WE_COULD_NOT_START_THE");
      }
      return null;
    }
    return searchParams.get("request")
      ? null
      : tStatic(I18N_MODULE, "CONNECT.THIS_PAGE_IS_MISSING_ITS");
  }, [searchParams, t]);

  useEffect(() => {
    if (entryStarted.current) return;
    entryStarted.current = true;
    if (queryEntryError) return;

    const fromQuery = searchParams.get("redirect_uri");
    if (fromQuery) {
      const redirectHost = new URL(fromQuery).host;
      const payload = {
        family: searchParams.get("app") || "localization",
        redirectUri: fromQuery,
        state: searchParams.get("state") || "",
        codeChallenge: searchParams.get("code_challenge") || "",
        codeChallengeMethod: searchParams.get("code_challenge_method") || "S256",
        siteName: searchParams.get("site_name") || redirectHost,
        suggestedTemplateKey: searchParams.get("template") || undefined,
      };
      integrationConnectService
        .createRequest(payload)
        .then((response) => {
          if (!isAuthenticated) {
            try {
              savePendingConnectRequest({
                requestId: response.requestId,
                expiresAt: response.expiresAt,
                redirectUri: fromQuery,
                state: payload.state,
              });
            } catch {
              // Storage may be unavailable; the flow continues without the login hand-off.
            }
          }
          setRequestId(response.requestId);
          window.history.replaceState(null, "", `/connect?request=${response.requestId}`);
        })
        .catch(() => setEntryError(t("CONNECT.WE_COULD_NOT_START_THE")));
      return;
    }
    if (searchParams.get("request")) return;
  }, [isAuthenticated, queryEntryError, searchParams, t]);

  // A resumed link can outlive the session. Save it again before redirecting so login can
  // return to this request instead of dropping the user at the console.
  useEffect(() => {
    if (!entryStarted.current || entryError || queryEntryError || requestId === null) return;
    if (!isAuthenticated) {
      try {
        savePendingConnectRequest({
          requestId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      } catch {
        // Storage can be unavailable; login still remains possible.
      }
      navigate("/login");
    }
  }, [entryError, queryEntryError, requestId, isAuthenticated, navigate]);

  // ── Request view + approval state (P3-13) ──
  const {
    data: request,
    error: requestError,
    isError: requestFailed,
    isLoading: requestLoading,
  } = useConnectRequest(requestId);

  useEffect(() => {
    if (requestFailed) clearPendingConnectRequest();
  }, [requestFailed]);

  const [createdProject, setCreatedProject] = useState<{
    tenantGroupId: string;
    name: string;
  } | null>(null);
  const projectsQuery = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => projectService.getProjects(0, 100, ""),
    enabled: !!requestId && isAuthenticated,
    refetchInterval: (query) =>
      createdProject &&
      !query.state.data?.some((group) => group.tenantGroupId === createdProject.tenantGroupId)
        ? 3_000
        : false,
  });
  const groups = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const [selectedTenantGroupId, setSelectedTenantGroupId] = useState<string | null>(null);
  const selectedGroup = groups.find((group) => group.tenantGroupId === selectedTenantGroupId);
  const [selectedEnvironment, setSelectedEnvironment] = useState<{
    itemId: string;
    tenantId: string;
    environment: string;
  } | null>(null);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [successRedirectUrl, setSuccessRedirectUrl] = useState<string | null>(null);

  const readiness = useReadinessWait(templateKey, selectedEnvironment?.tenantId ?? null);

  const approve = useApproveConnectRequest();
  const cancel = useCancelConnectRequest();
  const approvalStartedFor = useRef<string | null>(null);

  const handleApprove = useCallback(
    async (selectedTemplateKey: string) => {
      if (!request || !selectedEnvironment || approve.isPending) return;
      const selection = `${selectedEnvironment.tenantId}:${selectedTemplateKey}`;
      if (approvalStartedFor.current === selection) return;
      approvalStartedFor.current = selection;
      try {
        const result = await approve.mutateAsync({
          requestId: request.requestId,
          templateKey: selectedTemplateKey,
        });
        clearPendingConnectRequest();
        setSuccessRedirectUrl(result.redirectUrl);
      } catch {
        // Toast already shown by the hook.
      }
    },
    [approve, request, selectedEnvironment],
  );

  // The redirect carries a one-time code, so the browser must load it exactly once. The
  // "Go to site now" click and the auto-redirect share this guard: otherwise a click followed
  // by the timer loads the callback twice, and the CMS sees the second load fail with
  // invalid_code even though the first one connected.
  const leftForSite = useRef(false);
  const goToSite = useCallback(() => {
    if (!successRedirectUrl || leftForSite.current) return;
    leftForSite.current = true;
    window.location.assign(successRedirectUrl);
  }, [successRedirectUrl]);

  useEffect(() => {
    if (!successRedirectUrl) return;
    const timer = window.setTimeout(goToSite, 2_000);
    return () => window.clearTimeout(timer);
  }, [successRedirectUrl, goToSite]);

  useEffect(() => {
    if (readiness.state.phase !== "ready" || !selectedEnvironment || !templateKey) return;
    if (
      readiness.state.templateKey !== templateKey ||
      readiness.state.environmentTenantId !== selectedEnvironment.tenantId
    )
      return;
    // Approval updates the success screen only after its asynchronous request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void handleApprove(templateKey);
  }, [handleApprove, readiness.state, selectedEnvironment, templateKey]);

  const handleConnect = () => {
    if (!selectedEnvironment || !templateKey || approve.isPending) return;
    if (
      readiness.state.phase === "ready" &&
      readiness.state.templateKey === templateKey &&
      readiness.state.environmentTenantId === selectedEnvironment.tenantId
    ) {
      // A failed approval stays on this screen; a deliberate second click retries it.
      approvalStartedFor.current = null;
      void handleApprove(templateKey);
      return;
    }
    readiness.reset();
    approvalStartedFor.current = null;
    void readiness.begin();
  };

  const handleCancel = async () => {
    if (!request) return;
    try {
      const result = await cancel.mutateAsync(request.requestId);
      clearPendingConnectRequest();
      window.location.assign(result.redirectUrl);
    } catch {
      showErrorToast({ errors: t("CONNECT.COULD_NOT_CANCEL_THE_CONNECTION") });
    }
  };

  // ── Render ──
  if (entryError || queryEntryError) {
    return (
      <ConnectShell title={t("CONNECT.CONNECTION_PROBLEM")}>
        {entryError || queryEntryError}
      </ConnectShell>
    );
  }

  if (!requestId || !isAuthenticated) {
    return (
      <ConnectShell title={t(KEY_CONNECT_WITH_BLOCKS_OS)}>
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
        </div>
      </ConnectShell>
    );
  }

  if (successRedirectUrl) {
    return (
      <ConnectShell title={t("CONNECT.CONNECTION_SUCCESSFUL")}>
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            <CircleCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-high-emphasis">{t("CONNECT.YOUR_SITE_IS_CONNECTED_TO")}</p>
          <p className="text-sm text-medium-emphasis">
            {t("CONNECT.REDIRECTING_YOU_TO", {
              value1: request?.siteName || request?.redirectHost || t("CONNECT.YOUR_SITE"),
            })}
          </p>
        </div>
        <div className="flex justify-center">
          <Button asChild size="sm" className="gap-2">
            <a
              href={successRedirectUrl}
              onClick={(event) => {
                event.preventDefault();
                goToSite();
              }}
            >
              {t("CONNECT.GO_TO_SITE_NOW")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </ConnectShell>
    );
  }

  if (requestLoading) {
    return (
      <ConnectShell title={t(KEY_CONNECT_WITH_BLOCKS_OS)}>
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
        </div>
      </ConnectShell>
    );
  }

  if (requestFailed || !request) {
    return <RequestErrorScreen requestError={requestError} />;
  }

  if (projectsQuery.isLoading) {
    return (
      <ConnectShell title={t(KEY_CONNECT_TO_BLOCKS_OS)}>
        <div className="flex items-center gap-2 py-4 text-sm text-medium-emphasis" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("CONNECT.LOADING_PROJECTS")}
        </div>
      </ConnectShell>
    );
  }

  if (projectsQuery.isError && !createdProject) {
    return (
      <ConnectShell title={t(KEY_CONNECT_TO_BLOCKS_OS)}>
        <Banner
          variant="destructive"
          title={t("CONNECT.PROJECTS_COULD_NOT_BE_LOADED")}
          compact={false}
        >
          {t("CONNECT.CHECK_YOUR_CONNECTION_THEN_TRY")}
        </Banner>
        <Button size="sm" variant="outline" onClick={() => void projectsQuery.refetch()}>
          {t(KEY_COMMON_RETRY)}
        </Button>
      </ConnectShell>
    );
  }

  const handleEnvironmentChange = (value: string) => {
    const project = selectedGroup?.projects.find((p) => p.tenantId === value);
    if (!project) return;
    setSelectedEnvironment({
      itemId: project.itemId,
      tenantId: project.tenantId,
      environment: project.environment,
    });
    setTemplateKey(
      request.templates.find((template) => template.key === request.suggestedTemplateKey)?.key ??
        request.templates.find((template) => template.accessLevel === "read")?.key ??
        request.templates[0]?.key ??
        null,
    );
    approvalStartedFor.current = null;
    readiness.reset();
  };

  const handleProjectChange = (tenantGroupId: string) => {
    if (tenantGroupId === selectedTenantGroupId) return;
    setSelectedTenantGroupId(tenantGroupId);
    if (tenantGroupId !== createdProject?.tenantGroupId) setCreatedProject(null);
    setSelectedEnvironment(null);
    setTemplateKey(null);
    approvalStartedFor.current = null;
    readiness.reset();
  };

  const handleSelectTemplate = (key: string) => {
    setTemplateKey(key);
    approvalStartedFor.current = null;
    readiness.reset();
  };

  const waiting = readiness.state.phase === "checking" || readiness.state.phase === "waiting";
  const busy = waiting || approve.isPending;
  const connectLabel = t(connectLabelKey(approve.isPending, waiting));
  const chooseExisting = groups.length > 0 ? () => setShowCreateProject(false) : undefined;

  return (
    <ConnectShell title={t(KEY_CONNECT_TO_BLOCKS_OS)}>
      <p className="text-sm leading-relaxed text-medium-emphasis">
        {t("CONNECT.CHOOSE_THE_PROJECT_ENVIRONMENT_AND")}
      </p>
      <section
        aria-label={t("CONNECT.CONNECTION_REQUEST")}
        className="rounded-lg border border-border bg-muted/20 p-4"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Plug className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="wrap-break-word text-sm font-semibold text-high-emphasis">
              {request.siteName || request.redirectHost}
            </p>
            <p className="mt-0.5 text-xs text-medium-emphasis">
              {t("CONNECT.REQUESTS_ACCESS_TO_BLOCKS")}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
          <span className="text-medium-emphasis">{t("CONNECT.REQUEST_ORIGIN")}</span>
          <code className="break-all font-mono text-high-emphasis">{request.redirectHost}</code>
        </div>
      </section>

      {createdProject && !showCreateProject && (
        <CreatedProjectBanner
          name={createdProject.name}
          hasGroup={!!selectedGroup}
          loadFailed={projectsQuery.isError}
          onRetry={() => void projectsQuery.refetch()}
        />
      )}

      {showCreateProject || (groups.length === 0 && !createdProject) ? (
        <CreateProjectBranch
          onCreated={(tenantGroupId, name) => {
            setCreatedProject({ tenantGroupId, name });
            setShowCreateProject(false);
            setSelectedTenantGroupId(tenantGroupId);
            void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
          }}
          onChooseExisting={chooseExisting}
        />
      ) : (
        <div className="space-y-6">
          <ProjectSection
            groups={groups}
            selectedTenantGroupId={selectedTenantGroupId}
            onSelect={handleProjectChange}
            onCreateNew={() => setShowCreateProject(true)}
          />

          <EnvironmentSection
            group={selectedGroup}
            selectedTenantId={selectedEnvironment?.tenantId}
            hasCreatedProject={!!createdProject}
            onSelect={handleEnvironmentChange}
          />

          {selectedEnvironment && (
            <ConnectOptionsSection
              templates={request.templates}
              environment={selectedEnvironment.environment}
              templateKey={templateKey}
              busy={busy}
              waiting={waiting}
              phase={readiness.state.phase}
              onSelectTemplate={handleSelectTemplate}
              onRetry={() => void readiness.retry()}
            />
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={approve.isPending || cancel.isPending}
        >
          {t("common:CANCEL")}
        </Button>
        {selectedEnvironment && (
          <Button
            type="button"
            className="min-w-32 gap-2 font-semibold"
            onClick={handleConnect}
            disabled={!templateKey || busy || cancel.isPending}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {connectLabel}
            {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </ConnectShell>
  );
}

type ConnectRequestData = Awaited<ReturnType<typeof integrationConnectService.getRequest>>;
type ProjectGroup = Awaited<ReturnType<typeof projectService.getProjects>>[number];

// P3-16: distinguish expired/missing, claimed by another user, and unexpected errors.
const RequestErrorScreen = ({ requestError }: Readonly<{ requestError: unknown }>) => {
  const { t } = useT(I18N_MODULE);
  const errorKeys = isErrorWithErrors(requestError) ? requestError.errors : null;
  const claimedByOther = !!errorKeys && hasErrorCode(errorKeys, "request_claimed_by_other_user");
  const expired = !!errorKeys && hasErrorCode(errorKeys, "request_not_found_or_expired");

  if (claimedByOther) {
    return (
      <ConnectShell title={t("CONNECT.THIS_CONNECTION_REQUEST_IS_IN")}>
        {t("CONNECT.SOMEONE_ELSE_IS_ALREADY_HANDLING")}
      </ConnectShell>
    );
  }

  if (expired) {
    // The entry step saved callback coordinates alongside the pending id; without them there
    // is nowhere to send the browser back to.
    const pending = readPendingConnectRequest();
    let backUrl: string | null = null;
    if (pending?.redirectUri && pending.state) {
      const separator = pending.redirectUri.includes("?") ? "&" : "?";
      backUrl = `${pending.redirectUri}${separator}error=expired&state=${encodeURIComponent(pending.state)}`;
    }
    return <ExpiredScreen backUrl={backUrl} />;
  }

  return (
    <ConnectShell title={t("CONNECT.SOMETHING_WENT_WRONG")}>
      {t("CONNECT.WE_COULD_NOT_READ_THIS")}
    </ConnectShell>
  );
};

type EnvironmentSectionProps = Readonly<{
  group: ProjectGroup | undefined;
  selectedTenantId: string | undefined;
  hasCreatedProject: boolean;
  onSelect: (tenantId: string) => void;
}>;

const EnvironmentSection = ({
  group,
  selectedTenantId,
  hasCreatedProject,
  onSelect,
}: EnvironmentSectionProps) => {
  const { t } = useT(I18N_MODULE);
  if (!group) {
    return (
      <p className="text-xs text-medium-emphasis">
        {hasCreatedProject
          ? t("CONNECT.THE_NEW_PROJECT_WILL_APPEAR")
          : t("CONNECT.SELECT_A_PROJECT_TO_SEE")}
      </p>
    );
  }
  return (
    <section>
      <h2 id="connect-environment-heading" className="mb-2 text-sm font-medium text-high-emphasis">
        {t("CONNECT.ENVIRONMENT")}
      </h2>
      <p className="mb-3 text-xs text-medium-emphasis">
        {t("CONNECT.SELECT_THE_ENVIRONMENT_THIS")}
      </p>
      <RadioGroup
        aria-labelledby="connect-environment-heading"
        value={selectedTenantId ?? ""}
        onValueChange={onSelect}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {group.projects.map((p) => (
            <label
              key={p.tenantId}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                selectedTenantId === p.tenantId
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/50 hover:bg-accent/40"
              }`}
            >
              <RadioGroupItem value={p.tenantId} />
              <span className="min-w-0 flex-1 truncate font-medium text-high-emphasis">
                {environmentLabel(p.environment)}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-medium-emphasis">
                <GitBranch className="h-3 w-3" aria-hidden="true" />
                {p.environment === "prod" ? "main" : p.environment}
              </span>
            </label>
          ))}
        </div>
      </RadioGroup>
    </section>
  );
};

type ConnectOptionsSectionProps = Readonly<{
  templates: ConnectRequestData["templates"];
  environment: string;
  templateKey: string | null;
  busy: boolean;
  waiting: boolean;
  phase: ReadinessState["phase"];
  onSelectTemplate: (key: string) => void;
  onRetry: () => void;
}>;

const ConnectOptionsSection = ({
  templates,
  environment,
  templateKey,
  busy,
  waiting,
  phase,
  onSelectTemplate,
  onRetry,
}: ConnectOptionsSectionProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <section aria-labelledby="connect-options-heading" className="space-y-3">
      <div>
        <h2 id="connect-options-heading" className="text-sm font-medium text-high-emphasis">
          {t("CONNECT.CONNECT_OPTIONS")}
        </h2>
        <p className="mt-1 text-xs text-medium-emphasis">
          {t("CONNECT.SELECT_THE_LEVEL_OF_LOCALIZATION", {
            environment: environmentLabel(environment),
          })}
        </p>
      </div>
      <fieldset
        aria-labelledby="connect-options-heading"
        className="m-0 grid min-w-0 gap-2 border-0 p-0"
      >
        {templates.map((template) => (
          <TemplateOption
            key={template.key}
            template={template}
            isSelected={templateKey === template.key}
            disabled={busy}
            onSelect={() => onSelectTemplate(template.key)}
          />
        ))}
      </fieldset>
      {waiting && (
        <output className="block text-xs text-medium-emphasis">
          {t("CONNECT.CHECKING_THAT_THIS_ENVIRONMENT_IS")}
        </output>
      )}
      {phase === "timeout" && (
        <Banner
          variant="warning"
          title={t("CONNECT.THIS_ENVIRONMENT_IS_TAKING_LONGER")}
          compact={false}
        >
          <span>{t("CONNECT.TRY_THE_READINESS_CHECK_AGAIN")} </span>
          <button type="button" className="font-semibold underline" onClick={onRetry}>
            {t(KEY_COMMON_RETRY)}
          </button>
        </Banner>
      )}
      {phase === "permissionDenied" && (
        <Banner
          variant="destructive"
          title={t("CONNECT.INTEGRATION_PERMISSION_REQUIRED")}
          compact={false}
        >
          {t("CONNECT.YOU_DON_T_HAVE_PERMISSION")}
        </Banner>
      )}
    </section>
  );
};

type TemplateOptionProps = Readonly<{
  template: ConnectRequestData["templates"][number];
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}>;

const TemplateOption = ({ template, isSelected, disabled, onSelect }: TemplateOptionProps) => {
  const { t } = useT(I18N_MODULE);
  let accessLabel: string = template.accessLevel;
  if (template.accessLevel === "read") accessLabel = "Read-only";
  else if (template.accessLevel === "full") {
    accessLabel = tStatic(I18N_MODULE, "CONNECT.FULL_ACCESS");
  }
  return (
    <button
      type="button"
      aria-label={t("CONNECT.SELECT", { displayName: template.displayName })}
      aria-pressed={isSelected}
      disabled={disabled}
      onClick={onSelect}
      className={`relative w-full rounded-lg border p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"}`}
    >
      <span className="block min-w-0">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Plug className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-high-emphasis">{template.displayName}</span>
          </span>
          <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-medium-emphasis">
            {accessLabel}
          </span>
        </span>
        {template.description && (
          <span className="mt-2 block pr-8 text-xs leading-relaxed text-medium-emphasis">
            {template.description}
          </span>
        )}
      </span>
      {isSelected && (
        <span
          className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
};

type ProjectSectionProps = Readonly<{
  groups: ProjectGroup[];
  selectedTenantGroupId: string | null;
  onSelect: (tenantGroupId: string) => void;
  onCreateNew: () => void;
}>;

const ProjectSection = ({
  groups,
  selectedTenantGroupId,
  onSelect,
  onCreateNew,
}: ProjectSectionProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-high-emphasis">{t("CONNECT.PROJECT")}</p>
      {groups.length > 0 ? (
        <ConnectProjectPicker
          projects={groups.map((group) => ({
            tenantGroupId: group.tenantGroupId,
            name: group.projects[0]?.name ?? group.tenantGroupId,
          }))}
          value={selectedTenantGroupId}
          onValueChange={onSelect}
        />
      ) : (
        <output className="block text-sm text-medium-emphasis">
          {t("CONNECT.LOADING_PROJECTS")}
        </output>
      )}
      <button
        type="button"
        className="mt-2 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onCreateNew}
      >
        {t("CONNECT.CREATE_NEW_PROJECT")}
      </button>
    </section>
  );
};

type CreatedProjectBannerProps = Readonly<{
  name: string;
  hasGroup: boolean;
  loadFailed: boolean;
  onRetry: () => void;
}>;

const CreatedProjectBanner = ({
  name,
  hasGroup,
  loadFailed,
  onRetry,
}: CreatedProjectBannerProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <Banner variant="success" title={t("CONNECT.PROJECT_CREATED_SUCCESSFULLY")} compact={false}>
      {t(createdBannerKey(hasGroup, loadFailed), { name })}
      {!hasGroup && loadFailed && (
        <button type="button" className="ml-1 font-semibold underline" onClick={onRetry}>
          {t(KEY_COMMON_RETRY)}
        </button>
      )}
    </Banner>
  );
};

const ConnectShell = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { t } = useT(I18N_MODULE);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <img
            src="/blocks-logos/os_light_mode.svg"
            alt={t("CONNECT.BLOCKS_OS")}
            className="h-14 w-auto dark:hidden"
          />
          <img
            src="/blocks-logos/os_dark_mode.svg"
            alt={t("CONNECT.BLOCKS_OS")}
            className="hidden h-14 w-auto dark:block"
          />
        </div>
        <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-8">
          <h1 className="text-lg font-semibold text-high-emphasis">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
};

/** Clears the pending id on unmount so re-renders of this screen keep the back button. */
const ExpiredScreen = ({ backUrl }: { backUrl: string | null }) => {
  const { t } = useT(I18N_MODULE);
  useEffect(() => clearPendingConnectRequest, []);
  return (
    <ConnectShell title={t("CONNECT.THIS_CONNECTION_LINK_HAS_EXPIRED")}>
      <p>{t("CONNECT.GO_BACK_TO_YOUR_SITE")}</p>
      {backUrl && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => globalThis.location.assign(backUrl)}>
            {t("CONNECT.BACK_TO_YOUR_SITE")}
          </Button>
        </div>
      )}
    </ConnectShell>
  );
};

/**
 * P3-14: the inline project-creation branch for users with no project yet. Uses the same
 * payload builder and terms/environment components as the wizard (AC3.4) but does not
 * navigate after success. Its environment choice uses the compact variant of the shared list.
 */
const CreateProjectBranch = ({
  onCreated,
  onChooseExisting,
}: {
  onCreated: (tenantGroupId: string, name: string) => void;
  onChooseExisting?: () => void;
}) => {
  const { t } = useT(I18N_MODULE);
  const { isPending, mutateAsync } = useCreateProject();
  const [created, setCreated] = useState(false);
  const [name, setName] = useState("");
  const [isAcceptBlocksTerms, setIsAcceptBlocksTerms] = useState(false);
  const [isUseBlocksExclusively, setIsUseBlocksExclusively] = useState(false);
  const [environments, setEnvironments] = useState<string[]>([]);

  const canSubmit =
    name.trim().length >= 3 &&
    name.trim().length <= 100 &&
    isAcceptBlocksTerms &&
    isUseBlocksExclusively &&
    environments.length >= 1 &&
    !isPending &&
    !created;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const response = await mutateateProject();
      if (response?.isSuccess && response.tenantGroupId) {
        setCreated(true);
        onCreated(response.tenantGroupId, name.trim());
      } else {
        showErrorToast({ errors: response?.errors ?? t("CONNECT.COULD_NOT_CREATE_THE_PROJECT") });
      }
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: (error as { errors: unknown }).errors });
      }
    }
  };

  const mutateateProject = () =>
    mutateAsync(
      buildCreateProjectPayload({
        name: name.trim(),
        isAcceptBlocksTerms,
        isUseBlocksExclusively,
        environments: sortEnvironments(environments).map((value) => ({ value })),
      }),
    );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-high-emphasis">
          {onChooseExisting ? t("CONNECT.CREATE_A_PROJECT") : t("CONNECT.YOU_DON_T_HAVE_A")}
        </h2>
        <p className="mt-1 text-xs text-medium-emphasis">
          {t("CONNECT.CREATE_A_PROJECT_TO_CONTINUE")}
        </p>
      </div>
      <div>
        <label
          htmlFor="connect-project-name"
          className="mb-2 block text-sm font-medium text-high-emphasis"
        >
          {t("CONNECT.PROJECT_NAME")}
        </label>
        <Input
          id="connect-project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("CONNECT.ENTER_A_PROJECT_NAME")}
          maxLength={100}
        />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium text-high-emphasis">{t("CONNECT.ENVIRONMENTS")}</h3>
        <p className="mb-3 text-xs text-medium-emphasis">{t("CONNECT.SELECT_AT_LEAST_ONE_EACH")}</p>
        <ProjectEnvironmentCheckboxes
          variant="compact"
          selected={environments}
          onToggle={(environment, checked) =>
            setEnvironments((current) =>
              checked ? [...current, environment] : current.filter((e) => e !== environment),
            )
          }
        />
      </div>
      <div className="border-t border-border pt-4">
        <ProjectTermsCheckboxes
          isAcceptBlocksTerms={isAcceptBlocksTerms}
          isUseBlocksExclusively={isUseBlocksExclusively}
          onAcceptBlocksTermsChange={setIsAcceptBlocksTerms}
          onUseBlocksExclusivelyChange={setIsUseBlocksExclusively}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onChooseExisting ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={onChooseExisting}
            disabled={isPending || created}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("CONNECT.GO_BACK")}
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {created ? t("CONNECT.PROJECT_CREATED") : t("CONNECT.CREATE_PROJECT")}
        </Button>
      </div>
    </div>
  );
};
