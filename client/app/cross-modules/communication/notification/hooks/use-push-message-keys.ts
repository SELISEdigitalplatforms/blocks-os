import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  useGetLanguageModules,
  useGetLanguages,
} from "@blocks-localization/hooks/use-language-manager";
import { languageManagerService } from "@blocks-localization/services/language.manager.service";
import type { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";
import { NOTIFICATION_LOCALIZATION_MODULE } from "../constants/notification-ui.constant";

const KEYS_PAGE_SIZE = 200;

export interface PushMessageKeys {
  keys: IBlocksLanguageKey[];
  languages: ILanguageConfig[];
  isLoading: boolean;
  isError: boolean;
}

/** The keys of the Localization module `notifications`, with the project's languages. */
export const usePushMessageKeys = (enabled: boolean): PushMessageKeys => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const modules = useGetLanguageModules();
  const languages = useGetLanguages();
  const moduleId = (modules.data ?? []).find(
    (m) => m.moduleName === NOTIFICATION_LOCALIZATION_MODULE,
  )?.itemId;

  const keys = useQuery({
    queryKey: ["notification-push-keys", tenantId, moduleId],
    queryFn: () =>
      languageManagerService.fetchBlocksLanguageKey({
        projectKey: tenantId,
        pageNumber: 0,
        pageSize: KEYS_PAGE_SIZE,
        searchKey: "",
        moduleIds: [moduleId ?? ""],
        isPartiallyTranslated: false,
        sortProperty: "KeyName",
        isDescending: false,
      }),
    enabled: enabled && !!tenantId && !!moduleId,
  });

  return {
    keys: keys.data?.keys ?? [],
    languages: languages.data ?? [],
    isLoading: modules.isLoading || languages.isLoading || keys.isLoading,
    isError: modules.isError || keys.isError,
  };
};
