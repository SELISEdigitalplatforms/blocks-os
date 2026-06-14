import { useQueryState } from "nuqs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs"
import type { SettingsTabValue } from "@blocks-idp/settings/models/settings.model"
import { AuthConfigTab } from "@blocks-idp/settings/pages/tabs/auth-config-tab"
import { IamConfigTab } from "@blocks-idp/settings/pages/tabs/iam-config-tab"
import { OrganizationConfigTab } from "@blocks-idp/settings/pages/tabs/organization-config-tab"
import { SignupSettingsTab } from "@blocks-idp/settings/pages/tabs/signup-settings-tab"

const SETTINGS_TABS: { value: SettingsTabValue; label: string }[] = [
  { value: "iam-config", label: "IAM" },
  { value: "auth-config", label: "Auth" },
  { value: "organization-config", label: "Organization" },
  { value: "signup-settings", label: "Signup" },
]

export const SettingsPage = () => {
  const [settingsTab, setSettingsTab] = useQueryState("settingsTab", {
    defaultValue: "iam-config" satisfies SettingsTabValue,
  })

  const activeTab = (settingsTab ?? "iam-config") as SettingsTabValue

  const handleTabChange = (value: string) => {
    void setSettingsTab(value)
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex w-full flex-col"
    >
      <div className="mb-5 flex items-center justify-between text-base">
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
              <TabsTrigger key={tab.value} value={tab.value} className="h-8">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <TabsContent value="iam-config">
        <IamConfigTab />
      </TabsContent>
      <TabsContent value="auth-config">
        <AuthConfigTab />
      </TabsContent>
      <TabsContent value="organization-config">
        <OrganizationConfigTab />
      </TabsContent>
      <TabsContent value="signup-settings">
        <SignupSettingsTab />
      </TabsContent>
    </Tabs>
  )
}
