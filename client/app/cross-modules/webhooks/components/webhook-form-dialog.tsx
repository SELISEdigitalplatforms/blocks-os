import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Switch } from "@/components/ui-kits/switch/switch";
import { useGetActions } from "@/cross-modules/actions/hooks/use-actions";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { WEBHOOK_ERROR_CODES, WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import { useSaveWebhook } from "../hooks/use-webhooks";
import type { IWebhook } from "../models/webhook.model";
import { getErrorCode, webhookErrorMessages } from "../utils/webhook-errors";
import {
  createWebhookFormSchema,
  emptyWebhookForm,
  fieldErrorForCode,
  toSavePayload,
  toWebhookFormValues,
  type WebhookFormValues,
} from "../utils/webhook-form";

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set to edit this webhook; leave out to add a new one. */
  webhook?: IWebhook | null;
  onSaved?: (webhook: IWebhook) => void;
}

export function WebhookFormDialog({
  open,
  onOpenChange,
  webhook = null,
  onSaved,
}: Readonly<WebhookFormDialogProps>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const isEdit = webhook !== null;
  const { data: allActions, isLoading: isLoadingActions } = useGetActions();
  const { mutateAsync: saveWebhook, isPending } = useSaveWebhook();

  // Only actions that send to webhooks can be picked.
  const choices = useMemo(
    () => (allActions ?? []).filter((action) => action.webhook),
    [allActions],
  );
  const choiceNames = useMemo(() => choices.map((action) => action.name), [choices]);

  const schema = useMemo(() => createWebhookFormSchema(isEdit), [isEdit]);
  const form = useForm<WebhookFormValues>({
    defaultValues: emptyWebhookForm,
    resolver: zodResolver(schema),
  });

  // Start clean every time the dialog opens: the secret field must never keep an old value.
  useEffect(() => {
    if (open) form.reset(toWebhookFormValues(webhook, choiceNames));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, webhook, choiceNames]);

  const handleSubmit = async (values: WebhookFormValues) => {
    try {
      const saved = await saveWebhook(toSavePayload(values, webhook, choiceNames));
      showSuccessToast({
        description: t(isEdit ? "FORM.UPDATED" : "FORM.CREATED", { name: saved.name }),
      });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      handleSaveError(getErrorCode(error));
    }
  };

  const handleSaveError = (code: string | null) => {
    const fieldError = code ? fieldErrorForCode(code) : null;
    if (fieldError) {
      form.setError(fieldError.field, { type: "server", message: fieldError.message });
      return;
    }
    showErrorToast({
      title: t("FORM.COULD_NOT_SAVE"),
      errors: code ? { code } : t("ERRORS.UNEXPECTED"),
      customMessages: webhookErrorMessages(),
    });
    if (code === WEBHOOK_ERROR_CODES.WebhookNotFound) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(isEdit ? "FORM.EDIT_TITLE" : "FORM.ADD_TITLE")}</DialogTitle>
          <DialogDescription>{t("FORM.POST_ONLY")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(handleSubmit)}
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("FORM.NAME")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} disabled={isPending} />
                  </FormControl>
                  <FormDescription>{t("FORM.NAME_HINT")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("FORM.URL")}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      autoComplete="off"
                      placeholder={t("FORM.URL_PLACEHOLDER")}
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>{t("FORM.URL_HINT")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(isEdit ? "FORM.NEW_SECRET" : "FORM.SECRET")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    {isEdit ? t("FORM.NEW_SECRET_HINT") : t("FORM.SECRET_HINT")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="actions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("FORM.ACTIONS")}</FormLabel>
                  <FormDescription>{t("FORM.ACTIONS_HINT")}</FormDescription>
                  <ActionChoices
                    choices={choices}
                    selected={field.value}
                    isLoading={isLoadingActions}
                    disabled={isPending}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-sm border border-border p-3">
                  <FormLabel className="mt-0">{t("FORM.ACTIVE")}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                {t("common:CANCEL")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>{t("FORM.SAVE")}</span>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface ActionChoicesProps {
  choices: { name: string; label: string }[];
  selected: string[];
  isLoading: boolean;
  disabled: boolean;
  onChange: (names: string[]) => void;
}

function ActionChoices({
  choices,
  selected,
  isLoading,
  disabled,
  onChange,
}: Readonly<ActionChoicesProps>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (choices.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("FORM.NO_ACTIONS_AVAILABLE")}</p>;
  }

  const toggle = (name: string, checked: boolean) =>
    onChange(checked ? [...selected, name] : selected.filter((item) => item !== name));

  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-sm border border-border p-2">
      {choices.map((choice) => {
        const id = `webhook-action-${choice.name}`;
        return (
          <li key={choice.name} className="flex items-center gap-3 rounded-sm px-2 py-1.5">
            <Checkbox
              id={id}
              checked={selected.includes(choice.name)}
              disabled={disabled}
              onCheckedChange={(checked) => toggle(choice.name, checked === true)}
            />
            <label htmlFor={id} className="flex min-w-0 flex-col text-sm">
              <span className="font-medium text-high-emphasis">{choice.label}</span>
              <code className="truncate text-xs text-muted-foreground">{choice.name}</code>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
