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
import { environmentOptions } from "@/components/create-project/form/create-project-environments-form/utils";
import { ProjectTermsCheckboxes } from "@/components/create-project/form/project-terms-checkboxes";
import { integrationConnectService } from "@/cross-modules/integration/services/integration-connect.service";
import {
  useApproveConnectRequest,
  useCancelConnectRequest,
  useConnectRequest,
  useReadinessWait,
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

const PROJECTS_QUERY_KEY = ["identifier", "projects", "connect"] as const;
const environmentLabel = (value: string) =>
  environmentOptions.find((option) => option.value === value)?.label ?? value;

/**
 * The "Connect with Blocks OS" page (P3-11 entry, P3-13 approve screen, P3-14 no-project branch,
 * P3-15 readiness wait). Reached from a CMS redirect; every step must survive a login
 * round-trip via the localStorage pending-request hand-off.
 */
export default function ConnectPage() {
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
        return "We could not start the connection request. Go back to your site and click Connect again.";
      }
      return null;
    }
    return searchParams.get("request") ? null : "This page is missing its connection details. Go back to your site and click Connect again.";
  }, [searchParams]);

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
        .catch(() => setEntryError("We could not start the connection request. Go back to your site and click Connect again."));
      return;
    }
    if (searchParams.get("request")) return;
  }, [isAuthenticated, queryEntryError, searchParams]);

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
  const { data: request, error: requestError, isError: requestFailed, isLoading: requestLoading } = useConnectRequest(requestId);

  useEffect(() => {
    if (requestFailed) clearPendingConnectRequest();
  }, [requestFailed]);

  const [createdProject, setCreatedProject] = useState<{ tenantGroupId: string; name: string } | null>(null);
  const projectsQuery = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => projectService.getProjects(0, 100, ""),
    enabled: !!requestId && isAuthenticated,
    refetchInterval: (query) =>
      createdProject && !query.state.data?.some((group) => group.tenantGroupId === createdProject.tenantGroupId)
        ? 3_000
        : false,
  });
  const groups = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const [selectedTenantGroupId, setSelectedTenantGroupId] = useState<string | null>(null);
  const selectedGroup = groups.find((group) => group.tenantGroupId === selectedTenantGroupId);
  const [selectedEnvironment, setSelectedEnvironment] = useState<{ itemId: string; tenantId: string; environment: string } | null>(null);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [successRedirectUrl, setSuccessRedirectUrl] = useState<string | null>(null);

  const readiness = useReadinessWait(
    templateKey,
    selectedEnvironment?.tenantId ?? null,
  );

  const approve = useApproveConnectRequest();
  const cancel = useCancelConnectRequest();
  const approvalStartedFor = useRef<string | null>(null);

  const handleApprove = useCallback(async (selectedTemplateKey: string) => {
    if (!request || !selectedEnvironment || approve.isPending) return;
    const selection = `${selectedEnvironment.tenantId}:${selectedTemplateKey}`;
    if (approvalStartedFor.current === selection) return;
    approvalStartedFor.current = selection;
    try {
      const result = await approve.mutateAsync({ requestId: request.requestId, templateKey: selectedTemplateKey });
      clearPendingConnectRequest();
      setSuccessRedirectUrl(result.redirectUrl);
    } catch {
      // Toast already shown by the hook.
    }
  }, [approve, request, selectedEnvironment]);

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
    if (readiness.state.templateKey !== templateKey || readiness.state.environmentTenantId !== selectedEnvironment.tenantId) return;
    // Approval updates the success screen only after its asynchronous request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void handleApprove(templateKey);
  }, [handleApprove, readiness.state, selectedEnvironment, templateKey]);

  const handleConnect = () => {
    if (!selectedEnvironment || !templateKey || approve.isPending) return;
    if (readiness.state.phase === "ready" && readiness.state.templateKey === templateKey && readiness.state.environmentTenantId === selectedEnvironment.tenantId) {
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
      showErrorToast({ errors: "Could not cancel the connection request." });
    }
  };

  // ── Render ──
  if (entryError || queryEntryError) {
    return <ConnectShell title="Connection problem">{entryError || queryEntryError}</ConnectShell>;
  }

  if (!requestId) {
    return (
      <ConnectShell title="Connect with Blocks OS">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
        </div>
      </ConnectShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <ConnectShell title="Connect with Blocks OS">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
        </div>
      </ConnectShell>
    );
  }

  if (successRedirectUrl) {
    return (
      <ConnectShell title="Connection successful">
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            <CircleCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-high-emphasis">Your site is connected to Blocks OS.</p>
          <p className="text-sm text-medium-emphasis">
            Redirecting you to {request?.siteName || request?.redirectHost || "your site"}…
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
              Go to site now <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </ConnectShell>
    );
  }

  if (requestLoading) {
    return (
      <ConnectShell title="Connect with Blocks OS">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
        </div>
      </ConnectShell>
    );
  }

  if (requestFailed || !request) {
    // P3-16: distinguish expired/missing, claimed by another user, and unexpected errors.
    const errorKeys = isErrorWithErrors(requestError) ? requestError.errors : null;
    const claimedByOther = !!errorKeys && hasErrorCode(errorKeys, "request_claimed_by_other_user");
    const expired = !!errorKeys && hasErrorCode(errorKeys, "request_not_found_or_expired");
    // The entry step saved callback coordinates alongside the pending id; without them there
    // is nowhere to send the browser back to.
    const pending = requestId ? readPendingConnectRequest() : null;

    if (claimedByOther) {
      return (
        <ConnectShell title="This connection request is in use">
          Someone else is already handling this connection request. Go back to your site and start
          again if you want to connect it for yourself.
        </ConnectShell>
      );
    }

    if (expired) {
      const backUrl =
        pending?.redirectUri && pending.state
          ? `${pending.redirectUri}${pending.redirectUri.includes("?") ? "&" : "?"}error=expired&state=${encodeURIComponent(pending.state)}`
          : null;
      return <ExpiredScreen backUrl={backUrl} />;
    }

    return (
      <ConnectShell title="Something went wrong">
        We could not read this connection request. Go back to your site and click Connect again.
      </ConnectShell>
    );
  }

  if (projectsQuery.isLoading) {
    return (
      <ConnectShell title="Connect to Blocks OS">
        <div className="flex items-center gap-2 py-4 text-sm text-medium-emphasis" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading projects…
        </div>
      </ConnectShell>
    );
  }

  if (projectsQuery.isError && !createdProject) {
    return (
      <ConnectShell title="Connect to Blocks OS">
        <Banner variant="destructive" title="Projects could not be loaded" compact={false}>
          Check your connection, then try again.
        </Banner>
        <Button size="sm" variant="outline" onClick={() => void projectsQuery.refetch()}>Retry</Button>
      </ConnectShell>
    );
  }

  const waiting = readiness.state.phase === "checking" || readiness.state.phase === "waiting";
  const busy = waiting || approve.isPending;

  return (
    <ConnectShell title="Connect to Blocks OS">
      <p className="text-sm leading-relaxed text-medium-emphasis">
        Choose the project, environment, and access this application can use.
      </p>
      <section aria-label="Connection request" className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Plug className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="wrap-break-word text-sm font-semibold text-high-emphasis">{request.siteName || request.redirectHost}</p>
            <p className="mt-0.5 text-xs text-medium-emphasis">Requests access to Blocks Localization</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
          <span className="text-medium-emphasis">Request origin</span>
          <code className="break-all font-mono text-high-emphasis">{request.redirectHost}</code>
        </div>
      </section>

      {createdProject && !showCreateProject && (
        <Banner variant="success" title="Project created successfully" compact={false}>
          {selectedGroup
            ? `Choose an environment for ${createdProject.name} to continue.`
            : projectsQuery.isError
              ? `Could not load environments for ${createdProject.name}.`
              : `Loading environments for ${createdProject.name}…`}
          {!selectedGroup && projectsQuery.isError && (
            <button type="button" className="ml-1 font-semibold underline" onClick={() => void projectsQuery.refetch()}>
              Retry
            </button>
          )}
        </Banner>
      )}

      {showCreateProject || (groups.length === 0 && !createdProject) ? (
        <CreateProjectBranch
          onCreated={(tenantGroupId, name) => {
            setCreatedProject({ tenantGroupId, name });
            setShowCreateProject(false);
            setSelectedTenantGroupId(tenantGroupId);
            void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
          }}
          onChooseExisting={groups.length > 0 ? () => setShowCreateProject(false) : undefined}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <p className="mb-2 text-sm font-medium text-high-emphasis">Project</p>
            {groups.length > 0 ? <ConnectProjectPicker
              projects={groups.map((group) => ({
                tenantGroupId: group.tenantGroupId,
                name: group.projects[0]?.name ?? group.tenantGroupId,
              }))}
              value={selectedTenantGroupId}
              onValueChange={(tenantGroupId) => {
                if (tenantGroupId === selectedTenantGroupId) return;
                setSelectedTenantGroupId(tenantGroupId);
                if (tenantGroupId !== createdProject?.tenantGroupId) setCreatedProject(null);
                setSelectedEnvironment(null);
                setTemplateKey(null);
                approvalStartedFor.current = null;
                readiness.reset();
              }}
            /> : <p className="text-sm text-medium-emphasis" role="status">Loading projects…</p>}
            <button
              type="button"
              className="mt-2 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowCreateProject(true)}
            >
              Create new project
            </button>
          </section>

          {selectedGroup ? (
            <section>
              <h2 id="connect-environment-heading" className="mb-2 text-sm font-medium text-high-emphasis">Environment</h2>
              <p className="mb-3 text-xs text-medium-emphasis">Select the environment this application can access.</p>
              <RadioGroup
                aria-labelledby="connect-environment-heading"
                value={selectedEnvironment?.tenantId ?? ""}
                onValueChange={(value) => {
                  const project = selectedGroup.projects.find((p) => p.tenantId === value);
                  if (project) {
                    setSelectedEnvironment({
                      itemId: project.itemId,
                      tenantId: project.tenantId,
                      environment: project.environment,
                    });
                    setTemplateKey(
                      request.templates.find((template) => template.key === request.suggestedTemplateKey)?.key
                      ?? request.templates.find((template) => template.accessLevel === "read")?.key
                      ?? request.templates[0]?.key
                      ?? null,
                    );
                    approvalStartedFor.current = null;
                    readiness.reset();
                  }
                }}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedGroup.projects.map((p) => (
                    <label
                      key={p.tenantId}
                      className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                        selectedEnvironment?.tenantId === p.tenantId
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/50 hover:bg-accent/40"
                      }`}
                    >
                      <RadioGroupItem value={p.tenantId} />
                      <span className="min-w-0 flex-1 truncate font-medium text-high-emphasis">{environmentLabel(p.environment)}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-medium-emphasis">
                        <GitBranch className="h-3 w-3" aria-hidden="true" />
                        {p.environment === "prod" ? "main" : p.environment}
                      </span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </section>
          ) : (
            <p className="text-xs text-medium-emphasis">
              {createdProject ? "The new project will appear here when its environments are available." : "Select a project to see its environments."}
            </p>
          )}

          {selectedEnvironment && (
            <section aria-labelledby="connect-options-heading" className="space-y-3">
              <div>
                <h2 id="connect-options-heading" className="text-sm font-medium text-high-emphasis">Connect options</h2>
                <p className="mt-1 text-xs text-medium-emphasis">
                  Select the level of localization access to grant in {environmentLabel(selectedEnvironment.environment)}.
                </p>
              </div>
              <div role="group" aria-labelledby="connect-options-heading" className="grid gap-2">
                {request.templates.map((template) => {
                  const isSelected = templateKey === template.key;
                  const accessLabel = template.accessLevel === "read" ? "Read-only" : template.accessLevel === "full" ? "Full access" : template.accessLevel;
                  return (
                    <button
                      key={template.key}
                      type="button"
                      aria-label={`Select ${template.displayName}`}
                      aria-pressed={isSelected}
                      disabled={busy}
                      onClick={() => {
                        setTemplateKey(template.key);
                        approvalStartedFor.current = null;
                        readiness.reset();
                      }}
                      className={`relative w-full rounded-lg border p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"}`}
                    >
                      <span className="block min-w-0">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Plug className="h-4 w-4" aria-hidden="true" /></span>
                            <span className="text-sm font-semibold text-high-emphasis">{template.displayName}</span>
                          </span>
                          <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-medium-emphasis">{accessLabel}</span>
                        </span>
                        {template.description && <span className="mt-2 block pr-8 text-xs leading-relaxed text-medium-emphasis">{template.description}</span>}
                      </span>
                      {isSelected && (
                        <span className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {waiting && <p role="status" className="text-xs text-medium-emphasis">Checking that this environment is ready. This can take a minute after project creation.</p>}
              {readiness.state.phase === "timeout" && (
                <Banner variant="warning" title="This environment is taking longer to set up" compact={false}>
                  <span>Try the readiness check again. </span>
                  <button type="button" className="font-semibold underline" onClick={() => void readiness.retry()}>Retry</button>
                </Banner>
              )}
              {readiness.state.phase === "permissionDenied" && (
                <Banner variant="destructive" title="Integration permission required" compact={false}>
                  You don&apos;t have permission to set up integrations in this environment. Choose another environment or ask an administrator for access.
                </Banner>
              )}
            </section>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={approve.isPending || cancel.isPending}>
          Cancel
        </Button>
        {selectedEnvironment && (
          <Button type="button" className="min-w-32 gap-2 font-semibold" onClick={handleConnect} disabled={!templateKey || busy || cancel.isPending}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {approve.isPending ? "Connecting…" : waiting ? "Checking…" : "Connect"}
            {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </ConnectShell>
  );
}

const ConnectShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
    <div className="w-full max-w-xl">
      <div className="mb-6 flex justify-center">
        <img src="/blocks-logos/os_light_mode.svg" alt="Blocks OS" className="h-14 w-auto dark:hidden" />
        <img src="/blocks-logos/os_dark_mode.svg" alt="Blocks OS" className="hidden h-14 w-auto dark:block" />
      </div>
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-8">
        <h1 className="text-lg font-semibold text-high-emphasis">{title}</h1>
        {children}
      </div>
    </div>
  </div>
);

/** Clears the pending id on unmount so re-renders of this screen keep the back button. */
const ExpiredScreen = ({ backUrl }: { backUrl: string | null }) => {
  useEffect(() => clearPendingConnectRequest, []);
  return (
    <ConnectShell title="This connection link has expired">
      <p>Go back to your site and click Connect again.</p>
      {backUrl && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => window.location.assign(backUrl)}>
            Back to your site
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
        showErrorToast({ errors: response?.errors ?? "Could not create the project." });
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
        <h2 className="text-sm font-semibold text-high-emphasis">{onChooseExisting ? "Create a project" : "You don't have a project yet"}</h2>
        <p className="mt-1 text-xs text-medium-emphasis">Create a project to continue connecting your site.</p>
      </div>
      <div>
        <label htmlFor="connect-project-name" className="mb-2 block text-sm font-medium text-high-emphasis">Project name</label>
        <Input
          id="connect-project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a project name"
          maxLength={100}
        />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium text-high-emphasis">Environments</h3>
        <p className="mb-3 text-xs text-medium-emphasis">Select at least one. Each chip shows the matching Git branch.</p>
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
          <Button variant="ghost" size="sm" className="gap-2" onClick={onChooseExisting} disabled={isPending || created}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {created ? "Project created" : "Create project"}
        </Button>
      </div>
    </div>
  );
};
