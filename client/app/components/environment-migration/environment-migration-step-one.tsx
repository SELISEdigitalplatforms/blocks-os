import { useMemo, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select"
import { Label } from "@/components/ui-kits/label/label"
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton"
import { useGetAllServices } from "@blocks-identifier/hooks/use-services"
import type { IProject } from "@/models/project.model"
import { MigrationStepper } from "./migration-stepper"
import { ServiceSelectionCard } from "./service-selection-card"
import {
  MIGRATION_SERVICE_CATALOG,
  isMigrationServiceRegistered,
  type MigrationServiceId,
} from "./migration-services.config"

type EnvironmentMigrationStepOneProps = {
  projects: IProject[]
  isProjectsLoading: boolean
  hideStepper?: boolean
}

export const EnvironmentMigrationStepOne = ({
  projects,
  isProjectsLoading,
  hideStepper = false,
}: EnvironmentMigrationStepOneProps) => {
  const [sourceProjectKey, setSourceProjectKey] = useState("")
  const [targetProjectKey, setTargetProjectKey] = useState("")
  const [selectedServiceIds, setSelectedServiceIds] = useState<
    Set<MigrationServiceId>
  >(() => new Set())

  const targetOptions = useMemo(
    () => projects.filter((project) => project.tenantId !== sourceProjectKey),
    [projects, sourceProjectKey],
  )

  const { data: serviceData, isLoading: isServicesLoading } = useGetAllServices({
    page: 0,
    pageSize: 100,
    projectKey: sourceProjectKey,
  })

  const registeredNames = useMemo(
    () => (serviceData?.data ?? []).map((service) => service.name),
    [serviceData?.data],
  )

  const handleSourceChange = (value: string) => {
    setSourceProjectKey(value)
    if (targetProjectKey === value) setTargetProjectKey("")
    setSelectedServiceIds(new Set())
  }

  const handleTargetChange = (value: string) => {
    setTargetProjectKey(value)
  }

  const handleServiceToggle = (serviceId: MigrationServiceId, checked: boolean) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(serviceId)
      else next.delete(serviceId)
      return next
    })
  }

  const showServices = Boolean(sourceProjectKey)

  const formSection = (
      <section className="rounded-xl border border-border bg-background p-6 shadow-sm md:p-8">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Select environments &amp; services
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the source and target environments, then select which services
            to migrate.
          </p>
        </header>

        <div className="space-y-8">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Environments
            </h3>
            {isProjectsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="source-environment">Source environment</Label>
                  <Select
                    value={sourceProjectKey}
                    onValueChange={handleSourceChange}
                  >
                    <SelectTrigger id="source-environment" aria-label="Source environment">
                      <SelectValue placeholder="Select source environment" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem
                          key={project.tenantId}
                          value={project.tenantId}
                        >
                          {project.environment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-environment">Target environment</Label>
                  <Select
                    value={targetProjectKey}
                    onValueChange={handleTargetChange}
                    disabled={!sourceProjectKey}
                  >
                    <SelectTrigger id="target-environment" aria-label="Target environment">
                      <SelectValue placeholder="Select target environment" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.map((project) => (
                        <SelectItem
                          key={project.tenantId}
                          value={project.tenantId}
                        >
                          {project.environment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Services
            </h3>
            {!showServices && (
              <p className="text-sm text-muted-foreground">
                Select a source environment to load available services.
              </p>
            )}
            {showServices && isServicesLoading && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            )}
            {showServices && !isServicesLoading && (
              <div className="space-y-3">
                {MIGRATION_SERVICE_CATALOG.map((service) => {
                  const available = isMigrationServiceRegistered(
                    service.registryNames,
                    registeredNames,
                  )
                  return (
                    <ServiceSelectionCard
                      key={service.id}
                      label={service.label}
                      tags={service.tags}
                      available={available}
                      checked={selectedServiceIds.has(service.id)}
                      onCheckedChange={(checked) =>
                        handleServiceToggle(service.id, checked)
                      }
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
  )

  if (hideStepper) {
    return formSection
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(220px,280px)_1fr]">
      <aside className="lg:pt-2">
        <MigrationStepper activeStep={1} />
      </aside>
      {formSection}
    </div>
  )
}
