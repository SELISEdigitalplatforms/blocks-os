import { PeopleInvitationResult } from "./people-invitation-result";
import { useInvitationResultSearchParams } from "./use-invitation-search-params";

export const InvitationResultPage = () => {
  const resultParams = useInvitationResultSearchParams();

  return <PeopleInvitationResult {...resultParams} />;
};
