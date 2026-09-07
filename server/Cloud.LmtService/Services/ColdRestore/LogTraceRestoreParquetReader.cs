using Cloud.LmtService.Models.ColdRestore;
using Parquet;
using Parquet.Schema;
using System.Runtime.CompilerServices;


namespace Cloud.LmtService.Services.ColdRestore
{
    public class LogTraceRestoreParquetReader : ILogTraceRestoreParquetReader
    {
        public IAsyncEnumerable<RestoreTraceRow> ReadTracesAsync(
            Stream stream,
            CancellationToken ct = default)
        {
            if (stream == null) throw new ArgumentNullException(nameof(stream));
            return ReadTracesCoreAsync(stream, ct);
        }

        public IAsyncEnumerable<RestoreLogRow> ReadLogsAsync(
            Stream stream,
            CancellationToken ct = default)
        {
            if (stream == null) throw new ArgumentNullException(nameof(stream));
            return ReadLogsCoreAsync(stream, ct);
        }
        private static async IAsyncEnumerable<RestoreTraceRow> ReadTracesCoreAsync(
            Stream stream,
            [EnumeratorCancellation] CancellationToken ct)
        {
            using var parquetReader = await ParquetReader.CreateAsync(stream, cancellationToken: ct);
            var schema = parquetReader.Schema;

            for (int groupIndex = 0; groupIndex < parquetReader.RowGroupCount; groupIndex++)
            {
                ct.ThrowIfCancellationRequested();

                using var rowGroupReader = parquetReader.OpenRowGroupReader(groupIndex);

                var timestampColumn       = await ReadStringColumnAsync(rowGroupReader, schema, "Timestamp",         ct);
                var traceIdColumn         = await ReadStringColumnAsync(rowGroupReader, schema, "TraceId",           ct);
                var operationNameColumn   = await ReadStringColumnAsync(rowGroupReader, schema, "OperationName",     ct);
                var startTimeColumn       = await ReadStringColumnAsync(rowGroupReader, schema, "StartTime",         ct);
                var endTimeColumn         = await ReadStringColumnAsync(rowGroupReader, schema, "EndTime",           ct);
                var durationColumn        = await ReadDoubleColumnAsync(rowGroupReader, schema, "Duration",          ct);
                var attributesColumn      = await ReadStringColumnAsync(rowGroupReader, schema, "Attributes",        ct);
                var serviceNameColumn     = await ReadStringColumnAsync(rowGroupReader, schema, "ServiceName",       ct);
                var spanIdColumn          = await ReadStringColumnAsync(rowGroupReader, schema, "SpanId",            ct);
                var parentSpanIdColumn    = await ReadStringColumnAsync(rowGroupReader, schema, "ParentSpanId",      ct);
                var parentIdColumn        = await ReadStringColumnAsync(rowGroupReader, schema, "ParentId",          ct);
                var kindColumn            = await ReadStringColumnAsync(rowGroupReader, schema, "Kind",              ct);
                var activitySourceName    = await ReadStringColumnAsync(rowGroupReader, schema, "ActivitySourceName",ct);
                var statusColumn          = await ReadStringColumnAsync(rowGroupReader, schema, "Status",            ct);
                var statusDescColumn      = await ReadStringColumnAsync(rowGroupReader, schema, "StatusDescription", ct);
                var baggageColumn         = await ReadStringColumnAsync(rowGroupReader, schema, "Baggage",           ct);
                var tenantIdColumn        = await ReadStringColumnAsync(rowGroupReader, schema, "TenantId",          ct);

                var rowCount = timestampColumn.Count;

                for (int i = 0; i < rowCount; i++)
                {
                    var timestamp = ParseDateTime(timestampColumn, i);
                    if (timestamp == null) continue;

                    yield return new RestoreTraceRow
                    {
                        Timestamp         = timestamp,
                        TraceId           = GetStringValue(traceIdColumn,       i),
                        OperationName     = GetStringValue(operationNameColumn,  i),
                        StartTime         = ParseDateTime(startTimeColumn,       i),
                        EndTime           = ParseDateTime(endTimeColumn,         i),
                        Duration          = GetDoubleValue(durationColumn,       i),
                        AttributesJson    = GetStringValue(attributesColumn,     i),
                        ServiceName       = GetStringValue(serviceNameColumn,    i),
                        SpanId            = GetStringValue(spanIdColumn,         i),
                        ParentSpanId      = GetStringValue(parentSpanIdColumn,   i),
                        ParentId          = GetStringValue(parentIdColumn,       i),
                        Kind              = GetStringValue(kindColumn,           i),
                        ActivitySourceName= GetStringValue(activitySourceName,   i),
                        Status            = GetStringValue(statusColumn,         i),
                        StatusDescription = GetStringValue(statusDescColumn,     i),
                        BaggageJson       = GetStringValue(baggageColumn,        i),
                        TenantId          = GetStringValue(tenantIdColumn,       i),
                    };
                }
            }
        }

