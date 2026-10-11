import { useEffect, useState } from "react";
import { BookMarked, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { useStepper } from "@/components/stepper/stepper-provider";
import ProviderButtons from "@/cross-modules/devops/components/deployment-steps/render-repos/render-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useValidateAuthorization } from "@/cross-modules/devops/hooks/github-info";
import { IRepository } from "@/cross-modules/devops/models/github-info";
import { RepositorySelectionModal } from "@/components/repository-selection-modal/repository-selection-modal";
import { useCatalogue } from "@blocks-identifier/hooks/use-catalogue";
import { repositoryKey, useCreateProjectFormState } from "../../utils";
import { WizardFooter, WizardShell } from "../../wizard-shell";
import {
  Deployments,
  branchFor,
  deploymentCount,
  fullEnvironments,
  reconcileDeployments,
  repoSlots,
} from "../../wizard-model";
import { Asset } from "./utils";

const NOTE = {
  title: "You can do this later",
  body: "Nothing here is permanent. Connect repositories and change which environments deploy them any time from the console.",
};

export const CreateProjectResourcesForm = () => {
  const { nextStep, previousStep } = useStepper();
  const { naming, selection, repositories, setRepositories } = useCreateProjectFormState();
  const { data: catalogue } = useCatalogue();
  const [providerOpen, setProviderOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { refetch: refetchAuthorization } = useValidateAuthorization();

  const assets = repositories.assets;
  const deployments = repositories.deployments;
  const envs = selection.environments;
  const order = assets.map(repositoryKey);

  // Unticked environments and a smaller tier can leave picks that no longer fit; drop them.
  useEffect(() => {
    if (!catalogue) return;
    const next = reconcileDeployments(catalogue, selection, deployments, order);
    if (JSON.stringify(next) !== JSON.stringify(pickOrder(deployments, order))) {
      setRepositories({ deployments: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, selection]);

  const openPicker = async () => {
    try {
      const auth = await refetchAuthorization();
      if (auth.data?.isSuccess) setPickerOpen(true);
      else setProviderOpen(true);
    } catch {
      setProviderOpen(true);
    }
  };

  const addRepository = (repo: IRepository) => {
    const asset: Asset = {
      id: repo.id,
      name: repo.name,
      html_url: repo.html_url,
      full_name: repo.full_name,
    };
    const key = repositoryKey(asset);
    if (!order.includes(key)) {
      setRepositories({ assets: [...assets, asset], deployments: { ...deployments, [key]: [] } });
    }
    setPickerOpen(false);
  };

  const removeRepository = (key: string) => {
    const rest = { ...deployments };
    delete rest[key];
    setRepositories({ assets: assets.filter((a) => repositoryKey(a) !== key), deployments: rest });
  };

  const slotsOf = (env: string) => (catalogue ? repoSlots(catalogue, env, selection) : -1);

  const toggle = (key: string, env: string) => {
    const mine = deployments[key] ?? [];
    if (mine.includes(env)) {
      setRepositories({ deployments: { ...deployments, [key]: mine.filter((e) => e !== env) } });
      return;
    }
    const slots = slotsOf(env);
    if (slots >= 0 && deploymentCount(deployments, env) >= slots) return;
    setRepositories({ deployments: { ...deployments, [key]: [...mine, env] } });
  };

  const total = Object.values(deployments).reduce((s, list) => s + list.length, 0);
  const full = catalogue ? fullEnvironments(catalogue, selection, deployments) : [];

  const hint =
    full.length > 0
      ? `${full.join(" and ")} ${full.length === 1 ? "is" : "are"} out of slots. A slot is one repository in one environment, counted against that environment's repository limit. Top that limit up in the previous step for more.`
      : "A slot is one repository in one environment, counted against that environment's repository limit. The same repository can deploy to several environments; each deploys its own branch.";

  return (
    <WizardShell
      intro="Connect a repository once, then tick the environments that deploy it."
      note={NOTE}
    >
      <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-6 md:px-8 md:pt-9">
        <div>
          <h1 className="mb-1 text-[26px] font-bold tracking-tight text-high-emphasis">
            Add repositories
          </h1>
          <p className="text-[13px] text-medium-emphasis">
            Tick which environments deploy each repository. Each one deploys its own branch.
          </p>
        </div>

        {/* Desktop: the matrix. */}
        <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th
                  scope="col"
                  className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis"
                >
                  Repository
                </th>
                {envs.map((env) => (
                  <th key={env} scope="col" className="w-[88px] px-1 py-2.5 text-center">
                    <span className="block font-mono text-[11px] font-medium text-high-emphasis">
                      {env}
                    </span>
                    <span className="block font-mono text-[10.5px] text-low-emphasis">
                      {branchFor(env)}
                    </span>
                  </th>
                ))}
                <th className="w-10" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr>
                  <td
                    colSpan={envs.length + 2}
                    className="px-4 py-6 text-center text-[12.5px] text-medium-emphasis"
                  >
                    No repositories connected yet.
                  </td>
                </tr>
              )}
              {assets.map((asset) => {
                const key = repositoryKey(asset);
                return (
                  <tr key={key} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="px-4 py-2.5 font-normal">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-medium-emphasis">
                          <BookMarked size={14} aria-hidden="true" />
                        </span>
                        <span className="font-mono text-[13px] font-medium text-high-emphasis">
                          {asset.full_name}
                        </span>
                      </span>
                    </th>
                    {envs.map((env) => {
                      const on = (deployments[key] ?? []).includes(env);
                      const slots = slotsOf(env);
                      const blocked =
                        !on && slots >= 0 && deploymentCount(deployments, env) >= slots;
                      return (
                        <td key={env} className={cn("text-center", blocked && "opacity-35")}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={blocked}
                            onChange={() => toggle(key, env)}
                            aria-label={`Deploy ${asset.full_name} to ${env}`}
                            className="h-[18px] w-[18px] accent-primary"
                          />
                        </td>
                      );
                    })}
                    <td className="pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeRepository(key)}
                        aria-label={`Disconnect ${asset.full_name} from this project`}
                        className="rounded-md p-1.5 text-low-emphasis hover:bg-accent"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40">
                <td className="px-4 py-2.5">
                  <ConnectButton onClick={openPicker} />
                </td>
                {envs.map((env) => {
                  const slots = slotsOf(env);
                  const n = deploymentCount(deployments, env);
                  const atLimit = slots >= 0 && n >= slots;
                  return (
                    <td key={env} className="text-center">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10.5px]",
                          atLimit
                            ? "bg-warning-100 text-warning-800"
                            : "bg-muted text-medium-emphasis",
                        )}
                      >
                        {n} / {slots < 0 ? "∞" : slots}
                      </span>
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Phone: one card per repository, the environments as tap targets inside it. */}
        <div className="flex flex-col gap-3 md:hidden">
          {assets.map((asset) => {
            const key = repositoryKey(asset);
            return (
              <div key={key} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">
                    {asset.full_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRepository(key)}
                    aria-label={`Disconnect ${asset.full_name} from this project`}
                    className="flex h-11 w-11 items-center justify-center text-low-emphasis"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {envs.map((env) => {
                    const on = (deployments[key] ?? []).includes(env);
                    const slots = slotsOf(env);
                    const blocked = !on && slots >= 0 && deploymentCount(deployments, env) >= slots;
                    return (
                      <button
                        key={env}
                        type="button"
                        aria-pressed={on}
                        disabled={blocked}
                        onClick={() => toggle(key, env)}
                        aria-label={`Deploy ${asset.full_name} to ${env}, branch ${branchFor(env)}`}
                        className={cn(
                          "min-h-11 rounded-md border px-3 font-mono text-[12px] disabled:opacity-35",
                          on
                            ? "border-primary bg-blocks-primary-25 text-blocks-primary-700"
                            : "border-border",
                        )}
                      >
                        {env}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <ConnectButton onClick={openPicker} />
        </div>

        <p className="max-w-[74ch] text-[11.5px] leading-normal text-medium-emphasis">{hint}</p>

        <WizardFooter
          note={
            total === 0
              ? "Nothing is deployed yet — you can set this up later."
              : `${total} ${total === 1 ? "deployment" : "deployments"} across ${envs.length} environments.`
          }
          back={{ onClick: previousStep }}
          primary={
            <Button type="button" onClick={nextStep}>
              Continue
            </Button>
          }
        />
      </div>

      <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
        <DialogContent className="w-[425px] p-6">
          <DialogHeader>
            <DialogTitle>Connect repository</DialogTitle>
            <DialogDescription>
              Select a Git provider to import an existing project from a Git repository.
            </DialogDescription>
          </DialogHeader>
          <ProviderButtons
            extraState={naming.name}
            destination="/intermediate-page"
            onClose={(verifyAuth?: boolean) => {
              setProviderOpen(false);
              setPickerOpen(!!verifyAuth);
            }}
          />
        </DialogContent>
      </Dialog>
      <RepositorySelectionModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelectRepository={addRepository}
        selectedRepositories={assets.map((a) => ({
          id: a.id ?? 0,
          name: a.name,
          full_name: a.full_name ?? a.name,
          html_url: a.html_url,
        }))}
        title="Select repository"
        description="Select the repositories you want to link to this project"
      />
    </WizardShell>
  );
};

const ConnectButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-dashed border-input bg-card px-3.5 text-[12.5px] font-medium text-primary md:min-h-0 md:py-2"
  >
    <Plus size={14} aria-hidden="true" /> Connect a repository
  </button>
);

/** The same picks, keyed in repository order, so a no-op reconcile compares equal. */
const pickOrder = (deployments: Deployments, order: string[]): Deployments =>
  Object.fromEntries(order.map((key) => [key, deployments[key] ?? []]));
