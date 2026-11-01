import { Button } from "@/components/ui-kits/button/button";
import { useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Activity, Ticket } from "lucide-react";
import { Link } from "react-router";

const I18N_MODULE = "os.idp.signup-links";

export const ActivityChooseState = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
      data-testid="activity-choose"
    >
      <Activity className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t("ACTIVITY_EMPTY_STATES.CHOOSE")}</p>
    </div>
  );
};

export const ActivityNoneState = () => {
  const { t } = useT(I18N_MODULE);
  const scoped = useScopedPath();
  return (
    <div
      className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
      data-testid="activity-none"
    >
      <Ticket className="h-6 w-6 text-muted-foreground" />
      <h2 className="text-base font-semibold text-high-emphasis">
        {t("ACTIVITY_EMPTY_STATES.NONE_TITLE")}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {t("ACTIVITY_EMPTY_STATES.NONE_BODY")}
      </p>
      <Link to={scoped("iam/signup-link-configurations")}>
        <Button variant="outline">{t("ACTIVITY_EMPTY_STATES.NONE_BUTTON")}</Button>
      </Link>
    </div>
  );
};

export const ActivityEmptyState = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
      data-testid="activity-empty"
    >
      <p className="text-sm text-muted-foreground">{t("ACTIVITY_EMPTY_STATES.EMPTY")}</p>
    </div>
  );
};

export const ActivityUnknownState = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
      data-testid="activity-unknown"
    >
      <p className="text-sm text-muted-foreground">{t("ACTIVITY_EMPTY_STATES.UNKNOWN")}</p>
    </div>
  );
};

export const ActivityForbiddenState = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <div
      className="flex min-h-[320px] items-center justify-center rounded-xl py-16 text-center text-sm text-muted-foreground"
      data-testid="activity-forbidden"
    >
      {t("ACTIVITY_EMPTY_STATES.FORBIDDEN")}
    </div>
  );
};

export const ActivityErrorState = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useT(I18N_MODULE);
  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center text-sm text-muted-foreground"
      data-testid="activity-error"
    >
      <p>{t("ACTIVITY_EMPTY_STATES.ERROR")}</p>
      <Button variant="outline" onClick={onRetry}>
        {t("common:RETRY")}
      </Button>
    </div>
  );
};
