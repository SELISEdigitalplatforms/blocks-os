namespace Cloud.LmtService.Models.ColdRestore
{
    public enum RestoreRequestStatus
    {
        Pending,
        InProgress,
        Completed,
        PartialSuccess,
        Failed,
        Cancelled
    }

    public enum RestoreFileProgressStatus
    {
        Pending,
        Processing,
        Completed,
        FileNotFound,
        Failed,
        Cancelled
    }

    public enum RestoreDataType
    {
        Trace,
        Log
    }
}
