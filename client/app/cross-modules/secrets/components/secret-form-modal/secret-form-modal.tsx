import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
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
import { Label } from "@/components/ui-kits/label/label";
import { PasswordInput } from "@/components/password-input/password-input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { cn } from "@/lib/utils";
import {
  SECRET_DESCRIPTION_MAX_LENGTH,
  SECRET_NAME_MAX_LENGTH,
  SECRET_NAME_PATTERN,
  SECRET_TYPE,
  SECRET_TYPE_LABEL,
  SECRET_TYPE_DESCRIPTION,
  type SecretAccess,
  type SecretResult,
  type SecretType,
} from "@/cross-modules/secrets/models/secret.model";
import {
  useSetSecret,
  useUpdateSecret,
  useUpdateSecretAccess,
} from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import { UserRolePicker } from "../user-role-picker/user-role-picker";

// Mirrors SecretService.Helpers.cs so the user sees the problem before a round trip. The
// server re-validates regardless; this only saves a failed request.
const nameField = z
  .string()
  .trim()
  .min(1, "A name is required.")
  .max(SECRET_NAME_MAX_LENGTH, `A name may be at most ${SECRET_NAME_MAX_LENGTH} characters.`)
  .regex(
    SECRET_NAME_PATTERN,
    "Start with a letter or digit; letters, digits, dot, underscore and hyphen only.",
  );

const descriptionField = z
  .string()
  .max(
    SECRET_DESCRIPTION_MAX_LENGTH,
    `A description may be at most ${SECRET_DESCRIPTION_MAX_LENGTH} characters.`,
  )
  .optional();

// Length is deliberately not validated here. Key Vault's 25 KB cap is enforced server-side and
// comes back as a 400 with reason VALUE_TOO_LARGE, which `applyError` puts on this field — so an
// oversized value still fails clearly, without a byte counter distracting from a limit almost
// nobody reaches.
const valueField = z.string().min(1, "A value is required.");

const createSchema = z.object({
  name: nameField,
  description: descriptionField,
  value: valueField,
});

const editSchema = z.object({
  name: nameField,
  description: descriptionField,
  // Never edited here: changing a value is a rotation, which is audited separately.
  value: z.string().optional(),
});

type FormValues = { name: string; description?: string; value?: string };

const emptyAccess = (): SecretAccess => ({ userIds: [], roles: [] });

// Order is not significant in an access list, so compare as sets — elementwise rather than by
// joining, because user ids and role slugs are opaque and any delimiter could occur inside one.
const sameList = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
};

const sameAccess = (a: SecretAccess, b: SecretAccess): boolean =>
  sameList(a.userIds, b.userIds) && sameList(a.roles, b.roles);

interface SecretFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present switches the modal to edit mode. */
  secret?: SecretResult | null;
}

/**
 * Create and edit a secret.
 *
 * Create has no Status field — every secret is created `active` and lifecycle moves through
 * lock/unlock/delete/restore. Edit has no value field, and because the backend's
 * `UpdateSecretRequest` carries only name and description, an access change is a **second**
 * call to a separately-permissioned endpoint. The submit handler therefore has to cope with
 * the first call succeeding and the second failing.
 *
 * Mount this only while it is open; a fresh mount is what seeds the fields from `secret` and
 * discards a previous attempt.
 */
