import { UserProfileShell } from "@blocks-idp/iam/components/user-profile-shell";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { UserActionMenu } from "./user-action-menu";
import { UserDevices } from "../user-devices/user-devices";
import { UserHistories } from "../user-histories";
import { UserAccessTab } from "../user-access";
import { Smartphone, Clock, KeyRound } from "lucide-react";
import { ReactNode } from "react";

type UserProps = {
  id: string;
};

export const User = ({ id }: UserProps) => {
  // The IAM source hard-codes an empty projectKey because that app is already
  // scoped to a single tenant. OS is multi-project, so every IAM read has to
  // carry the selected project's tenant id.
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const tabs: { value: string; label: string; icon: ReactNode; render: () => ReactNode }[] = [
    {
      value: "access",
      label: "Access",
      icon: <KeyRound className="h-3.5 w-3.5" />,
      render: () => <UserAccessTab userId={id} projectKey={tenantId} />,
    },
    {
      value: "devices",
      label: "Sessions",
      icon: <Smartphone className="h-3.5 w-3.5" />,
      render: () => <UserDevices id={id} projectKey={tenantId} />,
    },
    {
      value: "history",
      label: "History",
      icon: <Clock className="h-3.5 w-3.5" />,
      render: () => <UserHistories id={id} projectKey={tenantId} />,
    },
  ];

  return (
    <UserProfileShell
      id={id}
      projectKey={tenantId}
      defaultTab="access"
      tabs={tabs}
      rightSlot={<UserActionMenu id={id} projectKey={tenantId} />}
    />
  );
};
