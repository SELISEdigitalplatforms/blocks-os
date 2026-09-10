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

        // The window and its contents. The Logs page reads restored rows without ever creating
        // the request, so this response is the only place it can learn which days it is showing.
        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int TraceRowsRestored { get; set; }

        public int LogRowsRestored { get; set; }

        /// <summary>When the restored rows are discarded, so the reader is not surprised by it.</summary>
        public DateTime ExpireAt { get; set; }

        /// <summary>Cold or Archive, echoed back so a caller can label the window it is showing.</summary>
        public string SourceType { get; set; } = string.Empty;
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

        /// <summary>
        /// A single service, kept for the trace detail view which narrows to one collection.
        /// </summary>
        public string? ServiceName { get; set; }

        /// <summary>
        /// Every selected service. The Logs page filters across several at once, the same way the
        /// hot log endpoints do; an empty list means "no service filter".
        /// </summary>
        public List<string> ServiceNames { get; set; } = [];
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

    /// <summary>
    /// Cancels an in-flight cold or archive restore. RequestId alone identifies it; the caller's
    /// tenant is checked against the stored request rather than trusted from the payload.
    /// </summary>
    public class CancelRestoreRequest
    {
        public required string RequestId { get; set; }
    }

    public class CancelRestoreResponse
    {
        public string RequestId { get; set; } = string.Empty;

        /// <summary>Status after the attempt — Cancelled on success, otherwise the terminal status it already had.</summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>False when the request had already finished, so there was nothing to stop.</summary>
        public bool Cancelled { get; set; }

        public string Message { get; set; } = string.Empty;
    }
}
