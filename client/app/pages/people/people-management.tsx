import { InvitePeople } from "./invite-people";
import { PeopleList } from "./people-list";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetPeople } from "@/hooks/use-people";
import { useProjectPermissions } from "@/hooks/use-project-access";
import { usePeopleFilterQueryParams } from "./people-filter-toolbar";
import { useMemo } from "react";

export const PeopleManagementLoading = () => (
  <main className="flex flex-col p-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="mb-5 mt-4 flex w-full flex-col">
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  </main>
);

export const PeopleManagement = () => {
  const { queryParams, setQueryParams } = usePeopleFilterQueryParams();
  const projectGroupId = useProjectStore().selectedTenantGroup ?? undefined;
  const { can, isOwner } = useProjectPermissions(projectGroupId);
  const { isLoading, isFetching, data } = useGetPeople({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    filter: queryParams.search,
    searchField: queryParams.searchField as "name" | "email",
  });

  // "3 members, 1 invitation pending" is the question an owner actually opens this page with,
  // and it was previously only answerable by reading every badge in the table.
  const pendingCount = useMemo(
    () =>
      data?.peoples?.filter(
        (person) =>
          (person.sharedEnviroments ?? []).some(
            (env) => env.isInvitationSent && !env.isInvitationConfirmed,
          ) && !(person.sharedEnviroments ?? []).some((env) => env.isCreator),
      ).length ?? 0,
    [data?.peoples],
  );

  const existingEmails = useMemo(() => {
    return (
      data?.peoples
        ?.map((p) => p.peopleDetails.email?.toLowerCase())
        .filter((email): email is string => email !== undefined) ?? []
    );
  }, [data?.peoples]);

  const onPageChangeHandler = (page: number) => {
    setQueryParams((prev) => ({
      ...prev,
      page,
    }));
  };

  const onPageSizeChangeHandler = (pageSize: number) => {
    setQueryParams((prev) => ({
      ...prev,
      pageSize,
      page: 0,
    }));
  };
  if (isLoading) return <PeopleManagementLoading />;

  return (
    <main className="flex flex-col p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold md:text-xl">People</h4>
          <p className="mt-0.5 text-sm text-medium-emphasis">
            {data?.totalCount ?? 0} {(data?.totalCount ?? 0) === 1 ? "member" : "members"}
            {pendingCount > 0 &&
              ` · ${pendingCount} ${pendingCount === 1 ? "invitation" : "invitations"} pending`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <InvitePeople existingEmails={existingEmails} canInvite={can("people", "invite")} />
        </div>
      </div>
      <div className="mb-5 mt-4 flex w-full flex-col">
        <PeopleList
          data={data}
          canInvite={can("people", "invite")}
          canRemove={can("people", "remove")}
          isOwner={isOwner}
          isPeopleLoading={isLoading || isFetching}
          page={queryParams.page}
          pageSize={queryParams.pageSize}
          onPageChange={onPageChangeHandler}
          onPageSizeChange={onPageSizeChangeHandler}
        />
      </div>
    </main>
  );
};