        private static async IAsyncEnumerable<RestoreLogRow> ReadLogsCoreAsync(
            Stream stream,
            [EnumeratorCancellation] CancellationToken ct)
        {
            using var parquetReader = await ParquetReader.CreateAsync(stream, cancellationToken: ct);
            var schema = parquetReader.Schema;

            for (int groupIndex = 0; groupIndex < parquetReader.RowGroupCount; groupIndex++)
            {
                ct.ThrowIfCancellationRequested();

                using var rowGroupReader = parquetReader.OpenRowGroupReader(groupIndex);

                var timestampColumn   = await ReadStringColumnAsync(rowGroupReader, schema, "Timestamp",   ct);
                var levelColumn       = await ReadStringColumnAsync(rowGroupReader, schema, "Level",       ct);
                var messageColumn     = await ReadStringColumnAsync(rowGroupReader, schema, "Message",     ct);
                var traceIdColumn     = await ReadStringColumnAsync(rowGroupReader, schema, "TraceId",     ct);
                var spanIdColumn      = await ReadStringColumnAsync(rowGroupReader, schema, "SpanId",      ct);
                var serviceNameColumn = await ReadStringColumnAsync(rowGroupReader, schema, "ServiceName", ct);
                var actionNameColumn  = await ReadStringColumnAsync(rowGroupReader, schema, "ActionName",  ct);
                // Archives written before the stack trace was surfaced have no Exception column.
                // ReadStringColumnAsync returns an empty list for a column the schema lacks, and
                // GetStringValue is bounds-checked, so those rows simply restore with no trace.
                var exceptionColumn   = await ReadStringColumnAsync(rowGroupReader, schema, "Exception",   ct);

                // Drive row count from Timestamp only — same rationale as ReadTracesCoreAsync.
                var rowCount = timestampColumn.Count;

                for (int i = 0; i < rowCount; i++)
                {
                    var timestamp = ParseDateTime(timestampColumn, i);
                    if (timestamp == null) continue;

                    yield return new RestoreLogRow
                    {
                        Timestamp   = timestamp,
                        Level       = GetStringValue(levelColumn,       i),
                        Message     = GetStringValue(messageColumn,     i),
                        TraceId     = GetStringValue(traceIdColumn,     i),
                        SpanId      = GetStringValue(spanIdColumn,      i),
                        ServiceName = GetStringValue(serviceNameColumn, i),
                        ActionName  = GetStringValue(actionNameColumn,  i),
                        Exception   = GetStringValue(exceptionColumn,   i),
                    };
                }
            }
        }

        private static async Task<List<string?>> ReadStringColumnAsync(
            ParquetRowGroupReader rowGroupReader,
            ParquetSchema schema,
            string columnName,
            CancellationToken ct)
        {
            var field = schema.GetDataFields().FirstOrDefault(x => x.Name == columnName);
            if (field == null)
                return [];

            var column = await rowGroupReader.ReadColumnAsync(field, ct);
            return column.Data.OfType<object?>().Select(x => x?.ToString()).ToList();
        }

        private static async Task<List<double?>> ReadDoubleColumnAsync(
            ParquetRowGroupReader rowGroupReader,
            ParquetSchema schema,
            string columnName,
            CancellationToken ct)
        {
            var field = schema.GetDataFields().FirstOrDefault(x => x.Name == columnName);
            if (field == null)
                return [];

            var column = await rowGroupReader.ReadColumnAsync(field, ct);
            return column.Data
                .OfType<object?>()
                .Select(x =>
                {
                    if (x == null) return (double?)null;
                    return double.TryParse(x.ToString(), out var v) ? (double?)v : null;
                })
                .ToList();
        }

        private static int GetMinRowCount(params int[] counts)
            => counts.Length == 0 ? 0 : counts.Min();

        private static string GetStringValue(List<string?> values, int index)
            => (index >= 0 && index < values.Count) ? values[index] ?? string.Empty : string.Empty;

        private static double GetDoubleValue(List<double?> values, int index)
            => (index >= 0 && index < values.Count) ? values[index] ?? 0 : 0;

        private static DateTime? ParseDateTime(List<string?> values, int index)
        {
            var raw = GetStringValue(values, index);
            if (string.IsNullOrWhiteSpace(raw)) return null;
            return DateTime.TryParse(raw, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsed)
                ? parsed
                : null;
        }
    }
}
