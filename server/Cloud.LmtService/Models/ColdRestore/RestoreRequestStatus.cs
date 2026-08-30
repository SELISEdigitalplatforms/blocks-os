namespace Cloud.LmtService.Models.ColdRestore
{
    public enum RestoreRequestStatus
    {
        Pending,
        InProgress,
        Completed,
        PartialSuccess,
        Failed
    }

    public enum RestoreFileProgressStatus
    {
        Pending,
        Processing,
        Completed,
        FileNotFound,
        Failed
    }

    public enum RestoreDataType
    {
        Trace,
        Log
    }
}
