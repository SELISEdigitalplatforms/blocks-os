import { SignupForm } from "./signup-form";
import { useGetSignUpSetting } from "@blocks-idp/iam/hooks/use-user";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { Loader } from "lucide-react";

export const Signup = () => {
  const projectKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "";
  const { data: signUpSetting, isLoading: isSignUpSettingLoading } = useGetSignUpSetting({ projectKey });
  if (isSignUpSettingLoading) {
    return (
      <Card className="flex h-full flex-col rounded border-solid border-background shadow-none md:min-w-[448px] md:border-[#95ADC4] lg:max-w-md">
        <CardContent className="flex flex-1 items-center justify-center">
          <Loader className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  return (
    <SignupForm
      emailSignUpEnabled={signUpSetting?.isEmailPasswordSignUpEnabled || false}
    />
  );
};
