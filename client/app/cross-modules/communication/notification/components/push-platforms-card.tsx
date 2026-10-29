import type { ReactNode } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Switch } from "@/components/ui-kits/switch/switch";
import {
  PUSH_PLATFORMS,
  type IPushSettings,
  type IPushStatus,
  type PlatformFlags,
  type PushPlatform,
} from "../models/push.model";
import { APNS_HINT, PLATFORM_LABEL, PLATFORMS_TEXT } from "../constants/push-ui.constant";
import { deviceCountText, timeAgo } from "../utils/push-format";
import { isApnsFailure, resultLabel } from "../utils/push-results";
import { isPushReady } from "../hooks/use-push-settings";

const ROW_GRID =
  "grid grid-cols-[110px_60px_90px_minmax(0,1fr)_auto] items-center gap-3 px-5 text-sm";

interface LastTestPillProps {
  platform: PushPlatform;
  status: IPushStatus | undefined;
  webReady: boolean;
}

function LastTestPill({ platform, status, webReady }: Readonly<LastTestPillProps>) {
  if (platform === "web" && !webReady) {
    return (
      <Badge variant="secondary" className="w-fit font-normal">
        {PLATFORMS_TEXT.needsWebConfig}
      </Badge>
    );
  }
  const last = status?.[platform].lastTest;
  if (!last) {
    return (
      <Badge variant="secondary" className="w-fit font-normal">
        {PLATFORMS_TEXT.notTested}
      </Badge>
    );
  }
  if (last.failed > 0) {
    const reason = last.reason ? ` · ${resultLabel(last.reason)}` : "";
    return (
      <Badge variant="error" className="w-fit font-normal">
        Failed{reason}
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="w-fit font-normal">
      Delivered · {timeAgo(last.at)}
    </Badge>
  );
}

interface PlatformRowProps {
  platform: PushPlatform;
  checked: boolean;
  switchDisabled: boolean;
  devices: number;
  testDisabled: boolean;
  status: IPushStatus | undefined;
  webReady: boolean;
  onCheckedChange: (checked: boolean) => void;
  onTest: () => void;
  children?: ReactNode;
}

function PlatformRow({
  platform,
  checked,
  switchDisabled,
  devices,
  testDisabled,
  status,
  webReady,
  onCheckedChange,
  onTest,
  children,
}: Readonly<PlatformRowProps>) {
  const label = PLATFORM_LABEL[platform];
  const reason = status?.[platform].lastTest?.reason;
  const failed = (status?.[platform].lastTest?.failed ?? 0) > 0;
  const hint =
    failed && isApnsFailure(platform, reason) ? APNS_HINT[reason as keyof typeof APNS_HINT] : null;
  return (
    <div className="flex flex-col gap-2 border-t py-3.5">
      <div className={ROW_GRID}>
        <span className="font-semibold">{label}</span>
        <Switch
          size="sm"
          aria-label={`${label} sending`}
          checked={checked}
          disabled={switchDisabled}
          onCheckedChange={onCheckedChange}
        />
        <span className={devices === 0 ? "text-medium-emphasis" : undefined}>
          {deviceCountText(devices)}
        </span>
        <LastTestPill platform={platform} status={status} webReady={webReady} />
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={testDisabled}
          aria-label={`${PLATFORMS_TEXT.sendTest} ${label}`}
          onClick={onTest}
        >
          {PLATFORMS_TEXT.sendTest}
        </Button>
      </div>
      {hint && (
        <div className="mx-5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm sm:ml-[134px]">
          {hint}
        </div>
      )}
      {children && <div className="mx-5 sm:ml-[134px]">{children}</div>}
    </div>
  );
}

interface PushPlatformsCardProps {
  settings: IPushSettings;
  status: IPushStatus | undefined;
  /** The switches as the user set them, not yet saved. */
  platforms: PlatformFlags;
  /** A key is stored or chosen in this save. */
  keyKnown: boolean;
  /** A web config is stored or added in this save. */
  webReady: boolean;
  testing: boolean;
  onPlatformChange: (platform: PushPlatform, checked: boolean) => void;
  onTest: (platform?: PushPlatform) => void;
  onViewDevices: () => void;
  webPanel: ReactNode;
}

/** Android, iOS and Web rows: switch, device count, last test and a test send. Web holds its config panel. */
export function PushPlatformsCard({
  settings,
  status,
  platforms,
  keyKnown,
  webReady,
  testing,
  onPlatformChange,
  onTest,
  onViewDevices,
  webPanel,
}: Readonly<PushPlatformsCardProps>) {
  const total = PUSH_PLATFORMS.reduce(
    (sum, platform) => sum + (status?.[platform].devices ?? 0),
    0,
  );
  const ready = isPushReady(settings);
  const canTest = (platform: PushPlatform) =>
    ready &&
    settings.platforms[platform] &&
    (platform !== "web" || settings.hasWebConfig) &&
    !testing;
  return (
    <Card className="max-w-[880px]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">{PLATFORMS_TEXT.title}</h2>
          <p className="text-xs text-medium-emphasis">{PLATFORMS_TEXT.help}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="xs" onClick={onViewDevices}>
            {PLATFORMS_TEXT.viewDevices} ({total})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={!ready || testing}
            onClick={() => onTest()}
          >
            {PLATFORMS_TEXT.testAll}
          </Button>
        </div>
      </div>
      <div
        className={`${ROW_GRID} border-t bg-muted/40 py-2 text-xs font-semibold text-medium-emphasis`}
      >
        <span>{PLATFORMS_TEXT.platform}</span>
        <span>{PLATFORMS_TEXT.sending}</span>
        <span>{PLATFORMS_TEXT.devices}</span>
        <span>{PLATFORMS_TEXT.lastTest}</span>
        <span />
      </div>
      {PUSH_PLATFORMS.map((platform) => {
        const isWeb = platform === "web";
        return (
          <PlatformRow
            key={platform}
            platform={platform}
            checked={platforms[platform] && (!isWeb || webReady)}
            switchDisabled={!keyKnown || (isWeb && !webReady)}
            devices={status?.[platform].devices ?? 0}
            testDisabled={!canTest(platform)}
            status={status}
            webReady={webReady}
            onCheckedChange={(checked) => onPlatformChange(platform, checked)}
            onTest={() => onTest(platform)}
          >
            {isWeb ? webPanel : null}
          </PlatformRow>
        );
      })}
    </Card>
  );
}
