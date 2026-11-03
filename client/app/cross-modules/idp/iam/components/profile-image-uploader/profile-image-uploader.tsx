import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import {
  useCompleteUpload,
  useGetPreSignedUrlForUpload,
  useUploadFile,
} from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { useGetUserById, useUpdateUser } from "@blocks-idp/iam/hooks/use-user";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useProfileImageSrc } from "./use-profile-image-src";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
const emptyProfilePhoto = "/assets/images/empty-profile-photo.png";
import { ModuleName } from "@/constants/modules.constants";
import { useT } from "@seliseblocks/genesis-os";
type ProfileImageUploaderProps = {
  projectKey: string;
  id: string;
  className?: string;
  containerClassName?: string;
};
export const ProfileImageUploader = ({
  projectKey,
  id,
  className,
  containerClassName,
}: ProfileImageUploaderProps) => {
  const { t } = useT("os.idp.iam-ui");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data } = useGetUserById({ id, projectKey });
  const { mutateAsync } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadImageMutate } = useUploadFile();
  const { mutateAsync: completeUploadMutate } = useCompleteUpload();
  const { mutateAsync: updateUserMutate } = useUpdateUser({
    projectKey,
    id,
  });
  const [isProfileImageUploading, setIsProfileImageUploading] = useState<boolean>(false);
  const currentUser = data?.data;
  const storedImageSrc = useProfileImageSrc(currentUser?.profileImageUrl);
  const image = localPreview ?? storedImageSrc;
  const uploadImage = async (file: File) => {
    try {
      setIsProfileImageUploading(true);
      // const profileImageId = "BLK-" + new Date().getTime().toString();
      const res = await mutateAsync({
        itemId: "",
        accessModifier: "Public",
        configurationName: "Default",
        name: file.name,
        projectKey,
        tags: "",
        metaData: "",
        parentDirectoryId: "",
        moduleName: ModuleName.IAMCloud,
      });
      if (!res.isSuccess) {
        return showErrorToast({
          errors: res.errors ?? t("PROFILE_IMAGE_UPLOADER.UPLOAD_FAILED"),
        });
      }
      const profileImageId = res.fileId;
      await uploadImageMutate({ url: res.uploadUrl, file });
      if (res.uploadCompletionRequired) {
        const completion = await completeUploadMutate({
          fileId: profileImageId,
          fileVersionId: res.fileVersionId ?? "",
        });
        if (completion.verificationStatus !== "Verified") {
          return showErrorToast({
            errors: completion.rejectionReason ?? t("PROFILE_IMAGE_UPLOADER.VERIFICATION_FAILED"),
          });
        }
      }
      const userProfileFile = await storageService.file.getFileByFileId({
        itemId: profileImageId,
        projectKey,
      });
      const updatedUser = await updateUserMutate({
        itemId: id,
        profileImageId: userProfileFile.itemId,
        profileImageUrl: userProfileFile.url,
      });
      if (!updatedUser.isSuccess) return showErrorToast({ errors: updatedUser.errors });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      showSuccessToast({ description: t("PROFILE_IMAGE_UPLOADER.UPDATED") });
    } catch (error) {
      if (isErrorWithErrors(error)) {
        return showErrorToast({ errors: error.errors });
      }
      return showErrorToast({ errors: t("PROFILE_IMAGE_UPLOADER.GENERIC_ERROR") });
    } finally {
      setIsProfileImageUploading(false);
    }
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    const MAX_SIZE_MB = 5;
    const ALLOWED_TYPES = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      event.target.value = "";
      return showErrorToast({
        errors: t("PROFILE_IMAGE_UPLOADER.INVALID_TYPE"),
      });
    }
    if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
      event.target.value = "";
      return showErrorToast({
        errors: t("PROFILE_IMAGE_UPLOADER.FILE_TOO_LARGE", { size: MAX_SIZE_MB }),
      });
    }
    // The preview is the file's own object URL; only a blob: URL is ever used as the image source.
    const preview = new URL(URL.createObjectURL(selectedFile));
    if (preview.protocol === "blob:") setLocalPreview(preview.href);
    uploadImage(selectedFile);
    event.target.value = "";
  };
  return (
    <div className={cn("flex flex-col items-center justify-center", containerClassName)}>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        aria-label={t("PROFILE_IMAGE_UPLOADER.CHANGE_IMAGE")}
        disabled={isProfileImageUploading}
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        className={cn(
          "group relative aspect-square w-full max-w-[200px] cursor-pointer overflow-hidden rounded-lg bg-gray-50 disabled:cursor-not-allowed dark:bg-gray-800",
          className,
        )}
      >
        <img
          src={image ?? emptyProfilePhoto}
          alt={t("PROFILE_IMAGE_UPLOADER.IMAGE_ALT")}
          className="h-full w-full rounded-[inherit] object-cover object-center"
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/0 transition-colors group-hover:bg-black/40 group-disabled:bg-black/0">
          <Camera className="h-7 w-7 text-white opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0" />
        </div>
        {isProfileImageUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-gray-50/75 dark:bg-gray-800/75" />
        )}
      </button>
    </div>
  );
};
