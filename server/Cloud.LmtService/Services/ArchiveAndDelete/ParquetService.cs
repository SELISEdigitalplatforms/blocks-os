using Cloud.LmtService.Models.ArchiveAndDelete;
using Parquet;
using Parquet.Data;
using Parquet.Schema;

namespace Cloud.LmtService.Services.ArchiveAndDelete
{
    public static class ParquetService
    {
        private static readonly string TempDirectory = Path.Combine(Directory.GetCurrentDirectory(), "temp");
        public static async Task<string> SaveParquetAsync<T>(IEnumerable<T> data, string fileName, CancellationToken ct = default)
        {
            if (data is IEnumerable<StoredLogForParquet> logs)
            {
                return await SaveLogsParquetAsync(logs, fileName, ct);
            }
            else if (data is IEnumerable<StoredTraceForParquet> traces)
            {
                return await SaveTracesParquetAsync(traces, fileName, ct);
            }

            throw new NotSupportedException($"Type {typeof(T).Name} is not supported for Parquet export.");
        }

        private static string GetTempFilePath(string fileName)
        {
            if (!Directory.Exists(TempDirectory))
            {
                Directory.CreateDirectory(TempDirectory);
            }
            return Path.Combine(TempDirectory, fileName);
        }

        private static async Task<string> SaveLogsParquetAsync(IEnumerable<StoredLogForParquet> logs, string fileName, CancellationToken ct)
        {
            var logList = logs.ToList();
            if (logList.Count == 0)
                return string.Empty;

            var schema = new ParquetSchema(
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

            var filePath = GetTempFilePath(fileName);

            using var stream = File.Create(filePath);
            await using var writer = await ParquetWriter.CreateAsync(schema, stream, cancellationToken: ct);

             using var groupWriter =  writer.CreateRowGroup();

            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[0], logList.Select(l => l.Timestamp).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[1], logList.Select(l => l.ActionName).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[2], logList.Select(l => l.TraceId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[3], logList.Select(l => l.EnvironmentName).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[4], logList.Select(l => l.ParentId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[5], logList.Select(l => l.RequestPath).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[6], logList.Select(l => l.Exception).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[7], logList.Select(l => l.Message).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[8], logList.Select(l => l.ParentSpanId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[9], logList.Select(l => l.SpanId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[10], logList.Select(l => l.Level).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[11], logList.Select(l => l.ServiceName).ToArray()), ct);

            return filePath;
        }

        private static async Task<string> SaveTracesParquetAsync(IEnumerable<StoredTraceForParquet> traces, string fileName, CancellationToken ct)
        {
            var traceList = traces.ToList();
            if (traceList.Count == 0)
                return string.Empty;

            var schema = new ParquetSchema(
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

            var filePath = GetTempFilePath(fileName);

            using var stream = File.Create(filePath);
           await using var writer = await ParquetWriter.CreateAsync(schema, stream, cancellationToken: ct);

            using var groupWriter = writer.CreateRowGroup();

            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[0], traceList.Select(t => t.Timestamp).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[1], traceList.Select(t => t.TraceId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[2], traceList.Select(t => t.SpanId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[3], traceList.Select(t => t.ParentSpanId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[4], traceList.Select(t => t.ParentId).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[5], traceList.Select(t => t.OperationName).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[6], traceList.Select(t => t.Kind).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[7], traceList.Select(t => t.StartTime).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[8], traceList.Select(t => t.EndTime).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[9], traceList.Select(t => t.Duration).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[10], traceList.Select(t => t.Attributes).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[11], traceList.Select(t => t.Baggage).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[12], traceList.Select(t => t.Status).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[13], traceList.Select(t => t.StatusDescription).ToArray()), ct);
            await groupWriter.WriteColumnAsync(new DataColumn(schema.DataFields[14], traceList.Select(t => t.ServiceName).ToArray()), ct);

            return filePath;
        }
    }
}
