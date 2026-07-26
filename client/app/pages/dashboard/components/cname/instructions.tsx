import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { InfoIcon } from "lucide-react";

export const CNameInstruction = ({
  cookieDomainName,
  customDomain,
}: {
  cookieDomainName: string;
  customDomain?: string;
}) => {
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
          DNS CNAME Record for Domain Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="my-2.5 p-0">
        <div>
          <h4>
            Please add the following
            {cookieDomainName ? " two CNAME records" : " CNAME record"} to your DNS configuration to
            complete domain validation:
          </h4>
          {cookieDomainName && (
            <>
              <p className="mt-3 font-semibold">CNAME configuration 1</p>
              <ul className="mt-2 list-disc break-all pl-5">
                <li>
                  Host: <span className="font-semibold">{customDomainHost}</span>
                </li>
                <li className="my-2">Type: CNAME</li>
                <li>
                  Value: <span className="font-semibold">{cnameTarget}</span>
                </li>
              </ul>
              <p className="mt-3 font-semibold">CNAME configuration 2</p>
            </>
          )}
          <ul className="mt-2 list-disc break-all pl-5">
            <li>
              Host: <span className="font-semibold">{apiBaseUrl}</span>
            </li>
            <li className="my-2">Type: CNAME</li>
            <li>
              Value: <span className="font-semibold">{cnameTarget}</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
