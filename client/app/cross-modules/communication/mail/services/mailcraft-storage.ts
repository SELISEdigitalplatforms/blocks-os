import type { Asset, StorageProvider } from "@seliseblocks/mailcraft";
import { ModuleName } from "@/constants/modules.constants";
import { DmsItemType } from "@blocks-storage/models/storage.model";
import { storageService } from "@blocks-storage/services/storage.service";

const PAGE_SIZE = 24;

/**
 * The listing endpoint returns every file in the project's storage, so the
 * library view is narrowed to the formats the editor accepts for upload.
 */
const IMAGE_NAME_PATTERN = /\.(png|jpe?g|gif|webp)$/i;

// Uploaded images end up inside sent emails, so they must stay publicly
// reachable long after the editor session — hence accessModifier "Public".
const UPLOAD_ACCESS_MODIFIER = "Public";
const UPLOAD_CONFIGURATION_NAME = "Default";

export const MAILCRAFT_STORAGE_LIMITS = {
  accept: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  maxBytes: 5 * 1024 * 1024,
  maxFilesPerDrop: 10,
  allowSvg: false,
};

/**
 * Bridges the MailCraft editor's storageProvider contract onto the Blocks
 * storage service: listing via GetFiles, uploads via the presigned-URL flow,
 * and deletes via DeleteFile.
 */
/** The folder editor uploads land in unless the host pins or disables one. */
export const MAILCRAFT_DIRECTORY_NAME = "email-assets";

export interface MailcraftStorageOptions {
  /**
   * Pin uploads to an exact directory id (a `fileStorageId`), skipping the
   * ensure-directory flow entirely. Note "" means root -- `null` is *not* a
   * valid value for the presigned request, it asks Blocks Data for the
   * module's default directory, which dev projects don't provision
   * (default_directory_not_found).
   */
  parentDirectoryId?: string;
  /**
   * Name of the folder to find-or-create for uploads (default
   * "email-assets"). Pass `null` to skip folders and upload to root.
   * Listing is unaffected either way -- GetFiles has no folder input.
   */
  directoryName?: string | null;
}

/**
 * Find-or-create the named top-level folder, once per provider: the resolved
 * id (a `fileStorageId`) is cached, concurrent uploads share one in-flight
 * lookup, and *any* failure resolves to "" (root) -- an upload must never
 * fail because the folder APIs are unavailable in some environment, so the
 * folder is an organizational nicety, not a dependency.
 */
function directoryResolver(projectKey: string, name: string): () => Promise<string> {
  let pending: Promise<string> | null = null;
  return () => {
    pending ??= (async () => {
      try {
        const listing = await storageService.getFilesAndFolders({
          parentId: "",
          configurationName: UPLOAD_CONFIGURATION_NAME,
          projectKey,
          searchKey: name,
          skip: 0,
          take: 50,
        });
        const found = listing?.dmsFileAndFolderInfos?.find(
          (entry) => entry.type === DmsItemType.Folder && entry.name === name,
        );
        if (found?.fileStorageId) return found.fileStorageId;
        const created = await storageService.createDmsFolder({
          artifactName: name,
          description: "Images uploaded from the MailCraft email editor",
          parentId: "",
          tags: [],
          metaData: {},
          organizationId: "",
          fileStorageId: "",
          projectKey,
          configurationName: UPLOAD_CONFIGURATION_NAME,
        });
        const node = created?.result?.find((entry) => entry.success);
        return node?.fileStorageId ?? "";
      } catch {
        return "";
      }
    })();
    return pending;
  };
}

export function createMailcraftStorageProvider(
  projectKey: string,
  options: MailcraftStorageOptions = {},
): StorageProvider {
  const directoryName = options.directoryName === undefined ? MAILCRAFT_DIRECTORY_NAME : options.directoryName;
  const resolveDirectory =
    options.parentDirectoryId === undefined && directoryName
      ? directoryResolver(projectKey, directoryName)
      : null;
  return {
    // GetFiles resolves files for the authenticated project. It has no folder,
    // query, or pagination inputs, so those are applied locally for MailCraft.
    async list({ cursor, query }) {
      const page = cursor ? Number(cursor) : 0;
      const normalizedQuery = query?.trim().toLocaleLowerCase();
      const files = await storageService.file.getFiles({
        fileIds: [],
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
      const parentDirectoryId = options.parentDirectoryId ?? (resolveDirectory ? await resolveDirectory() : "");
      const presigned = await storageService.file.getPreSignedUrlForUpload({
        itemId: "",
        accessModifier: UPLOAD_ACCESS_MODIFIER,
        configurationName: UPLOAD_CONFIGURATION_NAME,
        name: file.name,
        projectKey,
        tags: "",
        metaData: "",
        // The ensured folder, a pinned id, or "" (root) -- never null, which
        // asks for a default directory dev projects don't have. See
        // MailcraftStorageOptions and directoryResolver.
        parentDirectoryId,
        moduleName: ModuleName.DefaultCloud,
      });
      if (!presigned?.isSuccess) {
        throw new Error("Could not get an upload URL for the image.");
      }
      await storageService.uploadFile({ url: presigned.uploadUrl, file });
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
    },

    limits: MAILCRAFT_STORAGE_LIMITS,
  };
}
