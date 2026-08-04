import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useUpdateRepositories } from "@/hooks/use-project";
import type { IDomain, IEnvRepository } from "@seliseblocks/genesis-os/models";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { useMemo } from "react";
import { SetCustomDomainForm } from "./form";

interface SetCustomDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: IEnvRepository | null;
  domains: IDomain[];
  projectKey: string;
  projectEnv: string;
}

// Stored urls can differ from domain entries by protocol, case, or a trailing
// slash — normalize before comparing so pre-selection still matches.
const normalize = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();

export const SetCustomDomainDialog = ({
  open,
  onOpenChange,
  repo,
  domains,
  projectKey,
  projectEnv,
}: SetCustomDomainDialogProps) => {
  const { mutateAsync, isPending } = useUpdateRepositories();

  // Only verified domains are assignable. Dedupe because applications can
  // contain the same domain several times — duplicate Radix Select values
  // cause SelectValue to concatenate every matching item's text.
  const verifiedDomains = useMemo(
    () => Array.from(new Set(domains.filter((d) => d.isDomainVerified).map((d) => d.domain))),
    [domains],
  );

  // Resolve repo's current url to the exact matching option string so Radix
  // Select can preselect it. Falls back to "" (no selection) if unmatched.
  const defaultDomain = useMemo(() => {
    const current = repo?.customDeploymentUrl ?? "";
    if (!current) return "";
    return verifiedDomains.find((d) => normalize(d) === normalize(current)) ?? "";
  }, [repo, verifiedDomains]);

  const handleSubmit = async (domain: string) => {
    if (!repo) return;
    try {
      const res = await mutateAsync({
        projectKey,
        projectEnv,
        repoWithDomains: [
          {
            repoId: repo.itemId,
            repoUrl: repo.repoUrl,
            customDeploymentDomain: domain,
          },
        ],
      });
      if (res.isSuccess) {
        showSuccessToast({ description: "Custom domain updated successfully" });
        onOpenChange(false);
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set custom domain</DialogTitle>
          <DialogDescription>
            Choose a verified domain to assign to{" "}
            <span className="font-medium">{repo?.repoName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* key={repo?.itemId} remounts the form when the target repo changes,
            so defaultValues reinitializes fresh — no useEffect reset needed */}
        <SetCustomDomainForm
          key={repo?.itemId ?? ""}
          defaultDomain={defaultDomain}
          verifiedDomains={verifiedDomains}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
