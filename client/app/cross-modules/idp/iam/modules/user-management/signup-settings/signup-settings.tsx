import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui-kits/dialog/dialog";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Wrench } from "lucide-react";
import { useGetSignUpSetting, useSaveSignUpSetting } from "@blocks-idp/iam/hooks/use-user";
import { useProjectStore } from "@seliseblocks/genesis-os";
export const SignupSettings = () => {
  const [open, setOpen] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);
  const [emailPassword, setEmailPassword] = useState(false);
  const [sso, setSso] = useState(false);
  const initializedRef = useRef(false);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: signUpSettingData } = useGetSignUpSetting(
    {
      projectKey: tenantId,
    },
    {
      enabled: !!tenantId,
    },
  );
  const { mutateAsync: saveSignUpSetting, isPending } = useSaveSignUpSetting();
  useEffect(() => {
    if (signUpSettingData && !initializedRef.current) {
      initializedRef.current = true;
      setAllowSignup(signUpSettingData.isSignUpEnable);
      setEmailPassword(signUpSettingData.isEmailPasswordSignUpEnabled);
      setSso(signUpSettingData.isSSoSignUpEnabled);
    }
  }, [signUpSettingData]);
  const isSaveDisabled = isPending;
  const submitHandler = async () => {
    await saveSignUpSetting({
      isSignUpEnable: allowSignup,
      isEmailPasswordSignUpEnabled: emailPassword,
      isSSoSignUpEnabled: sso,
      defaultRolesForNewUserOnSignUp: signUpSettingData?.defaultRolesForNewUser ?? [],
      defaultPermissionsForNewUserOnSignUp: signUpSettingData?.defaultPermissionsForNewUser ?? [],
      projectKey: tenantId,
      itemId: signUpSettingData?.itemId || "",
    });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Wrench className="mr-2 aspect-square w-4" />
          <span>Signup Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signup Settings</DialogTitle>
          <DialogDescription>Configure signup settings for users.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="allow-signup"
              checked={allowSignup}
              onCheckedChange={(checked) => setAllowSignup(!!checked)}
            />
            <label
              htmlFor="allow-signup"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Allow signup
            </label>
          </div>
          <div className="ml-6 flex flex-col gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email-password"
                checked={emailPassword}
                onCheckedChange={(checked) => setEmailPassword(!!checked)}
              />
              <label
                htmlFor="email-password"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Email and password
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="sso" checked={sso} onCheckedChange={(checked) => setSso(!!checked)} />
              <label htmlFor="sso" className="text-sm font-medium leading-none cursor-pointer">
                SSO
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submitHandler} disabled={isSaveDisabled}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
