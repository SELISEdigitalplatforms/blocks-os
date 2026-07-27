import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  SettingsFormTabButtons,
  SettingsTabActions,
} from "@blocks-idp/settings/components/settings-tab-actions";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import type { SettingsTabValue } from "@blocks-idp/settings/models/settings.model";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SettingsTabLoadingShellProps = {
  tabId: SettingsTabValue;
  label: string;
  children: ReactNode;
  className?: string;
};

const SettingsTabLoadingShell = ({
  tabId,
  label,
  children,
  className,
}: SettingsTabLoadingShellProps) => (
  <div
    className={cn(SETTINGS_FORM_LAYOUT.formRoot, className)}
    aria-busy="true"
    aria-live="polite"
    aria-label={label}
  >
    <SettingsTabActions tabId={tabId}>
      <SettingsFormTabButtons
        onReset={() => undefined}
        onSave={() => undefined}
        resetDisabled
        saveDisabled
      />
    </SettingsTabActions>
    <div className={SETTINGS_FORM_LAYOUT.formStack}>{children}</div>
  </div>
);

const ToggleCardSkeleton = () => (
  <Card>
    <div className={SETTINGS_FORM_LAYOUT.toggleRow}>
      <div className={SETTINGS_FORM_LAYOUT.toggleLabelGroup}>
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 self-start sm:self-center">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-6 w-11 rounded-full" />
      </div>
    </div>
  </Card>
);

const SectionCardSkeleton = ({
  fieldCount = 4,
  stacked = false,
  withTrackBar = false,
}: {
  fieldCount?: number;
  stacked?: boolean;
  withTrackBar?: boolean;
}) => (
  <Card>
    <CardHeader className={SETTINGS_FORM_LAYOUT.sectionHeader}>
      <CardTitle className={SETTINGS_FORM_LAYOUT.sectionTitle}>
        <Skeleton className="h-5 w-48" />
      </CardTitle>
    </CardHeader>
    <CardContent>
      {withTrackBar ? (
        <div className="flex flex-col divide-y overflow-hidden rounded-lg border bg-muted/20 lg:flex-row lg:divide-x lg:divide-y-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 p-3 sm:p-4"
            >
              <Skeleton className="col-start-1 row-start-1 h-4 w-full max-w-[12rem]" />
              <Skeleton className="col-start-2 row-start-1 h-6 w-11 rounded-full" />
              <Skeleton className="col-start-1 row-start-2 h-3 w-full max-w-[10rem]" />
            </div>
          ))}
        </div>
      ) : stacked ? (
        <div className={SETTINGS_FORM_LAYOUT.stackedFields}>
          {Array.from({ length: fieldCount }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className={SETTINGS_FORM_LAYOUT.fieldGrid}>
          {Array.from({ length: fieldCount }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const BadgeSectionSkeleton = ({ titleWidth = "w-24" }: { titleWidth?: string }) => (
  <Card>
    <CardHeader className={SETTINGS_FORM_LAYOUT.sectionHeaderWithActions}>
      <CardTitle className={SETTINGS_FORM_LAYOUT.sectionTitle}>
        <Skeleton className={cn("h-5", titleWidth)} />
      </CardTitle>
      <Skeleton className="h-8 w-28 shrink-0" />
    </CardHeader>
    <CardContent>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full min-h-10 rounded-xl sm:w-40" />
        ))}
      </div>
    </CardContent>
  </Card>
);

type SettingsTabLoadingStateProps = {
  tabId: SettingsTabValue;
  includeToggle?: boolean;
  sectionCount?: number;
  className?: string;
};

export const AuthTabLoadingState = ({ className }: { className?: string }) => (
  <SettingsTabLoadingShell
    tabId="auth-config"
    label="Loading authentication settings"
    className={className}
  >
    <SectionCardSkeleton fieldCount={4} />
    <SectionCardSkeleton fieldCount={2} />
    <SectionCardSkeleton fieldCount={1} stacked />
  </SettingsTabLoadingShell>
);

export const IamTabLoadingState = ({ className }: { className?: string }) => (
  <SettingsTabLoadingShell tabId="iam-config" label="Loading IAM settings" className={className}>
    <ToggleCardSkeleton />
    <SectionCardSkeleton fieldCount={3} stacked />
    <SectionCardSkeleton fieldCount={2} />
    <SectionCardSkeleton fieldCount={2} stacked />
  </SettingsTabLoadingShell>
);

export const SettingsTabLoadingState = ({
  tabId,
  includeToggle = false,
  sectionCount = 2,
  className,
}: SettingsTabLoadingStateProps) => (
  <SettingsTabLoadingShell tabId={tabId} label="Loading settings" className={className}>
    {includeToggle ? <ToggleCardSkeleton /> : null}
    {Array.from({ length: sectionCount }).map((_, index) => (
      <SectionCardSkeleton key={index} />
    ))}
  </SettingsTabLoadingShell>
);

export const OrganizationTabLoadingState = () => (
  <SettingsTabLoadingShell tabId="organization-config" label="Loading organization settings">
    <ToggleCardSkeleton />
    <SectionCardSkeleton withTrackBar />
  </SettingsTabLoadingShell>
);

export const SignupTabLoadingState = () => (
  <SettingsTabLoadingShell tabId="signup-settings" label="Loading signup settings">
    <ToggleCardSkeleton />
    <BadgeSectionSkeleton titleWidth="w-16" />
    <BadgeSectionSkeleton titleWidth="w-28" />
  </SettingsTabLoadingShell>
);
