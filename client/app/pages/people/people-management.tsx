import { InvitePeople } from "./invite-people"
import { PeopleList } from "./people-list"
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card"
import { useGetPeople } from "@/hooks/use-people"

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
)

export const PeopleManagement = () => {
  const { isLoading, data } = useGetPeople({
    page: 0,
    pageSize: 100,
    filter: "",
  })

  if (isLoading) return <PeopleManagementLoading />

  const existingEmails =
    data?.peoples
      ?.map((p) => p.peopleDetails.email?.toLowerCase())
      .filter((email): email is string => email !== undefined) ?? []

  return (
    <main className="flex flex-col p-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold md:text-xl">People</h4>
        <div className="ml-auto flex items-center gap-2">
          <InvitePeople
            existingEmails={existingEmails}
            isViewerOwner={data?.isOwner ?? false}
          />
        </div>
      </div>
      <div className="mb-5 mt-4 flex w-full flex-col">
        <PeopleList />
      </div>
    </main>
  )
}
