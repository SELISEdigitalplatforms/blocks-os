import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Separator } from "@/components/ui-kits/separator/separator";
import { Button } from "@/components/ui-kits/button/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  buildDataGatewayConfigurationFormSchema,
  dataGatewayConfigurationFormDefaultValue,
  toDataGatewayConfigurationFormValues,
} from "./utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { z } from "zod";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useSaveDataGatewayConfiguration } from "@/cross-modules/data-gateway/hooks/use-data-gateway-configuration";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  IDataGatewayConfiguration,
  IDataGatewayConfigurationSavePayload,
} from "@/cross-modules/data-gateway/models/data-gateway.model";
import { isErrorWithErrors } from "@/lib/error";

type SaveDataGatewayConfigurationProps = {
  configuration?: IDataGatewayConfiguration;
  onClose: (val: boolean) => void;
};

export const SaveDataGatewayConfiguration = ({
  onClose,
  configuration,
}: SaveDataGatewayConfigurationProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  // Editing only ever identifies a configuration by its itemId - the project it belongs to is
  // fixed once it exists, so the project key field is only editable while creating.
  const isEditMode = !!configuration;
  const dataGatewayConfigurationFormSchema = buildDataGatewayConfigurationFormSchema(isEditMode);
  // `SaveDataGatewayConfiguration` never actually unmounts between dialog opens - it's an
  // unconditional child of the page's <Dialog>, which only toggles Radix's internal open state,
  // not this component's presence in the tree. `values` keeps the form in sync with
  // `configuration` on every change, not just on this component's very first mount.
  const form = useForm({
    defaultValues: dataGatewayConfigurationFormDefaultValue,
    values: toDataGatewayConfigurationFormValues(configuration, tenantId),
    resolver: zodResolver(dataGatewayConfigurationFormSchema),
  });
  const { isPending, mutateAsync } = useSaveDataGatewayConfiguration();

  const onFormSubmitHandler = async (
    values: z.infer<typeof dataGatewayConfigurationFormSchema>,
  ) => {
    try {
      const mutableSettings = {
        connectionString: values.connectionString,
        databaseName: values.databaseName,
        isCollectionNameEditable: values.isCollectionNameEditable,
        collectionNamePattern: values.collectionNamePattern,
        enableAnalytics: values.enableAnalytics,
      };
      const payload: IDataGatewayConfigurationSavePayload = configuration
        ? {
            ...mutableSettings,
            itemId: configuration.itemId,
            updateRequest: true,
          }
        : {
            ...mutableSettings,
            projectKey: values.projectKey,
            updateRequest: false,
          };
      const res = await mutateAsync(payload);
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: configuration
          ? "Configuration updated successfully"
          : "New configuration added successfully",
      });
      onClose(false);
      form.reset();
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <DialogContent className="rounded-md sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>{configuration ? "Edit" : "Add"} DataGateway Configuration</DialogTitle>
        <DialogDescription>
          {isEditMode
            ? "Enter a new connection string to rotate it. The project this configuration belongs to cannot be changed."
            : "Configure the Mongo data source used by a project's DataGateway module."}
        </DialogDescription>
      </DialogHeader>
      <div>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(onFormSubmitHandler, (errors) => {
              // A validation failure here would otherwise be completely silent - log it so it's
              // possible to tell a stale/hidden-field error apart from user inattention.
              console.error("[SaveDataGatewayConfiguration] validation failed", errors);
              showErrorToast({ errors: "Please check the highlighted fields and try again." });
            })}
          >
            <div className="mt-2 grid grid-cols-1 gap-4 text-left text-sm md:grid-cols-2">
              <FormField
                name="projectKey"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Key</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter project key"
                        {...field}
                        disabled={isEditMode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="databaseName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Database Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter database name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="connectionString"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Connection String</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="off"
                        placeholder={
                          isEditMode
                            ? "Enter a new connection string to rotate it"
                            : "Enter connection string"
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="collectionNamePattern"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Collection Name Pattern</FormLabel>
                    <FormControl>
                      <Input placeholder="sb_{SchemaName}s" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="mt-2" />

            <div className="text-left text-sm">
              <div className="mt-2 rounded-md border">
                <FormField
                  name="isCollectionNameEditable"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <FormLabel>Editable Collection Names</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Allow collection names to deviate from the pattern above.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          aria-label="Editable Collection Names"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  name="enableAnalytics"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 border-t px-4 py-3">
                      <div>
                        <FormLabel>Enable Analytics</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Opt this project&apos;s data into analytics processing.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          aria-label="Enable Analytics"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="mt-6 flex w-full items-center justify-end">
              <div className="flex flex-row gap-2">
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={isPending}>
                    Cancel
                  </Button>
                </DialogTrigger>
                <Button variant="default" disabled={isPending}>
                  Save
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </DialogContent>
  );
};
