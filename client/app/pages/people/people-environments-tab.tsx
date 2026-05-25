"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import { X, Plus } from "lucide-react"
import { User } from "@blocks-idp/iam/models/user"
import { useRemoveEnvironmentAccess, useInvitePeople } from "@/hooks/use-people"
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast"
import { Dialog } from "@/components/ui-kits/dialog/dialog"
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal"
import { PeopleGroupedByEnvironments } from "@/models/people"
import { IProjectGroup } from "@/models/project.model"
import { environmentOptions } from "@/constants/environment-options"
import { useProjectStore } from "@/store/useProjectStore"

interface PeopleEnvironmentsTabProps {
  user?: User
  peopleData?: PeopleGroupedByEnvironments[]
  environmentList?: IProjectGroup[]
  isViewerOwner?: boolean
}

type PendingAction = {
  type: "add" | "remove"
  envValue: string
} | null

export const PeopleEnvironmentsTab = ({
  user,
  peopleData,
  environmentList,
  isViewerOwner = false,
}: PeopleEnvironmentsTabProps) => {
  const userEnvironmentData = peopleData?.[0]
  const sharedEnvironments = useMemo(
    () => userEnvironmentData?.sharedEnviroments || [],
    [userEnvironmentData?.sharedEnviroments],
  )
  const isProfileUserOwner = sharedEnvironments.some((env) => env.isCreator)

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)

  const withAccessEnvironments = useMemo(
    () => sharedEnvironments.map((env) => env.enviroment),
    [sharedEnvironments],
  )

  const allAvailableEnvironments = useMemo(() => {
    const projects = environmentList?.[0]?.projects?.map((project) => project.environment) || []
    const nonShared =
      environmentList?.[0]?.nonSharedProject?.map((project) => project.environment) || []
    return Array.from(new Set([...projects, ...nonShared]))
  }, [environmentList])

  const currentAvailableEnvironments = useMemo(() => {
    if (isProfileUserOwner) return allAvailableEnvironments
    return withAccessEnvironments
  }, [isProfileUserOwner, allAvailableEnvironments, withAccessEnvironments])

  const withoutAccessEnvironments = useMemo(() => {
    return allAvailableEnvironments.filter((env) => !currentAvailableEnvironments.includes(env))
  }, [allAvailableEnvironments, currentAvailableEnvironments])

  const { mutateAsync: removeEnvAsync, isPending: isRemoving } = useRemoveEnvironmentAccess()
  const { mutateAsync: inviteAsync, isPending: isInviting } = useInvitePeople()
  const isProcessing = isRemoving || isInviting

  const getEnvironmentLabel = (value: string) => {
    return environmentOptions.find((opt) => opt.value === value)?.label || value
  }

  const getProjectIdForEnvironment = useCallback(
    (envValue: string) => {
      const projectFromEnvList = environmentList?.[0]?.projects?.find(
        (p) => p.environment === envValue,
      )
      if (projectFromEnvList?.tenantId) return projectFromEnvList.tenantId
      const projectFromShared = sharedEnvironments.find((e) => e.enviroment === envValue)
      return projectFromShared?.tenantId || ""
    },
    [environmentList, sharedEnvironments],
  )

  const handleCloseDialog = useCallback(() => {
    setIsConfirmDialogOpen(false)
    setPendingAction(null)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !user) return
    const { type, envValue } = pendingAction
    const projectId = getProjectIdForEnvironment(envValue)
    const groupId =
      useProjectStore.getState().selectedTenantGroup || environmentList?.[0]?.tenantGroupId || ""

    try {
      if (type === "add") {
        if (!user.email || !projectId) return
        const res = await inviteAsync({
          invitations: { [user.email]: [projectId] },
          groupId,
        })
        if (!res?.isSuccess) {
          throw new Error(`Failed to grant access to ${getEnvironmentLabel(envValue)}`)
        }
        showSuccessToast({
          description: `Access granted to ${getEnvironmentLabel(envValue)}`,
        })
      } else {
        if (!user.email || !projectId) return
        const res = await removeEnvAsync({
          email: user.email,
          projectKeys: [projectId],
          groupId,
        })
        if (!res?.isSuccess) {
          throw new Error(`Failed to remove access from ${getEnvironmentLabel(envValue)}`)
        }
        showSuccessToast({
          description: `Access removed from ${getEnvironmentLabel(envValue)}`,
        })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update access"
      showErrorToast({ errors: message })
    } finally {
      handleCloseDialog()
    }
  }, [
    pendingAction,
    user,
    environmentList,
    inviteAsync,
    removeEnvAsync,
    handleCloseDialog,
    getProjectIdForEnvironment,
  ])

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">User data not available</div>
        </CardContent>
      </Card>
    )
  }

  const pendingEnvLabel = pendingAction ? getEnvironmentLabel(pendingAction.envValue) : ""

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Environment Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-foreground">With access to</div>
            <div className="flex flex-wrap gap-3">
              {currentAvailableEnvironments.length > 0 ? (
                currentAvailableEnvironments.map((envValue) => (
                  <div
                    key={envValue}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 shadow-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium">{getEnvironmentLabel(envValue)}</span>
                    {isViewerOwner && !isProfileUserOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAction({ type: "remove", envValue })
                          setIsConfirmDialogOpen(true)
                        }}
                        disabled={isProcessing}
                        className="ml-2 cursor-pointer p-1 text-destructive transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Remove access"
                        aria-label={`Remove access from ${getEnvironmentLabel(envValue)}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm italic text-muted-foreground">
                  No environments with access yet
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="text-sm font-semibold text-foreground">Without access to</div>
            <div className="flex flex-wrap gap-3">
              {withoutAccessEnvironments.length > 0 ? (
                withoutAccessEnvironments.map((envValue) => (
                  <div
                    key={envValue}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 shadow-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium">{getEnvironmentLabel(envValue)}</span>
                    {isViewerOwner && !isProfileUserOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAction({ type: "add", envValue })
                          setIsConfirmDialogOpen(true)
                        }}
                        disabled={isProcessing}
                        className="ml-2 cursor-pointer p-1 text-primary transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Grant access"
                        aria-label={`Grant access to ${getEnvironmentLabel(envValue)}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm italic text-muted-foreground">
                  Has access to all environments
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        {isConfirmDialogOpen && pendingAction && (
          <ConfirmationModal
            onCancel={handleCloseDialog}
            onConfirm={handleConfirm}
            buttonState={{ confirm: { disable: isProcessing } }}
            data={{
              dialogTitle: pendingAction.type === "add" ? "Grant Access" : "Remove Access",
              dialogSubtitle:
                pendingAction.type === "add"
                  ? `Are you sure you want to grant ${user.email} access to ${pendingEnvLabel}?`
                  : `Are you sure you want to remove ${user.email}'s access from ${pendingEnvLabel}?`,
              confirmButton: pendingAction.type === "add" ? "Grant" : "Remove",
              cancelButton: "Cancel",
            }}
          />
        )}
      </Dialog>
    </>
  )
}
