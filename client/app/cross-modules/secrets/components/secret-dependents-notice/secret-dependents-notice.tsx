import { Banner } from "@/components/ui-kits/banner/banner";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CAPTCHA_PROVIDERS } from "@blocks-idp/captcha/models/captcha";
import type { SecretDependent } from "@/cross-modules/secrets/models/secret.model";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.secrets";

export type SecretDependentsAction = "delete" | "purge";

const CLOSING: Record<SecretDependentsAction, string> = {
  get delete() {
    return tStatic(I18N_MODULE, "SECRET_DEPENDENTS_NOTICE.THEY_WILL_STOP_WORKING_UNTIL");
  },
  get purge() {
    return tStatic(I18N_MODULE, "SECRET_DEPENDENTS_NOTICE.THEY_WILL_STOP_WORKING_PURGING");
  },
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
  const { t } = useT(I18N_MODULE);
  if (isLoading) {
    return (
      <div role="status" className="py-1">
        <span className="sr-only">
          {t("SECRET_DEPENDENTS_NOTICE.CHECKING_WHICH_CONFIGURATIONS_USE")}
        </span>
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Banner variant="info" className="mb-0">
        {t("SECRET_DEPENDENTS_NOTICE.COULDN_T_CHECK_WHETHER_ANY")}
      </Banner>
    );
  }

  if (!dependents?.length) return null;

  const count = dependents.length;

  return (
    <Banner
      variant="warning"
      className="mb-0"
      title={t("SECRET_DEPENDENTS_NOTICE.IN_USE_BY", { count })}
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
