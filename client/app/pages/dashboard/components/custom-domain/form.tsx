import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Button } from "@/components/ui-kits/button/button";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const createFormSchema = () => z.object({
  domain: z.string().min(1, tStatic("os.dashboard", "FORM.PLEASE_SELECT_A_DOMAIN")),
});

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

interface SetCustomDomainFormProps {
  defaultDomain: string;
  verifiedDomains: string[];
  isPending: boolean;
  onSubmit: (domain: string) => Promise<void>;
  onCancel: () => void;
}

export const SetCustomDomainForm = ({
  defaultDomain,
  verifiedDomains,
  isPending,
  onSubmit,
  onCancel,
}: SetCustomDomainFormProps) => {
  const { t } = useT("os.dashboard");
  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema()),
    defaultValues: { domain: defaultDomain },
  });

  const handleSubmit = async (values: FormValues) => {
    await onSubmit(values.domain);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={verifiedDomains.length === 0}
              >
                <FormControl>
                  <SelectTrigger className="[&>span]:truncate [&>span]:text-left">
                    <SelectValue
                      placeholder={
                        verifiedDomains.length === 0
                          ? t("FORM.NO_VERIFIED_DOMAINS_AVAILABLE")
                          : t("FORM.SELECT_A_DOMAIN")
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                {/* Cap the popover to the viewport and wrap long domains so
                    the dropdown stays usable on small screens */}
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {verifiedDomains.map((domain) => (
                    <SelectItem key={domain} value={domain} className="break-all">
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common:CANCEL")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t("FORM.SET")}
          </Button>
        </div>
      </form>
    </Form>
  );
};
