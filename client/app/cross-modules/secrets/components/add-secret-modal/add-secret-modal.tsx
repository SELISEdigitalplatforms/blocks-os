import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { type SecretItem } from "../../constants/secret-key.enum";
import { useSaveSecret } from "../../hooks/use-secrets";

const MY_SECRET_KEY = "my-secret";

const schema = z.object({
  secretName: z.string().min(1, "Secret name is required"),
  pairs: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      value: z.string(),
    }),
  ),
});

type FormValues = z.infer<typeof schema>;

function getSecretName(kv: Record<string, string> | undefined): string {
  if (!kv) return "";
  return kv["secretName"] ?? kv["SecretName"] ?? "";
}

function buildInitialPairs(kv: Record<string, string> | undefined): { key: string; value: string }[] {
  if (!kv) return [];
  return Object.entries(kv)
    .filter(([k]) => k.toLowerCase() !== "secretname")
    .map(([key, value]) => ({ key, value }));
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function AddSecretModal({
  mode = "create",
  editItem,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  mode?: "create" | "edit";
  editItem?: SecretItem;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const isEditMode = mode === "edit";
  const { mutate: saveSecret, isPending } = useSaveSecret();

  const getDefaultValues = (): FormValues => ({
    secretName: getSecretName(editItem?.keyValuePairs),
    pairs: buildInitialPairs(editItem?.keyValuePairs),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "pairs",
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(getDefaultValues());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editItem]);

  const setModalOpen = (value: boolean) => {
    if (open === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      form.reset(getDefaultValues());
    }
    setModalOpen(val);
  };

  const onSubmit = (data: FormValues) => {
    const keyValuePairs: Record<string, string> = { secretName: data.secretName };
    data.pairs.forEach(({ key, value }) => {
      keyValuePairs[key] = value;
    });

    saveSecret(
      {
        secretKey: MY_SECRET_KEY,
        keyValuePairs,
        ...(isEditMode && editItem?.itemId ? { itemId: editItem.itemId } : {}),
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          if (!isEditMode) form.reset({ secretName: "", pairs: [] });
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="aspect-square w-4" />
          <span className="ml-2">Add Secret</span>
        </Button>
      )}
      <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-lg flex-col sm:w-full">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Secret" : "Add Secret"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-1">
              {/* Secret Name */}
              <FormField
                control={form.control}
                name="secretName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Secret Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter secret name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dynamic KVP Properties */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Properties</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ key: "", value: "" })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="ml-1.5">Add Property</span>
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No properties yet. Click "Add Property" to add key-value pairs.
                  </p>
                )}

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2">
                      <FormField
                        control={form.control}
                        name={`pairs.${index}.key`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Key" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`pairs.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Value" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
