import { useMemo, useState } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import type { INotificationConfigRow } from "../models/notification-config.model";
import { useSaveNotificationConfig } from "../hooks/use-notification-config";
import { isPushReady, usePushSettings } from "../hooks/use-push-settings";
import {
  ALWAYS_ON_MESSAGE,
  NOTIFICATION_CONFIG_ERROR_MESSAGES,
  NOTIFICATION_PROPAGATION_NOT_QUEUED,
  PROPAGATION_WARNING_MESSAGE,
  canNotificationConfigBeDisabled,
} from "../constants/notification.constant";
import {
  LIMITS,
  NOTIFICATION_TEXT,
  OWNER_ONLY_LABEL,
} from "../constants/notification-ui.constant";
import {
  buildSavePayload,
  toFormValues,
  validateNotificationForm,
  type NotificationFormValues,
} from "../utils/notification-form";
import { CheckRow, FormRow, HelpText } from "./notification-form/form-row";
import { ReceiversField } from "./notification-form/receivers-field";
import { ChannelsField } from "./notification-form/channels-field";
import { PushMessageField } from "./notification-form/push-message-field";
import { DeveloperNotes } from "./notification-form/developer-notes";

interface NotificationConfigFormProps {
  /** The row being edited; none for a new notification. */
  previous?: INotificationConfigRow;
  onClose: () => void;
  onSetUpPush: () => void;
}

const isPropagationPending = (res: { isSuccess?: boolean; errors?: unknown }) =>
  !!res.isSuccess &&
  (res.errors as Record<string, unknown> | null | undefined)?.Propagation ===
    NOTIFICATION_PROPAGATION_NOT_QUEUED;

function EventRow({
  values,
  isEdit,
  locked,
  canBeDisabled,
  onPatch,
}: Readonly<{
  values: NotificationFormValues;
  isEdit: boolean;
  locked: boolean;
  canBeDisabled: boolean;
  onPatch: (patch: Partial<NotificationFormValues>) => void;
}>) {
  const isCustom = !isEdit || !values.isBuiltIn;
  return (
    <FormRow label={NOTIFICATION_TEXT.eventLabel}>
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
        {isEdit ? (
          <span className="flex-1 font-mono text-sm">{values.name}</span>
        ) : (
          <Input
            aria-label={NOTIFICATION_TEXT.eventName}
            className="min-w-56 flex-1"
            maxLength={LIMITS.nameMax}
            value={values.name}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        )}
        <CheckRow
          id="event-enabled"
          label={NOTIFICATION_TEXT.enabled}
          checked={values.isEnabled}
          disabled={!canBeDisabled}
          onChange={(isEnabled) => onPatch({ isEnabled })}
        />
      </div>
      {!canBeDisabled && <HelpText>{ALWAYS_ON_MESSAGE}</HelpText>}
      {isCustom && !locked && (
        <Input
          aria-label={NOTIFICATION_TEXT.description}
          placeholder={NOTIFICATION_TEXT.description}
          maxLength={1000}
          value={values.description}
          onChange={(event) => onPatch({ description: event.target.value })}
        />
      )}
    </FormRow>
  );
}

function SendToRow({
  values,
  locked,
  onPatch,
}: Readonly<{
  values: NotificationFormValues;
  locked: boolean;
  onPatch: (patch: Partial<NotificationFormValues>) => void;
}>) {
  if (locked) {
    return (
      <FormRow label={NOTIFICATION_TEXT.sendToLabel}>
        <div className="rounded-sm border bg-muted/40 px-3 py-2 text-sm">{OWNER_ONLY_LABEL}</div>
        <HelpText>{NOTIFICATION_TEXT.personalHelp}</HelpText>
      </FormRow>
    );
  }
  return (
    <FormRow label={NOTIFICATION_TEXT.sendToLabel}>
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
        <CheckRow
          id="send-project"
          label={NOTIFICATION_TEXT.projectUsers}
          checked={values.sendProject}
          onChange={(sendProject) => onPatch({ sendProject })}
        />
        <CheckRow
          id="send-console"
          label={NOTIFICATION_TEXT.consoleUsers}
          checked={values.sendConsole}
          onChange={(sendConsole) => onPatch({ sendConsole })}
        />
      </div>
      <HelpText>{NOTIFICATION_TEXT.sendToHelp}</HelpText>
    </FormRow>
  );
}

