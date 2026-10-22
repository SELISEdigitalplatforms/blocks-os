import { z } from "zod";
import type {
  INotificationConfigBuiltInFields,
  INotificationConfigRow,
} from "../models/notification-config.model";
import { useSaveNotificationConfig } from "../hooks/use-notification-config";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ALWAYS_ON_MESSAGE,
  NOTIFICATION_CONFIG_ERROR_MESSAGES,
  NOTIFICATION_PROPAGATION_NOT_QUEUED,
  PROPAGATION_WARNING_MESSAGE,
  canNotificationConfigBeDisabled,
  channelsToNotify,
  notificationImportances,
  notificationKinds,
  notificationTypes,
} from "../constants/notification.constant";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { useEffect } from "react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Button } from "@/components/ui-kits/button/button";
interface NewNotificationConfigurationProps {
  dialogTitle: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  onClose: Function;
  previousData?: INotificationConfigRow;
  isEdit: boolean;
}
type NotificationConfigFormValues = {
  name: string;
  channelToNotify: number;
  notificationType: number;
  enablePersistence: boolean;
  notifyMethod: string;
  description: string;
  importance: number;
  kind: number;
  sourceService: string;
  consumerAppRecommendation: string;
  consumerAppNote: string;
  isBuiltIn: boolean;
  isEnabled: boolean;
};

const emptyFormValues: NotificationConfigFormValues = {
  name: "",
  channelToNotify: 0,
  notificationType: 0,
  enablePersistence: false,
  notifyMethod: "",
  description: "",
  importance: 0,
  kind: 0,
  sourceService: "",
  consumerAppRecommendation: "",
  consumerAppNote: "",
  isBuiltIn: false,
  isEnabled: true,
};

// Rows from older servers lack the built-in fields: they read as custom and enabled.
const toFormValues = (data?: INotificationConfigRow): NotificationConfigFormValues => ({
  name: data?.name || "",
  channelToNotify: data?.channelToNotify || 0,
  notificationType: data?.notificationType || 0,
  enablePersistence: data?.enablePersistence || false,
  notifyMethod: data?.notifyMethod || "",
  description: data?.description ?? "",
  importance: data?.importance ?? 0,
  kind: data?.kind ?? 0,
  sourceService: data?.sourceService ?? "",
  consumerAppRecommendation: data?.consumerAppRecommendation ?? "",
  consumerAppNote: data?.consumerAppNote ?? "",
  isBuiltIn: data?.isBuiltIn ?? false,
  isEnabled: !(data?.isDisabled ?? false),
});

const TEXT_FIELDS = [
  "description",
  "sourceService",
  "consumerAppRecommendation",
  "consumerAppNote",
] as const;
const NUMBER_FIELDS = ["importance", "kind"] as const;

/**
 * Builds only the new fields the request needs: on update those that changed, on create those the
 * user filled. When nothing applies the payload keeps its old shape.
 */
export const buildBuiltInPayload = (
  data: NotificationConfigFormValues,
  previous: INotificationConfigRow | undefined,
  isEdit: boolean,
) => {
  const before = toFormValues(isEdit ? previous : undefined);
  const out: Partial<INotificationConfigBuiltInFields> = {};
  for (const key of TEXT_FIELDS) {
    const value = data[key].trim();
    if (value !== before[key].trim()) out[key] = value || null;
  }
  for (const key of NUMBER_FIELDS) {
    if (data[key] !== before[key]) out[key] = data[key];
  }
  if (data.isBuiltIn !== before.isBuiltIn) out.isBuiltIn = data.isBuiltIn;
  if (data.isEnabled !== before.isEnabled) out.isDisabled = !data.isEnabled;
  return out;
};

