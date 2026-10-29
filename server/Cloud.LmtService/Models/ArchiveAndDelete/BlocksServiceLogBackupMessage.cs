namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// Message to initiate backup for a specific blocks service.
    /// This triggers fetching tenant IDs and creating batches.
    /// </summary>
    public class BlocksServiceLogBackupMessage
    {
        public string ServiceName { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
