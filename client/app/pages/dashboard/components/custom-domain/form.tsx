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

const formSchema = z.object({
  domain: z.string().min(1, "Please select a domain"),
});

type FormValues = z.infer<typeof formSchema>;

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
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
                          ? "No verified domains available"
                          : "Select a domain"
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
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            Set
          </Button>
        </div>
      </form>
    </Form>
  );
};