const schema = z.object({
  name: z
    .string()
    .min(3, { message: "Configuration name must be at least 3 characters" })
    .max(100, { message: "Configuration name must be at most 100 characters" })
    .refine((val) => val.trim().length > 0, {
      message: "Name cannot contain only whitespace",
    }),
  channelToNotify: z.number().min(0, { message: "Channel to notify is required" }),
  notificationType: z.number().min(0, { message: "Notification type is required" }),
  enablePersistence: z.boolean(),
  notifyMethod: z
    .string()
    .min(3, { message: "Notify method must be at least 3 characters" })
    .max(100, { message: "Notify method must be at most 100 characters" })
    .refine((val) => val.trim().length > 0, {
      message: "Notify method cannot contain only whitespace",
    }),
  description: z.string().max(1000, { message: "Description must be at most 1000 characters" }),
  importance: z.number(),
  kind: z.number(),
  sourceService: z.string().max(100, { message: "Source service must be at most 100 characters" }),
  consumerAppRecommendation: z
    .string()
    .max(1000, { message: "Recommendation must be at most 1000 characters" }),
  consumerAppNote: z.string().max(1000, { message: "Note must be at most 1000 characters" }),
  isBuiltIn: z.boolean(),
  isEnabled: z.boolean(),
});
const NewNotificationConfiguration: React.FC<NewNotificationConfigurationProps> = ({
  dialogTitle,
  onClose,
  previousData,
  isEdit,
}) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { isPending, mutateAsync } = useSaveNotificationConfig();
  if (isEdit && previousData?.itemId == "") {
    return <div>loading</div>;
  }
  const isBuiltInConfig = isEdit && !!previousData?.isBuiltIn;
  // Who may change a built-in config is decided by the server; its refusal is shown as an error.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const form = useForm<NotificationConfigFormValues>({
    defaultValues: isEdit ? toFormValues(previousData) : emptyFormValues,
    resolver: zodResolver(schema),
    mode: "onChange",
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isEdit && previousData) {
      form.reset(toFormValues(previousData));
    } else if (!isEdit) {
      form.reset(emptyFormValues);
    }
  }, [previousData, isEdit, form]);
  const watchedKind = form.watch("kind");
  const watchedBuiltIn = form.watch("isBuiltIn");
  const effectiveBuiltIn = isBuiltInConfig || watchedBuiltIn;
  const canBeDisabled = canNotificationConfigBeDisabled({
    isBuiltIn: effectiveBuiltIn,
    kind: watchedKind,
  });
  const formSubmitHandler = async (data: NotificationConfigFormValues) => {
    try {
      const res = await mutateAsync({
        name: data.name,
        channelToNotify: data.channelToNotify,
        notificationType: data.notificationType,
        enablePersistence: data.enablePersistence,
        notifyMethod: data.notifyMethod,
        projectKey: tenantId,
        itemId: isEdit ? previousData?.itemId : undefined,
        ...buildBuiltInPayload(data, previousData, isEdit),
      });
      const propagationPending =
        !!res?.isSuccess &&
        (res?.errors as Record<string, unknown> | null | undefined)?.Propagation ===
          NOTIFICATION_PROPAGATION_NOT_QUEUED;
      if (res?.isSuccess && propagationPending) {
        toast({ variant: "warning", title: "Warning", description: PROPAGATION_WARNING_MESSAGE });
        form.reset();
        onClose(false);
      } else if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: isEdit
            ? "Configuration updated successfully."
            : "New configuration added successfully.",
        });
        form.reset();
        onClose(false);
      } else {
        showErrorToast({
          errors: res?.errors,
          customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES,
        });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({
          errors: error.errors as Record<string, string | string[]>,
          customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES,
        });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  };
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md sm:max-w-[700px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader>
            <DialogTitle className="mb-2 flex items-center gap-2 text-left">
              {dialogTitle}
              {isBuiltInConfig && <Badge variant="info">Built-in</Badge>}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="pb-4 pt-4 text-left">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            disabled={isEdit}
                            id="configName"
                            placeholder="Enter name"
                            className="border-default col-span-3 mt-1 border shadow-none"
                            {...field}
                            onBlur={(e) => {
                              field.onChange(e.target.value.trim());
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <FormField
                    name="channelToNotify"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Channel to Notify <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          disabled={true}
                          onValueChange={(val) => field.onChange(Number(val))}
                          defaultValue={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none">
                              <SelectValue placeholder="Select Configuration" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {channelsToNotify.map((channel) => (
                              <SelectItem key={channel.value} value={String(channel.value)}>
                                {channel.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="notificationType"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Notification Type <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(Number(val))}
                          defaultValue={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none">
                              <SelectValue placeholder="Select Notification Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {notificationTypes.map((type) => (
                              <SelectItem key={type.value} value={String(type.value)}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <FormField
                    name="notifyMethod"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Notify Method <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="notifyMethod"
                            placeholder="Enter notify method"
                            className="border-default col-span-3 mt-1 border shadow-none"
                            {...field}
                            onBlur={(e) => {
                              field.onChange(e.target.value.trim());
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="mt-4">
                  <FormField
                    name="enablePersistence"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Checkbox
                            className="mr-2"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                        <FormLabel className="flex-start inline-flex">Enable Persistence</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <FormField
                    name="description"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Description
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What this notification is for"
                            className="border-default mt-1 border shadow-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <FormField
                      name="importance"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-left font-medium text-high-emphasis">
                            Importance
                          </FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(Number(val))}
                            defaultValue={String(field.value)}
                          >
                            <FormControl>
                              <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none">
                                <SelectValue placeholder="Select importance" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {notificationImportances.map((item) => (
                                <SelectItem key={item.value} value={String(item.value)}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="kind"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-left font-medium text-high-emphasis">
                            Kind
                          </FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(Number(val))}
                            defaultValue={String(field.value)}
                          >
                            <FormControl>
                              <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none">
                                <SelectValue placeholder="Select kind" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {notificationKinds.map((item) => (
                                <SelectItem key={item.value} value={String(item.value)}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <FormField
                      name="sourceService"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-left font-medium text-high-emphasis">
                            Source service
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Service that sends it"
                              className="border-default col-span-3 mt-1 border shadow-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="consumerAppRecommendation"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-left font-medium text-high-emphasis">
                            Recommendation for apps
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="border-default mt-1 border shadow-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="consumerAppNote"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-left font-medium text-high-emphasis">
                            Note for apps that use Blocks without the portal
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="border-default mt-1 border shadow-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
                {!isEdit && (
                  <div className="mt-4">
                    <FormField
                      name="isBuiltIn"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Checkbox
                              className="mr-2"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="flex-start inline-flex">
                            Built-in (added to all tenants)
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                {isEdit && (
                  <div className="mt-4">
                    <FormField
                      name="isEnabled"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-3">
                            <FormControl>
                              <Switch
                                aria-label="Notification on or off"
                                checked={field.value}
                                disabled={!canBeDisabled}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="m-0">{field.value ? "On" : "Off"}</FormLabel>
                          </div>
                          {!canBeDisabled && (
                            <p className="text-sm text-medium-emphasis">{ALWAYS_ON_MESSAGE}</p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <div className="flex flex-row justify-end gap-2">
              <DialogTrigger asChild>
                <Button variant="outline" size="default" disabled={isPending}>
                  Cancel
                </Button>
              </DialogTrigger>
              <Button disabled={isPending || !form.formState.isValid} size="default">
                {isPending
                  ? isEdit
                    ? "Updating..."
                    : "Saving..."
                  : isEdit
                    ? "Update Changes"
                    : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
};
export default NewNotificationConfiguration;
