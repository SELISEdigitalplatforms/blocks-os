namespace Cloud.LmtService.Services.ArchiveAndDelete
{
    public interface IArchiveService
    {
        /// <summary>
        /// Entry point for the scheduled backup job.
        /// Runs Phase 1 (hot DB → archive MongoDB) then Phase 2 (archive MongoDB → blob storage)
        /// directly in-process — no internal message queues.
        /// </summary>
        Task StartBackupAsync();

        Task DeleteMiscellaneousLog();
    }
}
