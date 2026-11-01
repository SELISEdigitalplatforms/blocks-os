import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { InfoIcon } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

export const CNameInstruction = ({
  cookieDomainName,
  customDomain,
}: {
  cookieDomainName: string;
  customDomain?: string;
}) => {
  const { t } = useT("os.dashboard");
  const apiBaseUrl = "blocksapi." + cookieDomainName;
  // Domains arrive both with and without a protocol prefix
  const customDomainHost = customDomain?.replace(/^https?:\/\//, "");
  // Environment-specific CNAME target (dev-blocksapi…, stg-blocksapi…, …);
  // falls back to the production host when the runtime key isn't configured
  const cnameTarget = getRuntimeEnv("BLOCKS_CNAME_BASE_URL") || "blocksapi.seliseblocks.com";
  return (
    <Card className="max-h-60 min-w-0 overflow-y-auto overflow-x-hidden rounded-sm px-4 py-3 text-base font-normal text-high-emphasis shadow-none">
      {/* plain p-0 (not the v4 `p-0!` syntax) — this repo is on Tailwind v3,
          where `p-0!` compiles to nothing and the default p-6 leaks through */}
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-3 text-lg font-semibold">
          <InfoIcon className="h-6 w-6 shrink-0 text-neutral-300" />
          {t("INSTRUCTIONS.DNS_CNAME_RECORD_FOR_DOMAIN")}
        </CardTitle>
      </CardHeader>
      <CardContent className="my-2.5 p-0">
        <div>
          <h4>
            {cookieDomainName
              ? t("INSTRUCTIONS.PLEASE_ADD_TWO_CNAME_RECORDS")
              : t("INSTRUCTIONS.PLEASE_ADD_A_CNAME_RECORD")}</h4>
          {cookieDomainName && (
            <>
              <p className="mt-3 font-semibold">{t("INSTRUCTIONS.CNAME_CONFIGURATION_1")}</p>
              <ul className="mt-2 list-disc break-all pl-5">
                <li>
                  {t("INSTRUCTIONS.HOST", { span: `${customDomainHost}` })}
                </li>
                <li className="my-2">{t("INSTRUCTIONS.TYPE_CNAME")}</li>
                <li>
                  {t("INSTRUCTIONS.VALUE", { span: `${cnameTarget}` })}
                </li>
              </ul>
              <p className="mt-3 font-semibold">{t("INSTRUCTIONS.CNAME_CONFIGURATION_2")}</p>
            </>
          )}
          <ul className="mt-2 list-disc break-all pl-5">
            <li>
              {t("INSTRUCTIONS.HOST", { span: `${apiBaseUrl}` })}
            </li>
            <li className="my-2">{t("INSTRUCTIONS.TYPE_CNAME")}</li>
            <li>
              {t("INSTRUCTIONS.VALUE", { span: `${cnameTarget}` })}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
