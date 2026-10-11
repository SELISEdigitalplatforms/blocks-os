import { Banner } from "@/components/ui-kits/banner/banner";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CAPTCHA_PROVIDERS } from "@blocks-idp/captcha/models/captcha";
import type { SecretDependent } from "@/cross-modules/secrets/models/secret.model";

export type SecretDependentsAction = "delete" | "purge";

const CLOSING: Record<SecretDependentsAction, string> = {
  delete:
    "They will stop working until you restore this secret or enter a new value in each configuration.",
  purge:
    "They will stop working. Purging can't be undone; each configuration will need a new value.",
};

const dependentLabel = (dependent: SecretDependent): string => {
  if (dependent.kind === "mail") return `Mail — ${dependent.name}`;

  // The server names a CAPTCHA configuration by its stored provider key; show the label the
  // CAPTCHA screen uses for it, so both screens name the same configuration the same way.
  const provider = CAPTCHA_PROVIDERS[dependent.name as keyof typeof CAPTCHA_PROVIDERS];
  return `CAPTCHA — ${provider?.label ?? dependent.name}`;
};

interface SecretDependentsNoticeProps {
  action: SecretDependentsAction;
  isLoading: boolean;
  isError: boolean;
  dependents?: SecretDependent[];
}

/**
 * Names the configurations an Archive or Purge would break. Advisory only: nothing here can
 * stop the action, because refusing it would leave a broken configuration's secret impossible
 * to clean up.
 *
 * Presentational — the owner fetches, so this stays usable without a query client.
 */
export function SecretDependentsNotice({
  action,
  isLoading,
  isError,
  dependents,
}: SecretDependentsNoticeProps) {
  if (isLoading) {
    return (
      <div role="status" className="py-1">
        <span className="sr-only">Checking which configurations use this secret…</span>
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Banner variant="info" className="mb-0">
        Couldn&apos;t check whether any configuration uses this secret.
      </Banner>
    );
  }

  if (!dependents?.length) return null;

  const count = dependents.length;

  return (
    <Banner
      variant="warning"
      className="mb-0"
      title={`In use by ${count} ${count === 1 ? "configuration" : "configurations"}`}
    >
      {/*
        Banner renders its body inside a <p>, which may not contain a <ul>; the list roles give
        the same list semantics to assistive technology with valid markup.
      */}
      <span role="list" className="my-1 block list-disc pl-4">
        {dependents.map((dependent) => (
          <span role="listitem" key={`${dependent.kind}:${dependent.id}`} className="list-item">
            {dependentLabel(dependent)}
          </span>
        ))}
      </span>
      <span className="block">{CLOSING[action]}</span>
    </Banner>
  );
}
