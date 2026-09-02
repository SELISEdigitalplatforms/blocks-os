"use client";

import { useProjectStore } from "@seliseblocks/genesis-os";
import { PeopleDetailsTab } from "./people-details-tab";
import { PeopleEnvironmentsTab } from "./people-environments-tab";
import { PeopleAccessTab } from "./people-access-tab";
import { useNavigate, useParams } from "react-router";
import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";
import { PeopleStatusBadge } from "@/components/people/status-badge";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Button } from "@/components/ui-kits/button/button";
import { ArrowLeft } from "lucide-react";
import { useGetPeople } from "@/hooks/use-people";
import { useGetProjects } from "@/hooks/use-project";
import { useProjectPermissions } from "@/hooks/use-project-access";
// Devices tab temporarily disabled.
// import { UserDevices } from "@blocks-idp/iam/modules/user-management/user-devices"
// import { getRuntimeEnv } from "@/lib/runtime-env"

export const PersonDetailPage = () => {
  const { id = "" } = useParams<{
    id: string;
    tenantGroupId: string;
  }>();
  const navigate = useNavigate();
  const { selectedTenantGroup } = useProjectStore();

  // Owner-only: only an owner may read or write another member's grants, so the access card is
  // rendered for them alone.
  // An owner's own grants are the whole catalog, so this doubles as the list of everything
  // grantable — no separate per-person endpoint to fetch it from.
  const { isOwner, can, menus: catalogMenus } = useProjectPermissions(
    selectedTenantGroup ?? undefined,
  );

  const { data: userResponse, isLoading: isUserLoading } = useGetUserById({
    id,
    projectKey: "",
  });
  const user = userResponse?.data;
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  const { data: peopleData, isLoading: isPeopleLoading } = useGetPeople({
    page: 0,
    pageSize: 100,
    filter: user?.email || "",
    searchField: "email",
  });

  const { data: environmentList, isLoading: isProjectLoading } = useGetProjects({
    tenantGroupId: selectedTenantGroup ?? "",
    enabled: !!selectedTenantGroup,
  });

  const person = peopleData?.peoples?.[0];
  const sharedEnvironments = person?.sharedEnviroments || [];

  // Read the rows as well as the derived field. `role` is newer than the rows, so relying on
  // it alone shows an owner the grant form on any server that predates it — and an owner has
  // nothing to grant.
  const isTargetOwner =
    person?.role === "owner" || sharedEnvironments.some((env) => env.isCreator);
  const projectRole = isTargetOwner ? "Owner" : "Contributor";
  const isPending =
    sharedEnvironments.some((env) => !env.isInvitationConfirmed) &&
    !sharedEnvironments.some((env) => env.isCreator);

  const isLoading = isUserLoading || (user && (isPeopleLoading || isProjectLoading));
  // Devices tab temporarily disabled.
  // const projectKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || ""

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back to people">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <>
              <h1 className="min-w-0 text-2xl font-bold tracking-tight">
                {fullName || "Person's Details"}
              </h1>
              {isPending && (
                <PeopleStatusBadge
                  status="Pending Invite"
                  className="w-fit bg-warning-100 px-2 py-0.5 text-xs font-normal text-warning-700"
                />
              )}
              {user && (!user.active || !user.isVerified) && (
                <PeopleStatusBadge
                  status="Inactive"
                  className="w-fit bg-blocks-error-100 px-2 py-0.5 text-xs font-normal text-blocks-error-800"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* One page rather than tabs. Details, Environments and Access held six fields, a
          handful of chips and a checkbox list between them — never enough to justify hiding
          two-thirds of the page behind a tab strip. */}
      <div className="flex flex-col gap-6">
        <PeopleDetailsTab user={user} projectRole={projectRole} />

        <PeopleEnvironmentsTab
          user={user}
          peopleData={peopleData?.peoples}
          environmentList={environmentList}
          canRemove={can("people", "remove")}
          canInvite={can("people", "invite")}
        />

        {isOwner && !isTargetOwner && selectedTenantGroup && id && (
          <PeopleAccessTab
            projectGroupId={selectedTenantGroup}
            userId={id}
            isViewerOwner={isOwner}
            catalogMenus={catalogMenus}
            accessPolicies={person?.accessPolicies ?? []}
            isTargetOwner={isTargetOwner}
            isLoading={isPeopleLoading}
          />
        )}
      </div>
    </main>
  );
};
