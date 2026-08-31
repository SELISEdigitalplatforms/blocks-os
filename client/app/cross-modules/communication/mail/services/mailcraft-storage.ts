import type { Asset, StorageProvider } from "@seliseblocks/mailcraft";
import { ModuleName } from "@/constants/modules.constants";
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
export interface MailcraftStorageOptions {
  /**
   * Directory to upload into -- the `fileStorageId` handed back by
   * `storageService.createDmsFolder` (POST /Storage/CreateFolder), or any
   * existing directory id. Defaults to "" (root): `null` is *not* a valid
   * default here, it asks Blocks Data for the module's default directory,
   * which dev projects don't provision (default_directory_not_found).
   * Listing is unaffected either way -- GetFiles has no folder input.
   */
  parentDirectoryId?: string;
}

export function createMailcraftStorageProvider(
  projectKey: string,
  options: MailcraftStorageOptions = {},
): StorageProvider {
  const parentDirectoryId = options.parentDirectoryId ?? "";
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
      const presigned = await storageService.file.getPreSignedUrlForUpload({
        itemId: "",
        accessModifier: UPLOAD_ACCESS_MODIFIER,
        configurationName: UPLOAD_CONFIGURATION_NAME,
        name: file.name,
        projectKey,
        tags: "",
        metaData: "",
        // Root by default -- see MailcraftStorageOptions for why "" and
        // never null, and how to pin uploads to a created folder instead.
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
