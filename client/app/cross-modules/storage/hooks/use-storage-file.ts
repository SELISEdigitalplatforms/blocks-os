import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ICreateDmsFolderPayload,
  IGetDmsFileAndFolderPayload,
  IGetFileByFileIDPayload,
  IGetFileByFileIDResponse,
  IGetFilesInfoPayload,
  IUploadDmsFilePayload,
} from "../models/storage.model";
import { storageService } from "../services/storage.service";

/**
 * A cached signed download URL must not outlive the provider's expiry, or a consumer reusing the
 * query cache would be handed a dead URL. Ties the query's staleTime to `downloadUrlExpiresAtUtc`
 * instead of the global default so React Query naturally refetches once the URL has expired: no
 * expiry (local storage, or an intentionally anonymous Public URL) keeps the global
 * default/never-stale behavior; a past expiry is immediately stale.
 */
const staleTimeFromDownloadUrlExpiry = (query: {
  state: { data?: IGetFileByFileIDResponse };
}) => {
  const expiresAt = query.state.data?.downloadUrlExpiresAtUtc;
  if (expiresAt === undefined) return 60 * 1000;
  if (expiresAt === null) return Infinity;
  return Math.max(new Date(expiresAt).getTime() - Date.now(), 0);
};

export const useGetPreSignedUrlForUpload = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "file", "getPresignedUrl"],
    mutationFn: storageService.file.getPreSignedUrlForUpload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage", "file", "getFilesInfo"] });
    },
  });
};

export const useCompleteUpload = () => {
  return useMutation({
    mutationKey: ["storage", "file", "completeUpload"],
    mutationFn: storageService.file.completeUpload,
  });
};

export const useUploadFile = () => {
  return useMutation({
    mutationKey: ["storage", "file", "getPresignedUrl"],
    mutationFn: storageService.uploadFile,
  });
};

export const useUploadFileToLocalStorage = () => {
  return useMutation({
    mutationKey: ["storage", "file", "upload"],
    mutationFn: storageService.uploadFileToLocalStorage,
  });
};

export const useGetFile = (option: IGetFileByFileIDPayload) => {
  return useQuery({
    queryKey: ["file", option],
    queryFn: () => storageService.file.getFileByFileId(option),
    staleTime: staleTimeFromDownloadUrlExpiry,
  });
};

export const useLazyGetFile = () => {
  const queryClient = useQueryClient();

  const fetchFile = (option: IGetFileByFileIDPayload) => {
    return queryClient.fetchQuery({
      queryKey: ["file", option],
      queryFn: () => storageService.file.getFileByFileId(option),
      staleTime: staleTimeFromDownloadUrlExpiry,
    });
  };

  return { fetchFile };
};
export const useDeleteFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["storage", "file", "delete"],
    mutationFn: storageService.file.deleteFileByFileId,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "file", "getFilesInfo"],
      });
    },
  });
};

// DEADCODE 2026-07-29: hook with no callers in client, e2e or tests; commented pending review
// export const useDeleteFolder = () => {
//   const queryClient = useQueryClient();
////   return useMutation({
//     mutationKey: ["storage", "folder", "delete"],
//     mutationFn: storageService.file.deleteFolderByFileId,
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: ["storage", "folder", "getFolderInfo"],
//       });
//     },
//   });
// };

export const useGetFilesInfo = (options: IGetFilesInfoPayload) => {
  return useQuery({
    queryKey: ["storage", "file", "getFilesInfo", options],
    queryFn: () => storageService.file.getFilesInfoUrlForUpload(options),
  });
};

export const useGetFilesDownload = (
  meta: { fileId: string; projectKey: string },
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["getFilesDownload", meta.fileId, meta.projectKey],
    queryFn: () => storageService.file.getFilesDownloadUrl(meta),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
    staleTime: staleTimeFromDownloadUrlExpiry,
  });
};

export const usePublicCertificateFile = () => {
  return useMutation({
    mutationKey: ["storage", "file", "public-certificate"],
    mutationFn: storageService.uploadPublicCertificateFile,
  });
};

export const useGetDmsFileAndFolder = () => {
  return useMutation({
    mutationKey: ["storage", "file", "dms-file-and-folder"],
    mutationFn: (payload: IGetDmsFileAndFolderPayload) =>
      storageService.getFilesAndFolders(payload),
  });
};

export const useUploadDmsFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["upload", "dms-file"],
    mutationFn: (payload: IUploadDmsFilePayload) => storageService.uploadDmsFile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "file", "dms-file-and-folder"],
      });
    },
  });
};

export const useCreateDmsFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["create-folder", "dms-folder"],
    mutationFn: (payload: ICreateDmsFolderPayload) => storageService.createDmsFolder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "file", "dms-file-and-folder"],
      });
    },
  });
};
