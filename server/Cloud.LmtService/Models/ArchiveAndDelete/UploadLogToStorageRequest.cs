namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class UploadLogToStorageRequest
    {
        public string FileName { get; set; } = null!;
        public Stream Content { get; set; } = null!;
        public CancellationToken ct { get; set; } = default(CancellationToken);
    }
}
