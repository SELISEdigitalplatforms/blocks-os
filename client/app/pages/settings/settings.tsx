import { ReactNode, useEffect, useState } from "react";
import { Pencil, Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { useGetProjects, useUpdateTenantGroup } from "@/hooks/use-project";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { formatDate } from "@/lib/utils";
import { EnvironmentsCard, getEnvironmentOrder } from "./environments-card";
const SettingsLoading = () => (
  <main className="flex flex-col gap-6 p-6">
    <Skeleton className="h-8 w-40" />
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-20" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
    <EnvironmentsCard environments={[]} isLoading />
  </main>
);
const InfoField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="font-medium">{children}</div>
  </div>
);
const projectNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(3, "Project name must be at least 3 characters")
    .max(100, "Project name should be a maximum of 100 characters"),
});
type ProjectNameForm = z.infer<typeof projectNameSchema>;
export const SettingsPage = () => {
  const { selectedProject, selectedTenantGroup, setSelectedProject } = useProjectStore();
  const { data: projectsData, isLoading } = useGetProjects({
    tenantGroupId: selectedTenantGroup ?? "",
    enabled: !!selectedTenantGroup,
  });
  // Ordered like the "Select environments" step: dev → test → stg → … → prod
  const environments = (projectsData?.[0]?.projects ?? [])
    .filter((environment) => !environment.isDisabled)
    .sort((a, b) => getEnvironmentOrder(a.environment) - getEnvironmentOrder(b.environment));
  const project = projectsData?.[0]?.projects?.[0];
  const { mutateAsync: updateTenantGroup, isPending: isUpdating } = useUpdateTenantGroup();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const form = useForm<ProjectNameForm>({
    resolver: zodResolver(projectNameSchema),
    defaultValues: {
      name: "",
    },
  });
  useEffect(() => {
    if (project?.name && isEditOpen) {
      form.reset({ name: project.name });
    }
  }, [project?.name, isEditOpen, form]);
  useEffect(() => {
    if (project && selectedProject?.itemId === project.itemId) {
      if (selectedProject.name !== project.name) {
        setSelectedProject(project);
      }
    }
  }, [project, selectedProject, setSelectedProject]);
  if (isLoading) return <SettingsLoading />;
  const handleSave = async (values: ProjectNameForm) => {
    if (!project) return;
    try {
      const payload = {
        name: values.name.trim(),
        tenantGroupId: selectedTenantGroup || "",
      };
      const res = await updateTenantGroup(payload);
      if (res.errors) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update project name",
        });
      } else {
        toast({
          variant: "success",
          title: "Success",
          description: "Project name updated successfully",
        });
        setIsEditOpen(false);
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };
  const formattedDate = formatDate(new Date(project?.createdDate || ""));
  return (
    <main className="flex flex-col gap-6 p-6">
      <h4 className="text-lg font-semibold md:text-xl">Project Settings</h4>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>General Information</CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-10"
            aria-label="Edit project name"
            onClick={() => setIsEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            <span>Edit</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <InfoField label="Name">{project?.name || "-"}</InfoField>
            <InfoField label="Created On">{formattedDate}</InfoField>
            <InfoField label="Environments">{environments.length || "-"}</InfoField>
            <InfoField label="Plan">Free</InfoField>
          </div>
        </CardContent>
      </Card>

      <EnvironmentsCard environments={environments} />
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Project name</Label>
                  <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            id="name"
                            onChange={(e) => {
                              field.onChange(e);
                              form.trigger("name");
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating || !form.formState.isValid}>
                  {isUpdating && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Update
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </main>
  );
};
