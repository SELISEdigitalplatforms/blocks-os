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
  AUDIENCE_MAX_FILTERS,
  AUDIENCE_MAX_OTHER,
  AUDIENCE_MAX_TEXT,
  AUDIENCE_MAX_USERS,
  AUDIENCE_MODE_RULES,
  notificationImportances,
  notificationKinds,
  notificationScopes,
  notificationTypes,
} from "../constants/notification.constant";
import { NotificationAudienceField } from "../components/notification-audience-field";
import {
  audienceToFormValues,
  buildAudiencePayload,
  emptyAudienceForm,
  type IAudienceFormValues,
} from "../utils/notification-audience";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui-kits/collapsible/collapsible";
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
type NotificationConfigFormValues = IAudienceFormValues & {
  scope: number;
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
  scope: 0,
  ...emptyAudienceForm,
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
  scope: data?.scope ?? 0,
  ...audienceToFormValues(data?.audience),
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
  // The server refuses a scope change from any tenant but the root; it is sent only when changed.
  if (data.scope !== before.scope) out.scope = data.scope;
  const audience = buildAudiencePayload(data, before);
  if (audience) out.audience = audience;
  return out;
};

const schema = z
  .object({
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
    sourceService: z
      .string()
      .max(100, { message: "Source service must be at most 100 characters" }),
    consumerAppRecommendation: z
      .string()
      .max(1000, { message: "Recommendation must be at most 1000 characters" }),
    consumerAppNote: z.string().max(1000, { message: "Note must be at most 1000 characters" }),
    isBuiltIn: z.boolean(),
    isEnabled: z.boolean(),
    scope: z.number(),
    audienceMode: z.enum(["sender", "everyone", "rules"]),
    audienceMatch: z.number(),
    audienceUserIds: z.array(z.string()).max(AUDIENCE_MAX_USERS),
    audienceOrganizationIds: z.array(z.string()).max(AUDIENCE_MAX_OTHER),
    audienceRoles: z.array(z.string()).max(AUDIENCE_MAX_OTHER),
    audiencePermissions: z.array(z.string()).max(AUDIENCE_MAX_OTHER),
    audienceFilters: z
      .array(
        z.object({
          context: z.string().trim().min(1).max(AUDIENCE_MAX_TEXT),
          actionName: z.string().max(AUDIENCE_MAX_TEXT),
          value: z.string().max(AUDIENCE_MAX_TEXT),
        }),
      )
      .max(AUDIENCE_MAX_FILTERS),
  })
  .refine(
    (data) =>
      data.audienceMode !== AUDIENCE_MODE_RULES ||
      data.audienceUserIds.length +
        data.audienceOrganizationIds.length +
        data.audienceRoles.length +
        data.audiencePermissions.length +
        data.audienceFilters.length >
        0,
    { message: "Add at least one rule, or pick another option.", path: ["audienceMode"] },
  );
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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [moreOpen, setMoreOpen] = useState(false);
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
          errors: error.errors,
          customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES,
        });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  };
  const idleLabel = isEdit ? "Save changes" : "Save";
  const pendingLabel = "Saving...";
  const submitLabel = isPending ? pendingLabel : idleLabel;

  return (
    <DialogContent className="flex max-h-[90vh] flex-col gap-0 rounded-md p-0 sm:max-w-[560px]">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(formSubmitHandler)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-left">
              {dialogTitle}
              {isBuiltInConfig && (
                <Badge variant="info" className="w-fit">
                  Built-in
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Name, receiver and importance of the notification.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isEdit}
                      id="configName"
                      placeholder="Enter name"
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
            <NotificationAudienceField projectKey={tenantId} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                name="notificationType"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Receiver <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select receiver" />
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
              <FormField
                name="notifyMethod"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Notify method <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="notifyMethod"
                        placeholder="Enter notify method"
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
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="What this notification is for" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="importance"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Importance</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                    <FormLabel>Kind</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <FormField
                name="enablePersistence"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="m-0 font-normal">Save to inbox</FormLabel>
                  </FormItem>
                )}
              />
              {!isEdit && (
                <FormField
                  name="isBuiltIn"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="m-0 font-normal">Built-in (all tenants)</FormLabel>
                    </FormItem>
                  )}
                />
              )}
              {isEdit && (
                <FormField
                  name="isEnabled"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          aria-label="Notification on or off"
                          checked={field.value}
                          disabled={!canBeDisabled}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="m-0 font-normal">
                        {field.value ? "On" : "Off"}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}
            </div>
            {effectiveBuiltIn && (
              <FormField
                name="scope"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="sm:max-w-72">
                    <FormLabel>Scope</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {notificationScopes.map((item) => (
                          <SelectItem key={item.value} value={String(item.value)}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}
            {isEdit && !canBeDisabled && (
              <p className="-mt-2 text-xs text-medium-emphasis">{ALWAYS_ON_MESSAGE}</p>
            )}
            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1 px-2 text-medium-emphasis"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                  />
                  More options
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 flex flex-col gap-4">
                <FormField
                  name="sourceService"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source service</FormLabel>
                      <FormControl>
                        <Input placeholder="Service that sends it" {...field} />
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
                      <FormLabel>Recommendation for apps</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
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
                      <FormLabel>Note for apps without the portal</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <DialogTrigger asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogTrigger>
            <Button type="submit" disabled={isPending || !form.formState.isValid}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
};
export default NewNotificationConfiguration;
