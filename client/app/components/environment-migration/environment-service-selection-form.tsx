import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle } from "lucide-react"
import { useStepper } from "@/components/stepper/stepper-provider"
import { useGetProjects } from "@/hooks/use-project"
import { useProjectStore } from "@/store/useProjectStore"
import { environmentOptions } from "@/components/create-project/form/create-project-environments-form/utils"
import { Button } from "@/components/ui-kits/button/button"
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox"
import { Switch } from "@/components/ui-kits/switch/switch"
import { Badge } from "@/components/ui-kits/badge/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip"
import { useDataMigrationFormState } from "./migration-form-state"
import {
  environmentServiceSelectionFormDefaultValue,
  environmentServiceSelectionFormSchema,
  MIGRATION_SERVICE_UI_CATALOG,
} from "./migration-form-schema"

export const EnvironmentServiceSelectionForm = () => {
  const { formData, setFormData } = useDataMigrationFormState()
  const { nextStep } = useStepper()
  const groupId = useProjectStore().selectedTenantGroup
  const { data: projectGroups = [], isLoading } = useGetProjects(groupId ?? "")

  const form = useForm({
    values: formData[0],
    resolver: zodResolver(environmentServiceSelectionFormSchema),
  })

  const handleSubmit = (values: typeof environmentServiceSelectionFormDefaultValue) => {
    setFormData(0, values)
    nextStep()
  }

  const { isValid } = form.formState
  const selectedServices = form.watch("services")
  const sourceEnvironment = form.watch("sourceEnvironment")
  const targetEnvironment = form.watch("targetEnvironment")

  const projectEnvironmentOptions = useMemo(() => {
    if (!groupId || isLoading) return []

    const currentTenantGroup = projectGroups.find(
      (group) => group.tenantGroupId === groupId,
    )

    if (!currentTenantGroup) return []

    return currentTenantGroup.projects.map((project) => {
      const envOption = environmentOptions.find((env) => env.value === project.environment)
      return {
        value: project.tenantId,
        label: envOption?.label || project.environment,
        environment: project.environment,
      }
    })
  }, [projectGroups, groupId, isLoading])

  const availableServices = [...MIGRATION_SERVICE_UI_CATALOG].sort((a, b) => {
    if (a.available && !b.available) return -1
    if (!a.available && b.available) return 1
    return 0
  })

  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="mt-4 flex flex-col gap-1 text-left">
            <p className="text-3xl font-bold tracking-tight">
              Select environments &amp; services
            </p>
            <p className="mb-8 text-sm text-medium-emphasis">
              Choose the source and target environments, then select which services
              to migrate.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Environments</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sourceEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source environment</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          if (value === targetEnvironment) return
                          field.onChange(value)
                          const selectedOption = projectEnvironmentOptions.find(
                            (opt) => opt.value === value,
                          )
                          if (selectedOption) {
                            form.setValue("sourceEnvironmentName", selectedOption.label)
                          }
                        }}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Source environment">
                            <SelectValue
                              placeholder={
                                isLoading
                                  ? "Loading environments..."
                                  : "Select source environment"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectEnvironmentOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              disabled={option.value === targetEnvironment}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target environment</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          if (value === sourceEnvironment) return
                          field.onChange(value)
                          const selectedOption = projectEnvironmentOptions.find(
                            (opt) => opt.value === value,
                          )
                          if (selectedOption) {
                            form.setValue("targetEnvironmentName", selectedOption.label)
                          }
                        }}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Target environment">
                            <SelectValue
                              placeholder={
                                isLoading
                                  ? "Loading environments..."
                                  : "Select target environment"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectEnvironmentOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              disabled={option.value === sourceEnvironment}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold">Services</h3>
              <FormField
                control={form.control}
                name="services"
                render={() => (
                  <FormItem>
                    <div className="grid grid-cols-1 gap-4">
                      {availableServices.map((service) => {
                        const isSelected = selectedServices.some(
                          (s) => s.name === service.id && s.selected,
                        )
                        return (
                          <Card
                            key={service.id}
                            className={`transition-colors ${
                              !service.available
                                ? "cursor-not-allowed opacity-50"
                                : isSelected
                                  ? "cursor-pointer border-primary"
                                  : "cursor-pointer hover:border-primary/50"
                            }`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <FormField
                                    control={form.control}
                                    name="services"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.some(
                                              (s) => s.name === service.id && s.selected,
                                            )}
                                            disabled={!service.available}
                                            onCheckedChange={(checked) => {
                                              const currentServices = field.value || []
                                              if (checked) {
                                                const existingIndex =
                                                  currentServices.findIndex(
                                                    (s) => s.name === service.id,
                                                  )
                                                if (existingIndex >= 0) {
                                                  const updated = [...currentServices]
                                                  updated[existingIndex] = {
                                                    ...updated[existingIndex],
                                                    selected: true,
                                                  }
                                                  field.onChange(updated)
                                                } else {
                                                  field.onChange([
                                                    ...currentServices,
                                                    {
                                                      name: service.id,
                                                      label: service.name,
                                                      selected: true,
                                                      overrideData: false,
                                                    },
                                                  ])
                                                }
                                              } else {
                                                field.onChange(
                                                  currentServices.map((s) =>
                                                    s.name === service.id
                                                      ? { ...s, selected: false }
                                                      : s,
                                                  ),
                                                )
                                              }
                                            }}
                                            aria-label={`Select ${service.name}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <CardTitle className="text-base font-medium">
                                    {service.name}
                                  </CardTitle>
                                </div>
                                {service.available && isSelected && (
                                  <FormField
                                    control={form.control}
                                    name="services"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                        {field.value?.find((s) => s.name === service.id)
                                          ?.overrideData ? (
                                          <Tooltip>
                                            <TooltipTrigger type="button" asChild>
                                              <div className="flex cursor-help items-center space-x-1">
                                                <FormLabel className="text-xs font-normal text-muted-foreground">
                                                  Overwrite data
                                                </FormLabel>
                                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                This will overwrite existing data in the
                                                target environment
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : (
                                          <FormLabel className="text-xs font-normal text-muted-foreground">
                                            Overwrite data
                                          </FormLabel>
                                        )}
                                        <FormControl>
                                          <Switch
                                            checked={
                                              field.value?.find((s) => s.name === service.id)
                                                ?.overrideData || false
                                            }
                                            onCheckedChange={(checked) => {
                                              const currentServices = field.value || []
                                              field.onChange(
                                                currentServices.map((s) =>
                                                  s.name === service.id
                                                    ? { ...s, overrideData: !!checked }
                                                    : s,
                                                ),
                                              )
                                            }}
                                            aria-label={`Overwrite data for ${service.name}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {service.available ? (
                                <div className="flex flex-wrap gap-2">
                                  {service.chips.map((chip) => (
                                    <Badge key={chip} variant="secondary" className="text-xs">
                                      {chip}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Not available for this service
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="mb-8 mt-8 flex">
            <Button type="submit" disabled={!isValid}>
              Continue
            </Button>
          </div>
        </form>
      </Form>
    </TooltipProvider>
  )
}
