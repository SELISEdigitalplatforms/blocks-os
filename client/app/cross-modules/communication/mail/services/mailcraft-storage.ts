import type { Asset, StorageProvider } from "@seliseblocks/mailcraft";
import { ModuleName } from "@/constants/modules.constants";
import { storageService } from "@blocks-storage/services/storage.service";

const PAGE_SIZE = 24;
const IMAGE_NAME_PATTERN = /\.(png|jpe?g|gif|webp)$/i;
const UPLOAD_ACCESS_MODIFIER = "Public";
const UPLOAD_CONFIGURATION_NAME = "Default";
const FILE_IDS_STORAGE_PREFIX = "blocks-os:mailcraft:file-ids";

function fileIdsStorageKey(projectKey: string): string {
  return `${FILE_IDS_STORAGE_PREFIX}:${projectKey}`;
}

function readFileIds(projectKey: string): string[] {
  if (!projectKey || typeof localStorage === "undefined") return [];

  try {
    const value: unknown = JSON.parse(localStorage.getItem(fileIdsStorageKey(projectKey)) ?? "[]");
    if (!Array.isArray(value)) return [];

    return [...new Set(value.filter((fileId): fileId is string => typeof fileId === "string" && !!fileId))];
  } catch {
    return [];
  }
}

function writeFileIds(projectKey: string, fileIds: string[]): void {
  if (!projectKey || typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(fileIdsStorageKey(projectKey), JSON.stringify([...new Set(fileIds)]));
  } catch {
    // Storage access can be disabled by the browser. Uploading should still
    // succeed for the current editor session in that case.
  }
}

function rememberFileId(projectKey: string, fileId: string): void {
  writeFileIds(projectKey, [...readFileIds(projectKey), fileId]);
}

function forgetFileId(projectKey: string, fileId: string): void {
  writeFileIds(
    projectKey,
    readFileIds(projectKey).filter((storedFileId) => storedFileId !== fileId),
  );
}

export const MAILCRAFT_STORAGE_LIMITS = {
  accept: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  maxBytes: 5 * 1024 * 1024,
  maxFilesPerDrop: 10,
  allowSvg: false,
};

export interface MailcraftStorageOptions {
  /**
   * Optional existing storage directory. By default images are uploaded to
   * the root, matching the Client logo upload flow.
   */
  parentDirectoryId?: string;
}

/**
 * Bridges MailCraft to Blocks storage. The library uses GetFiles because it
 * displays multiple images; each upload follows the same presigned-URL flow
 * as the Client logo uploader.
 */
export function createMailcraftStorageProvider(
  projectKey: string,
  options: MailcraftStorageOptions = {},
): StorageProvider {
  const parentDirectoryId = options.parentDirectoryId ?? "";

  return {
    async list({ cursor, query }) {
      const page = cursor ? Number(cursor) : 0;
      const normalizedQuery = query?.trim().toLocaleLowerCase();
      const files = await storageService.file.getFiles({
        fileIds: readFileIds(projectKey),
        configurationName: UPLOAD_CONFIGURATION_NAME,
      });
      const matchingFiles = files
        .filter((file) => IMAGE_NAME_PATTERN.test(file.name ?? ""))
        .filter(
          (file) => !normalizedQuery || file.name.toLocaleLowerCase().includes(normalizedQuery),
        )
        .sort((left, right) => right.name.localeCompare(left.name));
      const offset = page * PAGE_SIZE;
      const items: Asset[] = matchingFiles.slice(offset, offset + PAGE_SIZE).map((file) => ({
        id: file.itemId,
        name: file.name,
        url: file.url,
        folder: "",
        w: 0,
        ht: 0,
        size: file.sizeInBytes ?? 0,
      }));
      const hasMore = offset + PAGE_SIZE < matchingFiles.length;

      return { items, cursor: hasMore ? String(page + 1) : null };
    },

    async upload(file, { width, height }) {
      const presigned = await storageService.file.getPreSignedUrlForUpload({
        itemId: "",
        accessModifier: UPLOAD_ACCESS_MODIFIER,
        configurationName: UPLOAD_CONFIGURATION_NAME,
        name: file.name,
        projectKey,
        tags: "",
        metaData: "",
        parentDirectoryId,
        moduleName: ModuleName.IAMCloud,
      });
      if (!presigned?.isSuccess) {
        throw new Error("Could not get an upload URL for the image.");
      }

      await storageService.uploadFile({ url: presigned.uploadUrl, file });
      rememberFileId(projectKey, presigned.fileId);
      const saved = await storageService.file.getFileByFileId({
        itemId: presigned.fileId,
        projectKey,
      });

      return {
        id: saved.itemId,
        name: file.name,
        url: saved.url,
        folder: "",
        w: width,
        ht: height,
        size: file.size,
      };
    },

    async remove(asset) {
      await storageService.file.deleteFileByFileId({ fileId: asset.id, projectKey });
      forgetFileId(projectKey, asset.id);
    },

    limits: MAILCRAFT_STORAGE_LIMITS,
  };
}
