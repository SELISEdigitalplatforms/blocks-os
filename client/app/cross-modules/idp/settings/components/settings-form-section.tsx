import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { cn } from "@/lib/utils";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import type { ReactNode } from "react";

type SettingsFormSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
};

export const SettingsFormSection = ({
  title,
  children,
  className,
  headerClassName,
  titleClassName,
}: SettingsFormSectionProps) => (
  <Card className={cn(className)}>
    <CardHeader className={cn(SETTINGS_FORM_LAYOUT.sectionHeader, headerClassName)}>
      <CardTitle className={cn(SETTINGS_FORM_LAYOUT.sectionTitle, titleClassName)}>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
