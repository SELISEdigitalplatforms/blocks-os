import { Loader } from "lucide-react";
import { AuthPageShell } from "@/components/auth-page-shell/auth-page-shell";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { useGetSignUpSetting } from "@blocks-idp/iam/hooks/use-user";
import { SignupForm } from "./signup-form";

export const Signup = () => {
  const projectKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "";
  const { data: signUpSetting, isLoading: isSignUpSettingLoading } = useGetSignUpSetting({
    projectKey,
  });

  return (
    <AuthPageShell badge="Sign Up" title="Blocks Cloud">
      {isSignUpSettingLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <SignupForm emailSignUpEnabled={signUpSetting?.isEmailPasswordSignUpEnabled || false} />
      )}
    </AuthPageShell>
  );
};
