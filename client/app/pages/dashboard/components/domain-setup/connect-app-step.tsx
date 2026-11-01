import { ArrowUpRight, Info, ShieldCheck } from "lucide-react";
import type { IDomainSetupGuideItem } from "@/models/domain-setup.model";
import { CopyValueButton } from "./copy-value-button";
import { useT } from "@seliseblocks/genesis-os";

const API_URL_ENV_KEY = "VITE_BLOCKS_API_URL";
// The IAM service's Swagger page: loads only when the API host, its certificate and
// the gateway route all work, and is something a person can read in the browser
const CONNECTION_CHECK_PATH = "/iam/v4/swagger/index.html";

interface ConnectAppStepProps {
  guide?: IDomainSetupGuideItem;
  isLoading: boolean;
  /** The site host, for copy. */
  host: string;
}

export const ConnectAppStep = ({ guide, isLoading, host }: ConnectAppStepProps) => {
  const { t } = useT("os.dashboard");
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("CONNECT_APP_STEP.LOADING_CONNECTION_DETAILS")}</p>;
  }

  if (!guide?.apiBaseUrl) {
    return (
      <p className="rounded-md border border-base-error bg-blocks-error-100 px-4 py-3 text-sm text-blocks-error-800">
        {t("CONNECT_APP_STEP.WE_COULDN_T_LOAD_THE")}
      </p>
    );
  }

  const isPlatform = guide.isPlatformDomain;
  const envLine = `${API_URL_ENV_KEY}=${guide.apiBaseUrl}`;
  const connectionCheckUrl = `${guide.apiBaseUrl}${CONNECTION_CHECK_PATH}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
        <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
        {isPlatform ? (
          <p>
            {t("CONNECT_APP_STEP.THIS_IS_YOUR_PROJECT_S", { strong: t("CONNECT_APP_STEP.READY_TO_USE") })}</p>
        ) : (
          <p>
            {t("CONNECT_APP_STEP.DNS_IS_VERIFIED_AND_SSL", { strong: t("CONNECT_APP_STEP.YOUR_DOMAIN_IS_LIVE") })}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-high-emphasis">{t("CONNECT_APP_STEP.YOUR_API_BASE_URL")}</h3>
        <p className="text-sm text-high-emphasis">
          {isPlatform ? (
            t("CONNECT_APP_STEP.APPS_DEPLOYED_ON_THE_DEFAULT")
          ) : (
            <>
              {t("CONNECT_APP_STEP.APPS_DEPLOYED_ON_MUST_CALL", { strong: `${host}` })}</>
          )}
        </p>
        <div className="flex h-12 items-center gap-2 rounded-lg border border-border bg-muted/40 pl-3.5 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[15px] font-medium text-high-emphasis">
            {guide.apiBaseUrl}
          </code>
          <CopyValueButton value={guide.apiBaseUrl} label={t("CONNECT_APP_STEP.COPY_API_BASE_URL")} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-high-emphasis">
            {t("CONNECT_APP_STEP.ADD_IT_TO_YOUR_APP")}
          </h3>
          <span className="text-xs text-muted-foreground">{t("CONNECT_APP_STEP.ENV")}</span>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-slate-900 py-3 pl-4 pr-2 dark:bg-slate-950">
          <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed text-slate-100">
            {envLine}
          </pre>
          <CopyValueButton
            value={envLine}
            label={t("CONNECT_APP_STEP.COPY_ENVIRONMENT_VARIABLE")}
            className="text-slate-300 hover:bg-slate-800 hover:text-white"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("CONNECT_APP_STEP.REBUILD_AND_REDEPLOY_YOUR_APP")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-high-emphasis">{t("CONNECT_APP_STEP.CHECK_THE_CONNECTION")}</h3>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <code
              className="truncate font-mono text-xs text-high-emphasis"
              title={connectionCheckUrl}
            >
              {connectionCheckUrl}
            </code>
            <span className="text-xs text-muted-foreground">
              {t("CONNECT_APP_STEP.SHOULD_OPEN_THE_IAM_API")}
            </span>
          </div>
          <a
            href={connectionCheckUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-semibold text-high-emphasis hover:bg-accent"
          >
            {t("CONNECT_APP_STEP.TEST_NOW")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="flex gap-3 rounded-lg bg-muted/40 px-3.5 py-3 text-sm text-high-emphasis">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {isPlatform ? (
          <p>
            {t("CONNECT_APP_STEP.ADD_IT_WITH_APPS_ON", { strong: t("CONNECT_APP_STEP.DEPLOYING_ON_YOUR_OWN_DOMAIN"), strong2: t("CONNECT_APP_STEP.ADD_DOMAIN") })}</p>
        ) : (
          <p>
            {t("CONNECT_APP_STEP.SIGN_IN_COOKIES_ARE_SET", { strong: t("CONNECT_APP_STEP.WHY_A_SEPARATE_API_URL"), code: `${guide.cookieDomain}` })}</p>
        )}
      </div>
    </div>
  );
};
