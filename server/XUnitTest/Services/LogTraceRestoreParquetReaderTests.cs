using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Services.ColdRestore;
using FluentAssertions;
using Parquet;
using Parquet.Data;
using Parquet.Schema;

namespace XUnitTest.Services
{
    /// <summary>
    /// Parquet string columns are nullable, so a null has to stay in place as an empty value. If a
    /// null is dropped instead of preserved, every later value in that column shifts up a row and
    /// silently lands on the wrong log entry.
    /// </summary>
    public class LogTraceRestoreParquetReaderTests
    {
        [Fact]
        public async Task ReadLogsAsync_KeepsColumnsAlignedWhenANullableColumnHasNulls()
        {
            // Only rows 0 and 2 carry an exception, as happens whenever a service logs a mix of
            // informational and error entries into the same day.
            await using var stream = await WriteLogParquetAsync(
                timestamps: ["2026-03-17T01:00:00.0000000Z", "2026-03-17T02:00:00.0000000Z", "2026-03-17T03:00:00.0000000Z"],
                messages: ["first", "second", "third"],
                exceptions: ["boom-0", null, "boom-2"]);

            var rows = await ReadAllAsync(new LogTraceRestoreParquetReader().ReadLogsAsync(stream));

            rows.Should().HaveCount(3);
            rows.Select(r => r.Message).Should().Equal("first", "second", "third");
            rows.Select(r => r.Exception).Should().Equal("boom-0", string.Empty, "boom-2");
        }

        [Fact]
        public async Task ReadLogsAsync_ReturnsEveryRowWhenAWholeColumnIsNull()
        {
            await using var stream = await WriteLogParquetAsync(
                timestamps: ["2026-03-17T01:00:00.0000000Z", "2026-03-17T02:00:00.0000000Z"],
                messages: ["first", "second"],
                exceptions: [null, null]);

            var rows = await ReadAllAsync(new LogTraceRestoreParquetReader().ReadLogsAsync(stream));

            rows.Should().HaveCount(2);
            rows.Select(r => r.Message).Should().Equal("first", "second");
            rows.Select(r => r.Exception).Should().AllBe(string.Empty);
        }

        private static async Task<Stream> WriteLogParquetAsync(
            string?[] timestamps,
            string?[] messages,
            string?[] exceptions)
        {
            var schema = new ParquetSchema(
                new DataField<string>("Timestamp"),
                new DataField<string>("Message"),
                new DataField<string>("Exception"));

            var buffer = new MemoryStream();
            await using (var writer = await ParquetWriter.CreateAsync(schema, buffer))
            {
                using var group = writer.CreateRowGroup();
                await group.WriteColumnAsync(new DataColumn(schema.DataFields[0], timestamps));
                await group.WriteColumnAsync(new DataColumn(schema.DataFields[1], messages));
                await group.WriteColumnAsync(new DataColumn(schema.DataFields[2], exceptions));
            }

            return new MemoryStream(buffer.ToArray());
        }

        private static async Task<List<T>> ReadAllAsync<T>(IAsyncEnumerable<T> source)
        {
            var rows = new List<T>();
            await foreach (var row in source)
            {
                rows.Add(row);
            }

            return rows;
        }
    }
}
