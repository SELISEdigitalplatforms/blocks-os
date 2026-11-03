import { Link } from "react-router";
import { useInvitationConfirmCode } from "./use-invitation-search-params";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui-kits/button/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { PeopleInviteConfirmation } from "./people-invite-confirmation";
import { useT } from "@seliseblocks/genesis-os";

const InvitationMissingCode = () => {
  const { t } = useT("os.invitation");
  return (
    <div className="flex min-h-screen flex-col items-center bg-background">
      <div className="mb-4 mt-[136px] p-4">
        <Logo src="/Logo.svg" width={128} height={54.931} />
      </div>
      <Card className="mx-auto w-full rounded border-solid border-background shadow-none sm:max-w-md sm:border-[#95ADC4]">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl leading-9">Blocks Cloud</CardTitle>
          <CardDescription className="mt-4 text-xl font-semibold text-foreground">
            {t("INVITATION_CONFIRM_PAGE.INVALID_INVITATION_LINK")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">{t("INVITATION_CONFIRM_PAGE.MISSING_CODE")}</p>
          <Link to="/login" className="mt-8 block">
            <Button className="w-full">{t("INVITATION_CONFIRM_PAGE.GO_TO_LOGIN")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export const InvitationConfirmPage = () => {
  const { code, isValid } = useInvitationConfirmCode();

  if (!isValid) {
    return <InvitationMissingCode />;
  }

  return <PeopleInviteConfirmation code={code} />;
};
