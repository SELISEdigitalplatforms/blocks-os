import { ArrowUpRight, Info, ShieldCheck } from "lucide-react";
import type { IDomainSetupGuideItem } from "@/models/domain-setup.model";
import { CopyValueButton } from "./copy-value-button";

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
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading connection details…</p>;
  }

  if (!guide?.apiBaseUrl) {
    return (
      <p className="rounded-md border border-base-error bg-blocks-error-100 px-4 py-3 text-sm text-blocks-error-800">
        We couldn’t load the API base URL for this domain. Close this window and try again.
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
            <strong>Ready to use.</strong> This is your project’s default domain. It’s already
            verified and secured, so no DNS setup is needed.
          </p>
        ) : (
          <p>
            <strong>Your domain is live.</strong> DNS is verified and SSL certificates are installed
            for your app and its API.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-high-emphasis">Your API base URL</h3>
        <p className="text-sm text-high-emphasis">
          {isPlatform ? (
            "Apps deployed on the default domain call Blocks through this URL."
          ) : (
            <>
              Apps deployed on <strong>{host}</strong> must call Blocks through this URL, not the
              default one.
            </>
          )}
        </p>
        <div className="flex h-12 items-center gap-2 rounded-lg border border-border bg-muted/40 pl-3.5 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[15px] font-medium text-high-emphasis">
            {guide.apiBaseUrl}
          </code>
          <CopyValueButton value={guide.apiBaseUrl} label="Copy API base URL" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-high-emphasis">
            Add it to your app’s environment
          </h3>
          <span className="text-xs text-muted-foreground">.env</span>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-slate-900 py-3 pl-4 pr-2 dark:bg-slate-950">
          <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed text-slate-100">
            {envLine}
          </pre>
          <CopyValueButton
            value={envLine}
            label="Copy environment variable"
            className="text-slate-300 hover:bg-slate-800 hover:text-white"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Rebuild and redeploy your app after changing it. Vite reads these values at build time.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-high-emphasis">Check the connection</h3>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <code
              className="truncate font-mono text-xs text-high-emphasis"
              title={connectionCheckUrl}
            >
              {connectionCheckUrl}
            </code>
            <span className="text-xs text-muted-foreground">
              Should open the IAM API’s Swagger page
            </span>
          </div>
          <a
            href={connectionCheckUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-semibold text-high-emphasis hover:bg-accent"
          >
            Test now
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="flex gap-3 rounded-lg bg-muted/40 px-3.5 py-3 text-sm text-high-emphasis">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {isPlatform ? (
          <p>
            <strong>Deploying on your own domain?</strong> Add it with <strong>Add Domain</strong>.
            Apps on a custom domain use a different API URL, which you’ll get after setup.
          </p>
        ) : (
          <p>
            <strong>Why a separate API URL?</strong> Sign-in cookies are set on{" "}
            <code className="font-mono">{guide.cookieDomain}</code>. The API must be on the same
            domain for sessions to work in the browser.
          </p>
        )}
      </div>
    </div>
  );
};
