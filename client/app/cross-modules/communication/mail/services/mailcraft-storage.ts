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

/**
 * Only consulted when parentDirectoryId is blank, which this provider never
 * leaves blank. Kept aligned with the other uploaders in the app.
 */
const UPLOAD_MODULE_NAME = ModuleName.IAMCloud;

/**
 * Marks a file as uploaded from the MailCraft editor.
 *
 * Written to both `tags` and `additionalProperties`: GetFiles returns tags but
 * omits additional properties, while GetFilesInfo -- the one endpoint that can
 * filter on additional properties server-side -- is commented out on this
 * backend. So the tag is what the library filter actually reads today, and the
 * additional property is there for when that endpoint is enabled.
 *
 * The owning organization needs no marker of its own: the backend stamps
 * TenantId from the caller's token and scopes every read by it.
 */
export const MAILCRAFT_ASSET_TAG = "mailcraft";
export const MAILCRAFT_ASSET_FILTER: Record<string, string> = { source: MAILCRAFT_ASSET_TAG };

export const MAILCRAFT_STORAGE_LIMITS = {
  accept: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  maxBytes: 5 * 1024 * 1024,
  maxFilesPerDrop: 10,
  allowSvg: false,
};

export interface MailcraftStorageOptions {
  /**
   * Name of the root directory uploads live in -- the organization id, so each
   * org owns one directory at the root of the tenant's storage.
   */
  organizationId?: string;
  /**
   * Pin uploads to an exact directory id, skipping the ensure flow. Never pass
   * "" or null: the backend treats both as "resolve the module's default
   * directory" and answers `default_directory_not_found` when the project has
   * none -- which no project does.
   */
  parentDirectoryId?: string;
}

/**
 * Find-or-create the organization's root directory, once per provider.
 *
 * Find: every image this editor uploads lands in that directory, so any file
 * carrying the MailCraft tag reports it as ParentDirectoryID. GetFiles is the
 * only listing endpoint available and it cannot list directories, so this is
 * the only way to recognise the directory again on a later session.
 *
 * Create: CreateDirectory with a blank parent creates at the root of the
 * tenant. It is commented out in the blocks-logic StorageController, so until
 * that action is enabled this call 404s and the upload fails with the message
 * below rather than the backend's opaque `default_directory_not_found`.
 *
 * A failed attempt is not cached, so the next upload retries.
 */
function directoryResolver(organizationId: string): () => Promise<string> {
  let pending: Promise<string> | null = null;
  return () => {
    pending ??= (async () => {
      const files = await storageService.file.getFiles({
        fileIds: [],
        configurationName: UPLOAD_CONFIGURATION_NAME,
      });
      const known = files.find(
        (file) => file.tags?.includes(MAILCRAFT_ASSET_TAG) && file.parentDirectoryID,
      )?.parentDirectoryID;
      if (known) return known;

      const created = await storageService.createDirectory({
        name: organizationId,
        // Root of the tenant: the org directory is a top-level directory.
        parentDirectoryId: "",
        description: "Images uploaded from the MailCraft email editor",
        configurationName: UPLOAD_CONFIGURATION_NAME,
        moduleName: UPLOAD_MODULE_NAME,
      });
      if (!created?.directoryId) {
        throw new Error(
          `Could not create the "${organizationId}" storage directory. The ` +
            "CreateDirectory endpoint is not enabled on this environment, and " +
            "uploads cannot proceed without a directory.",
        );
      }
      return created.directoryId;
    })().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

/**
 * Bridges the MailCraft editor's storageProvider contract onto the Blocks
 * storage service: listing via GetFiles, uploads via the presigned-URL flow,
 * and deletes via DeleteFile.
 */
export function createMailcraftStorageProvider(
  options: MailcraftStorageOptions = {},
): StorageProvider {
  const resolveDirectory = directoryResolver(options.organizationId ?? "");
  return {
    // GetFiles resolves files for the authenticated tenant. It has no folder,
    // query, or pagination inputs, so those are applied locally. The tag keeps
    // the project's other images (profile pictures, branding logos) out of the
    // editor's library.
    async list({ cursor, query }) {
      const page = cursor ? Number(cursor) : 0;
      const normalizedQuery = query?.trim().toLocaleLowerCase();
      const files = await storageService.file.getFiles({
        fileIds: [],
        configurationName: UPLOAD_CONFIGURATION_NAME,
      });
      const matchingFiles = files
        .filter((file) => file.tags?.includes(MAILCRAFT_ASSET_TAG))
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
      const parentDirectoryId = options.parentDirectoryId ?? (await resolveDirectory());
      const presigned = await storageService.file.getPreSignedUrlForUpload({
        itemId: "",
        accessModifier: UPLOAD_ACCESS_MODIFIER,
        configurationName: UPLOAD_CONFIGURATION_NAME,
        name: file.name,
        // ParseTags accepts a JSON array or one plain-text tag.
        tags: JSON.stringify([MAILCRAFT_ASSET_TAG]),
        metaData: "",
        additionalProperties: MAILCRAFT_ASSET_FILTER,
        parentDirectoryId,
        moduleName: UPLOAD_MODULE_NAME,
      });
      if (!presigned?.isSuccess) {
        throw new Error("Could not get an upload URL for the image.");
      }
      await storageService.uploadFile({ url: presigned.uploadUrl, file });
      const saved = await storageService.file.getFileByFileId({ itemId: presigned.fileId });
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
      await storageService.file.deleteFileByFileId({ fileId: asset.id });
    },

    limits: MAILCRAFT_STORAGE_LIMITS,
  };
}
