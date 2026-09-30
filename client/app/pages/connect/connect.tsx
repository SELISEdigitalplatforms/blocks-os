import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import {
  ProjectEnvironmentCheckboxes,
  sortEnvironments,
} from "@/components/create-project/form/project-environment-checkboxes";
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

const PROJECTS_QUERY_KEY = ["identifier", "projects", "connect"] as const;

/**
 * The "Connect with Blocks" page (P3-11 entry, P3-13 approve screen, P3-14 no-project branch,
 * P3-15 readiness wait). Reached from a CMS redirect; every step must survive a login
 * round-trip via the localStorage pending-request hand-off.
 */
export default function ConnectPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  // ── Entry step (P3-11) ──
  const [requestId, setRequestId] = useState<string | null>(searchParams.get("request"));
  const [entryError, setEntryError] = useState<string | null>(null);
  const entryStarted = useRef(false);

  useEffect(() => {
    if (entryStarted.current) return;
    entryStarted.current = true;

    const fromQuery = searchParams.get("redirect_uri");
    if (fromQuery) {
      let redirectHost: string;
      try {
        redirectHost = new URL(fromQuery).host;
      } catch {
        setEntryError("We could not start the connection request. Go back to your site and click Connect again.");
        return;
      }
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
    // Neither a fresh CMS redirect nor a resumed request: nothing to do here.
    setEntryError("This page is missing its connection details. Go back to your site and click Connect again.");
  }, [isAuthenticated, searchParams]);

  // A resumed link can outlive the session. Save it again before redirecting so login can
  // return to this request instead of dropping the user at the console.
  useEffect(() => {
    if (!entryStarted.current || entryError || requestId === null) return;
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
  }, [entryError, requestId, isAuthenticated, navigate]);

  // ── Request view + approval state (P3-13) ──
  const { data: request, error: requestError, isError: requestFailed, isLoading: requestLoading } = useConnectRequest(requestId);

  useEffect(() => {
    if (requestFailed) clearPendingConnectRequest();
  }, [requestFailed]);

  const projectsQuery = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => projectService.getProjects(0, 100, ""),
    enabled: !!requestId && isAuthenticated,
  });
  const groups = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const [selectedTenantGroupId, setSelectedTenantGroupId] = useState<string | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<{ itemId: string; tenantId: string; environment: string } | null>(null);
  const [templateKey, setTemplateKey] = useState<string>("");
  const [showCreateProject, setShowCreateProject] = useState(false);

  useEffect(() => {
    if (!selectedTenantGroupId && groups.length > 0) setSelectedTenantGroupId(groups[0].tenantGroupId);
  }, [groups, selectedTenantGroupId]);

  useEffect(() => {
    if (!templateKey && request) setTemplateKey(request.suggestedTemplateKey || request.templates[0]?.key || "");
  }, [request, templateKey]);

  const readiness = useReadinessWait(
    templateKey || null,
    selectedEnvironment?.tenantId ?? null,
  );

  // Start the readiness wait as soon as both choices exist.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedEnvironment || !templateKey) return;
    const key = `${selectedEnvironment.tenantId}:${templateKey}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    void readiness.begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEnvironment, templateKey]);

  const approve = useApproveConnectRequest();
  const cancel = useCancelConnectRequest();

  const handleApprove = async () => {
    if (!request || !templateKey) return;
    try {
      const result = await approve.mutateAsync({ requestId: request.requestId, templateKey });
      clearPendingConnectRequest();
      window.location.assign(result.redirectUrl);
    } catch {
      // Toast already shown by the hook.
    }
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
  if (entryError) {
    return <ConnectShell title="Connection problem">{entryError}</ConnectShell>;
  }

  if (!requestId) {
    return (
      <ConnectShell title="Connect with Blocks">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
        </div>
      </ConnectShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <ConnectShell title="Connect with Blocks">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-medium-emphasis" />
        </div>
      </ConnectShell>
    );
  }

  if (requestLoading) {
    return (
      <ConnectShell title="Connect with Blocks">
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

  if (readiness.state.phase === "timeout") {
    return (
      <ConnectShell title="Setting up your environment…">
        <p>Your environment is taking longer than expected to become ready.</p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => void readiness.retry()}>
            Retry
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </ConnectShell>
    );
  }

  if (readiness.state.phase === "permissionDenied") {
    return <ConnectShell title="Integration permission required">You don&apos;t have permission to set up integrations in this environment.</ConnectShell>;
  }

  const waiting = readiness.state.phase !== "idle" && readiness.state.phase !== "ready";

  return (
    <ConnectShell title="Step 2 of 3">
      <Banner variant="info" title={`${request.redirectHost} wants access to Blocks Localization`} compact={false}>
        {request.siteName && request.siteName !== request.redirectHost ? (
          <span className="text-xs">{request.siteName}</span>
        ) : null}
      </Banner>

      {showCreateProject || groups.length === 0 ? (
        <CreateProjectBranch
          onCreated={async (tenantGroupId) => {
            await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
            setShowCreateProject(false);
            setSelectedTenantGroupId(tenantGroupId);
          }}
          onChooseExisting={groups.length > 0 ? () => setShowCreateProject(false) : undefined}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Project</h2>
            <select
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              value={selectedTenantGroupId ?? ""}
              onChange={(e) => {
                setSelectedTenantGroupId(e.target.value);
                setSelectedEnvironment(null);
              }}
            >
              {groups.map((g) => (
                <option key={g.tenantGroupId} value={g.tenantGroupId}>
                  {g.projects[0]?.name ?? g.tenantGroupId}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-2 text-xs text-primary underline"
              onClick={() => setShowCreateProject(true)}
            >
              Create new project
            </button>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Environment</h2>
            <RadioGroup
              value={selectedEnvironment?.tenantId ?? ""}
              onValueChange={(value) => {
                const project = groups
                  .find((g) => g.tenantGroupId === selectedTenantGroupId)
                  ?.projects.find((p) => p.tenantId === value);
                if (project) {
                  setSelectedEnvironment({
                    itemId: project.itemId,
                    tenantId: project.tenantId,
                    environment: project.environment,
                  });
                  readiness.reset();
                }
              }}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {groups
                  .find((g) => g.tenantGroupId === selectedTenantGroupId)
                  ?.projects.map((p) => (
                    <label
                      key={p.tenantId}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 text-sm"
                    >
                      <RadioGroupItem value={p.tenantId} />
                      {p.environment}
                    </label>
                  ))}
              </div>
            </RadioGroup>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Access level</h2>
            <RadioGroup value={templateKey} onValueChange={setTemplateKey}>
              <div className="space-y-2">
                {request.templates.map((t) => (
                  <label
                    key={t.key}
                    className="flex cursor-pointer gap-3 rounded-md border border-border p-3 text-xs"
                  >
                    <RadioGroupItem value={t.key} className="mt-0.5" />
                    <span className="space-y-1">
                      <span className="block font-medium text-high-emphasis">
                        {t.displayName} <Badge variant="outline">{t.permissionCount} permissions</Badge>
                      </span>
                      {t.description && <span className="block text-medium-emphasis">{t.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </section>

          {waiting && (
            <Banner variant="info" compact={false} title="Setting up your environment…">
              This usually takes under a minute for an existing environment.
            </Banner>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCancel} disabled={approve.isPending || cancel.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={
                !selectedEnvironment ||
                !templateKey ||
                readiness.state.phase !== "ready" ||
                approve.isPending
              }
            >
              {approve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </Button>
          </div>
        </div>
      )}
    </ConnectShell>
  );
}

const ConnectShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-background p-6">
    <div className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-8">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
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
 * navigate after success.
 */
const CreateProjectBranch = ({
  onCreated,
  onChooseExisting,
}: {
  onCreated: (tenantGroupId: string) => Promise<void> | void;
  onChooseExisting?: () => void;
}) => {
  const { isPending, mutateAsync } = useCreateProject();
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
    !isPending;

  const handleSubmit = async () => {
    try {
      const response = await mutateateProject();
      if (response?.isSuccess && response.tenantGroupId) await onCreated(response.tenantGroupId);
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
        <h2 className="mb-2 text-sm font-semibold">You don&apos;t have a project yet</h2>
        <p className="text-xs text-medium-emphasis">
          Create your first project to continue connecting your site.
        </p>
      </div>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        maxLength={100}
      />
      <ProjectTermsCheckboxes
        isAcceptBlocksTerms={isAcceptBlocksTerms}
        isUseBlocksExclusively={isUseBlocksExclusively}
        onAcceptBlocksTermsChange={setIsAcceptBlocksTerms}
        onUseBlocksExclusivelyChange={setIsUseBlocksExclusively}
      />
      <ProjectEnvironmentCheckboxes
        selected={environments}
        onToggle={(environment, checked) =>
          setEnvironments((current) =>
            checked ? [...current, environment] : current.filter((e) => e !== environment),
          )
        }
      />
      <div className="flex justify-between">
        {onChooseExisting ? (
          <Button variant="outline" onClick={onChooseExisting} disabled={isPending}>
            Choose an existing project
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create project
        </Button>
      </div>
    </div>
  );
};
