import { Link } from "react-router";
import { Pencil } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Button } from "@/components/ui-kits/button/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { oidcClientPath } from "./oidc-client-route";

/** Opens the client's edit page. */
export const OidcClientEditLink = ({ itemId }: Readonly<{ itemId: string }>) => {
  const { t } = useT("os.idp.create-oidc");
  const scoped = useScopedPath();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
        >
          <Link to={scoped(oidcClientPath(itemId))} aria-label={t("common:EDIT")}>
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("common:EDIT")}</TooltipContent>
    </Tooltip>
  );
};
