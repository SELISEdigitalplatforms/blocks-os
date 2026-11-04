import React from "react";
import { Paperclip } from "lucide-react";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { ArrowDownToLine, CloudUpload } from "lucide-react";
import { useState } from "react";
import { useT } from "@seliseblocks/genesis-os";
import {
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
  FileInput,
} from "@/components/file-uploader/file-uploader";
const FileSvgDraw = () => {
  const { t } = useT("os.communication.mail");
  return (
    <>
      <div className="text-gmedium-emphasis mb-3 h-8 w-8">
        <CloudUpload />
      </div>
      <p className="mb-1 text-sm text-high-emphasis">
        <span className="font-semibold text-primary">
          {t("IMPORT_COMMUNICATIONS.CLICK_TO_UPLOAD")}
        </span>
        &nbsp; {t("IMPORT_COMMUNICATIONS.OR_DRAG_AND_DROP")}
      </p>
      <p className="text-xs text-low-emphasis">{t("IMPORT_COMMUNICATIONS.FILE_TYPES")}</p>
    </>
  );
};
export default function ImportCommunications() {
  const { t } = useT("os.communication.mail");
  const [files, setFiles] = useState<File[] | null>(null);
  const dropZoneConfig = {
    maxFiles: 5,
    maxSize: 1024 * 1024 * 4,
    multiple: true,
  };
  return (
    <DialogContent className="rounded-md sm:max-w-[450px]">
      <DialogHeader>
        <DialogTitle className="text-left">{t("IMPORT_COMMUNICATIONS.TITLE")}</DialogTitle>
        <DialogDescription className="text-left">
          <div>{t("IMPORT_COMMUNICATIONS.DESCRIPTION")}</div>
          <FileUploader
            value={files}
            onValueChange={setFiles}
            dropzoneOptions={dropZoneConfig}
            className="relative mb-2 mt-6 rounded-lg bg-background p-[0.5px]"
          >
            <FileInput className="rounded-md outline-dashed outline-1 outline-border-default">
              <div className="flex w-full flex-col items-center justify-center py-4">
                <FileSvgDraw />
              </div>
            </FileInput>
            <FileUploaderContent>
              {files &&
                files.length > 0 &&
                files.map((file, i) => (
                  <FileUploaderItem key={i} index={i}>
                    <Paperclip className="h-4 w-4 stroke-current" />
                    <span>{file.name}</span>
                  </FileUploaderItem>
                ))}
            </FileUploaderContent>
          </FileUploader>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mr-1 grid grid-cols-2 gap-2">
        <div className="mt-2 flex flex-row gap-2 text-primary">
          <ArrowDownToLine size={20} />
          <h3 className="text-sm font-medium">{t("IMPORT_COMMUNICATIONS.FILE_TEMPLATE")}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="default">
            {t("common:CANCEL")}
          </Button>
          <Button size="default" className="bg-primary">
            {t("common:UPLOAD")}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
