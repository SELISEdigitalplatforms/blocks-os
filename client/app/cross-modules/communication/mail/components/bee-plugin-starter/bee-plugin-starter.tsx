import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import BeefreeSDK from "@beefree.io/sdk";
import {
  IBeeConfig,
  IMergeTag,
  ISpecialLink,
  IEntityContentJson,
  IToken,
} from "@beefree.io/sdk/dist/types/bee";
import { blankTemplate } from "@blocks-communication/mail/constants/email-template";
import { emailService } from "@blocks-communication/mail/services/email.services";

const BEEJS_URL = "https://app-rsrc.getbee.io/plugin/BeePlugin.js";
const API_AUTH_URL = "https://auth.getbee.io/loginV2";
// Must match the `PluginProvider` value stored in the TemplatePluginConfigs
// collection for the backend to find the right credentials/config.
const BEE_PLUGIN_PROVIDER = "Bee";
const BEE_PLUGIN_UID =
  "prod-874A6A2B-F0F5-43EB-A458-47C2C1A21231-d7d199f0-afab-44aa-9fc8-906cfb184730";
const BEE_PLUGIN_CONTAINER_ID = "bee-plugin-container";

const specialLinks: ISpecialLink[] = [
  {
    type: "unsubscribe",
    label: "SpecialLink.Unsubscribe",
    link: "http://[unsubscribe]/",
  },
  {
    type: "subscribe",
    label: "SpecialLink.Subscribe",
    link: "http://[subscribe]/",
  },
];

const mergeTags: IMergeTag[] = [
  {
    name: "tag 1",
    value: "[tag1]",
  },
  {
    name: "tag 2",
    value: "[tag2]",
  },
];

interface IBeePluginStarterProps {
  onBeeSave(data: { htmlFile: string; jsonFile: string }): void;
  onBeeTemplateLoad?: (isLoaded: boolean) => void;
  jsonFile?: IEntityContentJson | Record<string, unknown>;
}

const BeePluginStarter = forwardRef(function Inner(
  { onBeeSave, onBeeTemplateLoad, jsonFile = blankTemplate }: IBeePluginStarterProps,
  ref,
) {
  const [bee, setBee] = useState<BeefreeSDK | null>(null);

  // Props live in refs so beeConfig can be built once. Rebuilding it would
  // restart the editor on every parent render, and the parent passes fresh
  // callback and template identities each time.
  const onBeeSaveRef = useRef(onBeeSave);
  const onBeeTemplateLoadRef = useRef(onBeeTemplateLoad);
  const jsonFileRef = useRef(jsonFile);

  useEffect(() => {
    onBeeSaveRef.current = onBeeSave;
  }, [onBeeSave]);

  useEffect(() => {
    onBeeTemplateLoadRef.current = onBeeTemplateLoad;
  }, [onBeeTemplateLoad]);

  useEffect(() => {
    jsonFileRef.current = jsonFile;
  }, [jsonFile]);

  // Guards against the SDK being started more than once for the same mount.
  const isInitializedRef = useRef(false);

  const beeConfig: IBeeConfig = useMemo(
    () => ({
      uid: BEE_PLUGIN_UID,
      container: BEE_PLUGIN_CONTAINER_ID,
      autosave: 30,
      language: "en-US",
      specialLinks,
      mergeTags,
      onSave: (savedJsonFile, savedHtmlFile) => {
        onBeeSaveRef.current({ jsonFile: savedJsonFile, htmlFile: savedHtmlFile });
      },
      onLoad: () => {
        onBeeTemplateLoadRef.current?.(true);
      },
      onError: (errorMessage) => console.error("*** [integration] (onError) --> ", errorMessage),
      onWarning: (e) => console.error("*** [integration] (onWarning) --> ", e.message),
    }),
    [],
  );

  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;

    emailService
      .fetchTemplatePluginToken(BEE_PLUGIN_PROVIDER, BEE_PLUGIN_UID)
      .then((response) => {
        if (!response?.access_token) {
          throw new Error("No access token returned for the template plugin.");
        }
        const token: IToken = { access_token: response.access_token, v2: true };
        return new BeefreeSDK(token, { authUrl: API_AUTH_URL, beePluginUrl: BEEJS_URL });
      })
      .then((beeInstance) => beeInstance.start(beeConfig, jsonFileRef.current ?? blankTemplate))
      .then((instance) => setBee(instance as BeefreeSDK))
      .catch((error) => {
        // Allow a retry on the next mount rather than leaving the editor dead.
        isInitializedRef.current = false;
        console.error("Bee plugin initialization failed --> ", error);
      });
  }, [beeConfig]);

  useImperativeHandle(
    ref,
    () => ({
      submit() {
        bee?.save();
      },
      preview() {
        bee?.preview();
      },
      reset() {
        bee?.load(jsonFile as IEntityContentJson);
      },
    }),
    [bee, jsonFile],
  );

  return <div id={BEE_PLUGIN_CONTAINER_ID} className="h-[calc(100vh-60px)] w-full" />;
});

export default BeePluginStarter;
