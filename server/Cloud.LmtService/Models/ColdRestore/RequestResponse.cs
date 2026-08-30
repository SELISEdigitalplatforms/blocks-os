using Blocks.Genesis;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;

namespace Cloud.LmtService.Models.ColdRestore
{
    public class StartColdRestoreRequest
    {
        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        // optional for logs filtering
        public string? ServiceName { get; set; }

        public string UserMail { get; set; }
    }
    public class StartColdRestoreResponse
    {
        public string RequestId { get; set; } = string.Empty;

        public string Status { get; set; } = "Pending";

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }
    }
    public class GetColdRestoreStatusRequest
    {
        public required string RequestId { get; set; }
        public required string SourceType { get; set; }
    }
    public class GetColdRestoreStatusResponse
    {
        public string RequestId { get; set; } = string.Empty;

        public string Status { get; set; } = "Pending";

        public int TotalFiles { get; set; }

        public int ProcessedFiles { get; set; }

        public int FailedFiles { get; set; }
    }
    public class GetRestoredTracesRequest : BaseGetsRequest<GetTracesRequestFilter>
    {
        public required string RequestId { get; set; }

        public string? Search { get; set; }
    }
    public class GetRestoredLogsRequest : BaseGetsRequest<GetLogsRequestFilter>
    {
        public required string RequestId { get; set; }

        public string? Search { get; set; }

        public string? ServiceName { get; set; }
    }
    public class DownloadColdRestoreParquetRequest
    {
        public required string RequestId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string DataType { get; set; } = "Both"; // Trace / Log / Both
    }
    public class ColdRestoreDownloadResult
    {
        public required Stream Content { get; set; }
        public required string ContentType { get; set; }
        public required string FileName { get; set; }
    }

    public class DownloadColdRestoreJsonRequest
    {
        public string RequestId { get; set; }

        // Allowed values: Trace, Log, Both
        public string DataType { get; set; } = "Both";
    }
    public class GetLatestColdRestoreRequestIdRequest
    {
        public required string SourceType { get; set; }
    }
    public class GetLatestColdRestoreRequestIdResponse
    {
        public string RequestId { get; set; } = string.Empty;
    }
    public class StartArchiveRestoreRequest
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? ServiceName { get; set; }
        public string UserMail { get; set; }
    }
    public class StartArchiveRestoreResponse
    {
        public string RequestId { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
