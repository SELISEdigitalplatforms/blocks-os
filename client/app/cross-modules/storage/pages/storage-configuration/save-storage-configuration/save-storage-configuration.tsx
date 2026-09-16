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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  buildStorageConfigurationFormSchema,
  storageConfigurationFormDefaultValue,
  toStorageConfigurationFormValues,
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
import { useSaveStorageConfiguration } from "@blocks-storage/hooks/use-storage-configuration";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  IStorageConfiguration,
  IStorageConfigurationSavePayload,
  STORAGE_STRATEGIES,
  StorageStrategyType,
} from "@blocks-storage/models/storage.model";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
type SaveStorageConfigurationProps = {
  configuration?: IStorageConfiguration;
  onClose: (val: boolean) => void;
};
export const SaveStorageConfiguration = ({
  onClose,
  configuration,
}: SaveStorageConfigurationProps) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  // Editing only ever changes the Phase 1 upload/verification settings below; the provider
  // identity and its credentials are fixed once a configuration exists.
  const isEditMode = !!configuration;
  const storageConfigurationFormSchema = buildStorageConfigurationFormSchema(isEditMode);
  // `SaveStorageConfiguration` never actually unmounts between dialog opens - it's an
  // unconditional child of the storage page's <Dialog>, which only toggles Radix's internal
  // open state, not this component's presence in the tree. `defaultValues` alone only applies
  // once, at this component's very first mount (when `configuration` was still undefined), so
  // every subsequent Edit open would otherwise keep reusing that stale, empty form state. `values`
  // keeps the form in sync with `configuration` on every change instead.
  const form = useForm({
    defaultValues: storageConfigurationFormDefaultValue,
    values: toStorageConfigurationFormValues(configuration),
    resolver: zodResolver(storageConfigurationFormSchema),
  });
  const { isPending, mutateAsync } = useSaveStorageConfiguration();
  const onFormSubmitHandler = async (values: z.infer<typeof storageConfigurationFormSchema>) => {
    try {
      const { maxFileSizeInMb, ...rest } = values;
      // The settings below are the only ones an update may change. Everything else - the name, the
      // provider and its credentials - is fixed once a configuration exists and is discarded by the
      // server on an update, so an update request simply doesn't carry it. That also keeps the
      // masked secrets the read endpoint returned (e.g. "D****...t") from being sent back at all.
      const mutableSettings = {
        uploadUrlExpirySeconds: Number(values.uploadUrlExpirySeconds),
        downloadUrlExpirySeconds: Number(values.downloadUrlExpirySeconds),
        maxFileSizeInBytes: Math.round(Number(maxFileSizeInMb) * 1024 * 1024),
        uploadCompletionRequiredFor: values.uploadCompletionRequiredFor,
      };
      const payload: IStorageConfigurationSavePayload = configuration
        ? {
            ...mutableSettings,
            projectKey: tenantId,
            updateRequest: true,
            itemId: configuration.itemId,
          }
        : {
            ...rest,
            ...mutableSettings,
            storageStrategy: values.storageStrategy as StorageStrategyType,
            projectKey: tenantId,
            updateRequest: false,
            itemId: null,
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
  const storageStrategy = form.watch("storageStrategy") as StorageStrategyType;
  return (
    <DialogContent className="rounded-md sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle>{configuration ? "Edit" : "Add"} Storage Configuration</DialogTitle>
        <DialogDescription>
          {isEditMode
            ? "Only the upload and verification settings below can be changed."
            : "Ensure you have selected a storage configuration provider to move forward."}
        </DialogDescription>
      </DialogHeader>
      <div>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(onFormSubmitHandler, (errors) => {
              // A validation failure here would otherwise be completely silent: the field it's
              // attached to may not even be rendered (e.g. a stale error on a provider-credential
              // field left over from before edit mode hid that section).
              console.error("[SaveStorageConfiguration] validation failed", errors);
              showErrorToast({ errors: "Please check the highlighted fields and try again." });
            })}
          >
            {!isEditMode && (
              <FormField
                control={form.control}
                name="storageStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Provider</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.clearErrors();
                        }}
                        value={field.value}
                      >
                        <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                          <SelectValue placeholder="Select configuration provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {STORAGE_STRATEGIES.map((item) => (
                            <SelectItem key={item.id} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            {!isEditMode && (
            <div className="mt-2 grid grid-cols-1 gap-4 text-left text-sm md:grid-cols-2">
              <FormField
                name="name"
                key="name"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {storageStrategy === "AWS" && (
                <>
                  <FormField
                    name="accessKey"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Key</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter access key"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="secretKey"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secret Key</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter secret key"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="cloudStorageRegionEndPoint"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region Endpoint</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter region endpoint"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {storageStrategy === "Azure" && (
                <FormField
                  name="connectionString"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection String</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter connection string"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {storageStrategy === "S3Compatible" && (
                <>
                  <FormField
                    name="accessKey"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Key</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter access key"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="secretKey"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secret Key</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter secret key"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="host"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Host URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter host URL"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {storageStrategy === "SftpStorage" && (
                <>
                  <FormField
                    name="remoteBasePath"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remote Base Path</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter remote base path"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="host"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Host IP Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter host" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="port"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PORT</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter port"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="userName"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter username"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="password"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter password"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
            )}

            <Separator className="mt-2" />

            <div className="text-left text-sm">
              <h3 className="text-sm font-medium">
                Upload &amp; verification settings
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Controls how long signed URLs stay valid and which uploads are
                held for verification before they become readable.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  name="uploadUrlExpirySeconds"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upload URL Expiry (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="600"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="downloadUrlExpirySeconds"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Download URL Expiry (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="300"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="maxFileSizeInMb"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum File Size (MB)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="5"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                name="uploadCompletionRequiredFor"
                control={form.control}
                render={({ field }) => {
                  const selected: ("Public" | "Private")[] = field.value ?? [];
                  const toggle = (option: "Public" | "Private", checked: boolean) => {
                    field.onChange(
                      checked
                        ? [...selected, option]
                        : selected.filter((value) => value !== option),
                    );
                  };
                  return (
                    <FormItem className="mt-4">
                      <FormLabel>Require upload verification for</FormLabel>
                      <FormControl>
                        <div className="rounded-md border">
                          {(
                            [
                              {
                                option: "Public" as const,
                                description:
                                  "Files served on a link anyone can open.",
                              },
                              {
                                option: "Private" as const,
                                description:
                                  "Files restricted to authorized users.",
                              },
                            ]
                          ).map(({ option, description }, index) => (
                            <div
                              key={option}
                              className={cn(
                                "flex items-center justify-between gap-4 px-4 py-3",
                                index > 0 && "border-t",
                              )}
                            >
                              <div>
                                <div className="text-sm font-medium">{option}</div>
                                <div className="text-xs text-muted-foreground">
                                  {description}
                                </div>
                              </div>
                              <Switch
                                aria-label={option}
                                checked={selected.includes(option)}
                                onCheckedChange={(checked) => toggle(option, checked)}
                              />
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
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
