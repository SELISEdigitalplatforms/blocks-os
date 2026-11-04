import { Button } from "@/components/ui-kits/button/button";
import { Logs } from "lucide-react";
import { Link } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
type LogMenuProps = {
  link: string;
};
export const LogMenu = ({ link }: LogMenuProps) => {
  const { t } = useT("os.lmt");
  return (
    <Link to={link}>
      <Button variant="outline" size="sm">
        <Logs className="h-5 w-5" />
        <span className="sr-only sm:not-sr-only sm:ml-2.5">{t("LOG_MENU.LOGS")}</span>
      </Button>
    </Link>
  );
};
