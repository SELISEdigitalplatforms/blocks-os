"use client"

import { useProjectStore } from "@seliseblocks/blocks-kit"
import { PeopleDetailsTab } from "./people-details-tab"
import { PeopleEnvironmentsTab } from "./people-environments-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs"
import { useQueryState } from "nuqs"
import { useNavigate, useParams } from "react-router-dom"
import { useGetUserById } from "@blocks-idp/iam/hooks/use-user"
import { PeopleStatusBadge } from "@/components/people/status-badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui-kits/breadcrumb/breadcrumb"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select"
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton"
import { Button } from "@/components/ui-kits/button/button"
import { ArrowLeft } from "lucide-react"
import { useGetPeople } from "@/hooks/use-people"
import { useGetProjects } from "@/hooks/use-project"
import { UserDevices } from "@blocks-idp/iam/modules/user-management/user-devices"
import { getRuntimeEnv } from "@/lib/runtime-env"

const tabs = [
  { value: "details", label: "Details" },
  { value: "environments", label: "Environments" },
  { value: "devices", label: "Devices" },
]

export const PersonDetailPage = () => {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [currentTab, setCurrentTab] = useQueryState("tab", { defaultValue: "details" })
  const { selectedTenantGroup } = useProjectStore()

  const { data: userResponse, isLoading: isUserLoading } = useGetUserById({
    id,
    projectKey: "",
  })
  const user = userResponse?.data
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : ""

  const { data: peopleData, isLoading: isPeopleLoading } = useGetPeople({
    page: 0,
    pageSize: 100,
    filter: user?.email || "",
  })

  const { data: environmentList, isLoading: isProjectLoading } = useGetProjects(
    selectedTenantGroup || "",
  )

  const sharedEnvironments = peopleData?.peoples?.[0]?.sharedEnviroments || []
  const isPending =
    sharedEnvironments.some((env) => !env.isInvitationConfirmed) &&
    !sharedEnvironments.some((env) => env.isCreator)

  const isLoading = isUserLoading || (user && (isPeopleLoading || isProjectLoading))
  const projectKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || ""

  const handleTabChange = (value: string) => {
    void setCurrentTab(value)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button type="button" onClick={() => navigate("/project-overview/people")}>
                  People
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {isLoading ? <Skeleton className="h-4 w-24" /> : fullName || id}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <>
              <h1 className="mr-4 text-2xl font-bold tracking-tight">
                {fullName || "Person's Details"}
              </h1>
              {isPending && (
                <PeopleStatusBadge
                  status="Pending Invite"
                  className="w-fit bg-warning-100 px-2 py-0.5 text-xs font-normal text-warning-700"
                />
              )}
              {user && (!user.active || !user.isVarified) && (
                <PeopleStatusBadge
                  status="Inactive"
                  className="w-fit bg-blocks-error-100 px-2 py-0.5 text-xs font-normal text-blocks-error-800"
                />
              )}
            </>
          )}
        </div>
      </div>

      <Tabs
        value={currentTab ?? "details"}
        onValueChange={handleTabChange}
        className="mt-[18px] flex w-full flex-col md:mt-[24px]"
      >
        <div className="mb-5 flex items-center justify-between text-base">
          <div className="md:hidden">
            <Select
              value={currentTab ?? "details"}
              onValueChange={(value) => handleTabChange(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden items-center md:flex">
            <TabsList className="h-[42px] bg-blocks-primary-shades-300">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="h-8">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <TabsContent value="details">
          <PeopleDetailsTab user={user} />
        </TabsContent>
        <TabsContent value="environments">
          <PeopleEnvironmentsTab
            user={user}
            peopleData={peopleData?.peoples}
            environmentList={environmentList}
            isViewerOwner={peopleData?.isOwner ?? false}
          />
        </TabsContent>
        <TabsContent value="devices">
          <UserDevices id={id} projectKey={projectKey} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
