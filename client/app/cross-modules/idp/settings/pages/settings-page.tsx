import { PageHeader } from "@/components/page-header/page-header";
import { useQueryState } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { cn } from "@/lib/utils";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import { SETTINGS_TAB_META } from "@blocks-idp/settings/constants/settings-tab-meta";
import type { SettingsTabValue } from "@blocks-idp/settings/models/settings.model";
import {
  SettingsTabActionsProvider,
  SettingsTabActionsSlot,
} from "@blocks-idp/settings/components/settings-tab-actions";
import { AuthConfigTab } from "@blocks-idp/settings/pages/tabs/auth-config-tab";
import { IamConfigTab } from "@blocks-idp/settings/pages/tabs/iam-config-tab";
import { OrganizationConfigTab } from "@blocks-idp/settings/pages/tabs/organization-config-tab";
import { SignupSettingsTab } from "@blocks-idp/settings/pages/tabs/signup-settings-tab";

const SETTINGS_TABS: { value: SettingsTabValue; label: string }[] = [
  { value: "auth-config", label: "Auth" },
  { value: "iam-config", label: "IAM" },
  { value: "signup-settings", label: "Signup" },
  { value: "organization-config", label: "Organization" },
];

const DEFAULT_SETTINGS_TAB: SettingsTabValue = "auth-config";

const isSettingsTabValue = (value: string | null): value is SettingsTabValue =>
  SETTINGS_TABS.some((tab) => tab.value === value);

export const IdpSettingsPage = () => {
  const [settingsTab, setSettingsTab] = useQueryState("settingsTab", {
    defaultValue: DEFAULT_SETTINGS_TAB,
  });

  const activeTab: SettingsTabValue = isSettingsTabValue(settingsTab)
    ? settingsTab
    : DEFAULT_SETTINGS_TAB;

  const handleTabChange = (value: string) => {
    void setSettingsTab(value);
  };

  const activeTabMeta = SETTINGS_TAB_META[activeTab];

  return (
    <SettingsTabActionsProvider>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex w-full flex-col">
        <PageHeader title={activeTabMeta.title} description={activeTabMeta.description} />

        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="md:hidden">
              <Select value={activeTab} onValueChange={handleTabChange}>
                <SelectTrigger className="w-56" aria-label="Settings section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTINGS_TABS.map((tab) => (
                    <SelectItem key={tab.value} value={tab.value}>
                      {tab.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden items-center md:flex">
              <TabsList className="h-[42px] bg-blocks-primary-shades-300">
                {SETTINGS_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn("h-8 px-4", SETTINGS_FORM_LAYOUT.tabLabel)}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
          <SettingsTabActionsSlot activeTab={activeTab} />
        </div>

        <TabsContent value="auth-config">
          <AuthConfigTab />
        </TabsContent>
        <TabsContent value="iam-config">
          <IamConfigTab />
        </TabsContent>
        <TabsContent value="signup-settings">
          <SignupSettingsTab />
        </TabsContent>
        <TabsContent value="organization-config">
          <OrganizationConfigTab />
        </TabsContent>
      </Tabs>
    </SettingsTabActionsProvider>
  );
};
