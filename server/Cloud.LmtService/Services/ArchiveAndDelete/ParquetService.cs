using Cloud.LmtService.Models.ArchiveAndDelete;
using Parquet;
using Parquet.Data;
using Parquet.Schema;

namespace Cloud.LmtService.Services.ArchiveAndDelete
{
    /// <summary>
    /// Writes archived logs and traces to Parquet.
    /// <para>
    /// Batches are written as they arrive, one Parquet row group each, so a tenant's whole day
    /// never has to be held in memory at once. The previous version materialised the full list and
    /// then built one array per column on top of it, which multiplied the peak footprint by the
    /// column count and turned a large tenant into an OutOfMemoryException.
    /// </para>
    /// </summary>
    public static class ParquetService
    {
        // The OS temp directory rather than the working directory: writing into the deployment
        // folder fills the container's writable layer and the files outlive a crashed process.
        private static readonly string TempDirectory = Path.Combine(Path.GetTempPath(), "blocks-lmt-backup");

        private static readonly ParquetSchema LogSchema = new(
            new DataField<string>("Timestamp"),
            new DataField<string>("ActionName"),
            new DataField<string>("TraceId"),
            new DataField<string>("EnvironmentName"),
            new DataField<string>("ParentId"),
            new DataField<string>("RequestPath"),
            new DataField<string>("Exception"),
            new DataField<string>("Message"),
            new DataField<string>("ParentSpanId"),
            new DataField<string>("SpanId"),
            new DataField<string>("Level"),
            new DataField<string>("ServiceName")
        );

        private static readonly ParquetSchema TraceSchema = new(
            new DataField<string>("Timestamp"),
            new DataField<string>("TraceId"),
            new DataField<string>("SpanId"),
            new DataField<string>("ParentSpanId"),
            new DataField<string>("ParentId"),
            new DataField<string>("OperationName"),
            new DataField<string>("Kind"),
            new DataField<string>("StartTime"),
            new DataField<string>("EndTime"),
            new DataField<double>("Duration"),
            new DataField<string>("Attributes"),
            new DataField<string>("Baggage"),
            new DataField<string>("Status"),
            new DataField<string>("StatusDescription"),
            new DataField<string>("ServiceName")
        );

        private static string GetTempFilePath(string fileName)
        {
            Directory.CreateDirectory(TempDirectory);
            return Path.Combine(TempDirectory, fileName);
        }

        /// <summary>
        /// Writes every batch to one Parquet file and reports how many rows it holds. A count of
        /// zero means the source was empty; the caller decides whether that is worth uploading.
        /// </summary>
        public static async Task<(string FilePath, long RowCount)> SaveLogsParquetAsync(
            IAsyncEnumerable<List<StoredLogForParquet>> batches,
            string fileName,
            CancellationToken ct = default)
        {
            ArgumentNullException.ThrowIfNull(batches);

            var filePath = GetTempFilePath(fileName);
            long rowCount = 0;

            using (var stream = File.Create(filePath))
            await using (var writer = await ParquetWriter.CreateAsync(LogSchema, stream, cancellationToken: ct))
            {
                await foreach (var batch in batches.WithCancellation(ct))
                {
                    if (batch.Count == 0) continue;

                    using var groupWriter = writer.CreateRowGroup();

                    await WriteColumnAsync(groupWriter, LogSchema, 0, batch, l => l.Timestamp, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 1, batch, l => l.ActionName, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 2, batch, l => l.TraceId, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 3, batch, l => l.EnvironmentName, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 4, batch, l => l.ParentId, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 5, batch, l => l.RequestPath, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 6, batch, l => l.Exception, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 7, batch, l => l.Message, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 8, batch, l => l.ParentSpanId, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 9, batch, l => l.SpanId, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 10, batch, l => l.Level, ct);
                    await WriteColumnAsync(groupWriter, LogSchema, 11, batch, l => l.ServiceName, ct);

                    rowCount += batch.Count;
                }
            }

            return (filePath, rowCount);
        }

        /// <inheritdoc cref="SaveLogsParquetAsync"/>
        public static async Task<(string FilePath, long RowCount)> SaveTracesParquetAsync(
            IAsyncEnumerable<List<StoredTraceForParquet>> batches,
            string fileName,
            CancellationToken ct = default)
        {
            ArgumentNullException.ThrowIfNull(batches);

            var filePath = GetTempFilePath(fileName);
            long rowCount = 0;

            using (var stream = File.Create(filePath))
            await using (var writer = await ParquetWriter.CreateAsync(TraceSchema, stream, cancellationToken: ct))
            {
                await foreach (var batch in batches.WithCancellation(ct))
                {
                    if (batch.Count == 0) continue;

                    using var groupWriter = writer.CreateRowGroup();

                    await WriteColumnAsync(groupWriter, TraceSchema, 0, batch, t => t.Timestamp, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 1, batch, t => t.TraceId, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 2, batch, t => t.SpanId, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 3, batch, t => t.ParentSpanId, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 4, batch, t => t.ParentId, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 5, batch, t => t.OperationName, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 6, batch, t => t.Kind, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 7, batch, t => t.StartTime, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 8, batch, t => t.EndTime, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 9, batch, t => t.Duration, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 10, batch, t => t.Attributes, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 11, batch, t => t.Baggage, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 12, batch, t => t.Status, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 13, batch, t => t.StatusDescription, ct);
                    await WriteColumnAsync(groupWriter, TraceSchema, 14, batch, t => t.ServiceName, ct);

                    rowCount += batch.Count;
                }
            }

            return (filePath, rowCount);
        }

        private static async Task WriteColumnAsync<TRow, TValue>(
            ParquetRowGroupWriter groupWriter,
            ParquetSchema schema,
            int fieldIndex,
            List<TRow> rows,
            Func<TRow, TValue> selector,
            CancellationToken ct)
        {
            var values = new TValue[rows.Count];

            for (var i = 0; i < rows.Count; i++)
                values[i] = selector(rows[i]);

            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[fieldIndex], values), ct);
        }
    }
}