/** The compact one-page form for a custom or built-in notification. */
export function NotificationConfigForm({
  previous,
  onClose,
  onSetUpPush,
}: Readonly<NotificationConfigFormProps>) {
  const isEdit = !!previous;
  const locked = isEdit && !!previous?.audienceLocked;
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { isPending, mutateAsync } = useSaveNotificationConfig();
  const push = usePushSettings();
  const [values, setValues] = useState<NotificationFormValues>(() => toFormValues(previous));
  const patch = (changes: Partial<NotificationFormValues>) =>
    setValues((current) => ({ ...current, ...changes }));

  const errors = useMemo(
    () => validateNotificationForm(values, { locked, isEdit }),
    [values, locked, isEdit],
  );
  const canBeDisabled = canNotificationConfigBeDisabled({
    isBuiltIn: isEdit && values.isBuiltIn,
    kind: values.kind,
  });
  const pushReady = push.isLoading || isPushReady(push.data);

  const handleResult = (res: { isSuccess?: boolean; errors?: unknown }) => {
    if (res.isSuccess && isPropagationPending(res)) {
      toast({ variant: "warning", title: "Warning", description: PROPAGATION_WARNING_MESSAGE });
      onClose();
    } else if (res.isSuccess) {
      toast({
        variant: "success",
        title: "Success",
        description: isEdit ? NOTIFICATION_TEXT.toastSaved : NOTIFICATION_TEXT.toastCreated,
      });
      onClose();
    } else {
      showErrorToast({ errors: res.errors, customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES });
    }
  };

  const save = async () => {
    if (errors.length > 0) return;
    try {
      handleResult(await mutateAsync(buildSavePayload(values, previous, isEdit, tenantId)));
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors, customMessages: NOTIFICATION_CONFIG_ERROR_MESSAGES });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  };

  const title = values.name || NOTIFICATION_TEXT.newBreadcrumb;
  const subtitle = isEdit && previous?.isBuiltIn
    ? (previous.description ?? NOTIFICATION_TEXT.noBuiltInSubtitle)
    : NOTIFICATION_TEXT.customSubtitle;

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-sm text-medium-emphasis">
        {NOTIFICATION_TEXT.breadcrumb} / {title}
      </nav>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span>{title}</span>
          {isEdit && previous?.isBuiltIn && <Badge variant="info">{NOTIFICATION_TEXT.builtIn}</Badge>}
        </h1>
        <p className="text-sm text-medium-emphasis">{subtitle}</p>
      </div>
      <form
        className="max-w-[880px] rounded-md border bg-card"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <EventRow
          values={values}
          isEdit={isEdit}
          locked={locked}
          canBeDisabled={canBeDisabled}
          onPatch={patch}
        />
        <SendToRow values={values} locked={locked} onPatch={patch} />
        {!locked && (
          <FormRow label={NOTIFICATION_TEXT.receiversLabel}>
            <ReceiversField values={values} onPatch={patch} />
          </FormRow>
        )}
        <FormRow label={NOTIFICATION_TEXT.channels}>
          <ChannelsField values={values} onPatch={patch} />
        </FormRow>
        {values.pushEnabled && (
          <FormRow label={NOTIFICATION_TEXT.pushMessage}>
            <PushMessageField
              values={values}
              onPatch={patch}
              locked={locked}
              pushReady={pushReady}
              onSetUpPush={onSetUpPush}
            />
          </FormRow>
        )}
        {!locked && (
          <FormRow label="">
            <DeveloperNotes values={values} onPatch={patch} canMarkBuiltIn={!isEdit} />
          </FormRow>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
          <div className="text-sm text-warning" role="alert">
            {errors.join(" ")}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              {NOTIFICATION_TEXT.cancel}
            </Button>
            <Button type="submit" disabled={isPending || errors.length > 0}>
              {isPending ? NOTIFICATION_TEXT.saving : NOTIFICATION_TEXT.save}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