export function SecretFormModal({ open, onOpenChange, secret }: SecretFormModalProps) {
  const isEdit = !!secret;
  const [type, setType] = useState<SecretType>(secret?.type ?? SECRET_TYPE.Api);
  const [access, setAccess] = useState<SecretAccess>(() =>
    secret?.access
      ? { userIds: [...secret.access.userIds], roles: [...secret.access.roles] }
      : emptyAccess(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  /** Set when metadata saved but the access call did not — changes what a retry has to do. */
  const [metadataSaved, setMetadataSaved] = useState(false);

  const { mutateAsync: createSecret, isPending: isCreating } = useSetSecret();
  const { mutateAsync: updateSecret, isPending: isUpdating } = useUpdateSecret();
  const { mutateAsync: updateAccess, isPending: isUpdatingAccess } = useUpdateSecretAccess();
  const isPending = isCreating || isUpdating || isUpdatingAccess;

  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      name: secret?.name ?? "",
      description: secret?.description ?? "",
      // Never prefilled: on edit there is no value field at all, and on create the user supplies it.
      value: "",
    },
  });

  const isApi = type === SECRET_TYPE.Api;

  /** Routes a backend reason code onto the field it belongs to, e.g. NAME_TAKEN onto `name`. */
  const applyError = (error: unknown, fallback: string) => {
    const info = describeSecretError(error, fallback);
    if (info.field === "name" || info.field === "description") {
      form.setError(info.field, { type: "server", message: info.message });
      setFormError(null);
      return;
    }
    if (info.field === "value" && !isEdit) {
      form.setError("value", { type: "server", message: info.message });
      setFormError(null);
      return;
    }
    setFormError(info.message);
  };

  const submitCreate = async (values: FormValues) => {
    try {
      await createSecret({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        value: values.value ?? "",
        type,
        // Service secrets must not carry an access list — it would imply a check that is never
        // performed for them.
        access: isApi ? access : null,
      });
      onOpenChange(false);
    } catch (error) {
      applyError(error, "Could not create the secret.");
    }
  };

  const submitEdit = async (values: FormValues) => {
    if (!secret) return;

    // Skipped on a retry that only failed at the access step — the metadata is already committed.
    if (!metadataSaved) {
      try {
        await updateSecret({
          secretId: secret.secretId,
          name: values.name.trim(),
          description: values.description?.trim() ?? "",
        });
      } catch (error) {
        applyError(error, "Could not save the secret.");
        return;
      }
    }

    const original = secret.access ?? emptyAccess();
    // Only fire the access call when the chips actually changed: `::access` is separately
    // permissioned, so a user who may rename a secret can still be refused here.
    const accessChanged = isApi && !sameAccess(original, access);

    if (!accessChanged) {
      onOpenChange(false);
      return;
    }

    try {
      await updateAccess({ secretId: secret.secretId, access });
      onOpenChange(false);
    } catch (error) {
      // Name and description are already saved. Say so plainly rather than letting a generic
      // failure imply nothing landed, and keep the modal open so a retry redoes only the
      // access call.
      setMetadataSaved(true);
      const info = describeSecretError(error, "Could not update the access list.");
      setFormError(
        `The name and description were saved, but the access list was not: ${info.message}`,
      );
    }
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    if (isEdit) await submitEdit(values);
    else await submitCreate(values);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">{isEdit ? "Edit secret" : "Create secret"}</DialogTitle>
          <DialogDescription className="text-left">
            {isEdit
              ? "Update the name, description and access list. Use Rotate to change the value."
              : "Store a new secret. The value goes straight to the secret store and is never shown in a list."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-1">
              {formError && <Banner variant="destructive">{formError}</Banner>}

              <div className="space-y-2">
                <Label>
                  Category {!isEdit && <span className="text-destructive">*</span>}
                </Label>
                {isEdit ? (
                  // The backend has no category transition; changing it would mean a new secret.
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-sm font-medium">{SECRET_TYPE_LABEL[type]}</p>
                    <p className="text-xs text-muted-foreground">
                      {SECRET_TYPE_DESCRIPTION[type]}
                    </p>
                  </div>
                ) : (
                  // Cards rather than a segmented toggle: the choice is not obvious from a
                  // one-word label, so each option carries the sentence that explains it.
                  <div role="radiogroup" aria-label="Category" className="grid gap-2 sm:grid-cols-2">
                    {[SECRET_TYPE.Api, SECRET_TYPE.Service].map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={type === option}
                        onClick={() => setType(option)}
                        className={cn(
                          "rounded-md border p-3 text-left transition-colors",
                          type === option
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:border-muted-foreground/40 hover:bg-muted/40",
                        )}
                      >
                        <span className="block text-sm font-medium">
                          {SECRET_TYPE_LABEL[option]}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                          {SECRET_TYPE_DESCRIPTION[option]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="payment-gateway-key" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What this secret is for"
                        className="min-h-[70px]"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isEdit && (
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Secret value <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="Paste the secret value"
                          autoComplete="off"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Stored in the secret store. It is never shown in a list and can only be
                        read through an audited reveal.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {isApi && (
                <div className="space-y-2">
                  <Label>Access</Label>
                  <p className="text-xs text-muted-foreground">
                    Who may read this secret&apos;s value.
                  </p>
                  <UserRolePicker value={access} onChange={setAccess} disabled={isPending} />
                </div>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : metadataSaved ? "Retry access update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
