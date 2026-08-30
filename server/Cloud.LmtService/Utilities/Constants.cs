using Blocks.Genesis;

namespace Cloud.LmtService.Utilities
{
    public static class Constants
    {
        // ── External message queues (scheduler + restore triggers only) ──────────
        public const string StartBackupQueue = "start_backup_queue";
        public const string ColdRestoreQueue = "cold-restore-queue";
        public const string ArchiveRestoreQueue = "archive-restore-queue";

        // ── Database field names ─────────────────────────────────────────────────
        public const string Timestamp = "Timestamp";
        public const string BlocksServiceNamePrefix = "blocks-";
        public const string ManagedServiceNamePrefix = "SB-";

        // ── Blob storage paths ───────────────────────────────────────────────────
        public const string BackupSubdirectory = "Tenants";
        public const string BackupLogsDirectory = "logs";
        public const string BackupTracesDirectory = "traces";
        public const int fileUploadRetries = 3;

        // ── Concurrency and batch settings ───────────────────────────────────────
        public const int MongoQueryMaxConcurrency = 8;
        public const int TracesBatchSize = 10000;
        public const int LogsBatchSize = 10000;
        public const int RestoreInsertBatchSize = 1000;

        public static readonly string[] IgnoredTenants = ["miscellaneous"];
        public static readonly string[] IgnoredServices = ["blocks-lmt-worker"];

        public const string MiscellaneousCollectionName = "miscellaneous";

        // ── Message configuration factory ────────────────────────────────────────
        private const string DefaultProvider = "azure";
        private const string RabbitMqProvider = "rabbitmq";

        public static MessageConfiguration GetMessageConfiguration(string messageConnectionString)
        {
            var provider = GetProvider(messageConnectionString);
            return provider switch
            {
                RabbitMqProvider => CreateRabbitMqConfiguration(),
                _ => CreateAzureServiceBusConfiguration()
            };
        }

        private static string GetProvider(string messageConnectionString)
        {
            if (Uri.TryCreate(messageConnectionString, UriKind.Absolute, out var uri))
            {
                if (uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
                    uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase))
                    return RabbitMqProvider;
            }
            return DefaultProvider;
        }

        private static MessageConfiguration CreateRabbitMqConfiguration() =>
            new() { RabbitMqConfiguration = new RabbitMqConfiguration { ConsumerSubscriptions = [] } };

        private static MessageConfiguration CreateAzureServiceBusConfiguration() =>
            new()
            {
                AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                {
                    Queues = [StartBackupQueue, ColdRestoreQueue, ArchiveRestoreQueue],
                    Topics = []
                }
            };

        // ── Shared date-range helper ─────────────────────────────────────────────
        public static (DateTime NormalizedStartDate, DateTime NormalizedEndDate)
            ValidateAndNormalize(DateTime startDate, DateTime endDate)
        {
            if (startDate == DateTime.MinValue || endDate == DateTime.MinValue)
                throw new ArgumentException("StartDate and EndDate are required.");

            if (startDate > endDate)
                throw new ArgumentException("StartDate cannot be greater than EndDate.");

            var normalizedStart = DateTime.SpecifyKind(startDate.Date, DateTimeKind.Utc);
            var normalizedEnd = DateTime.SpecifyKind(endDate.Date, DateTimeKind.Utc);
            var maxAllowedEnd = normalizedStart.AddDays(6);

            if (normalizedEnd > maxAllowedEnd)
                throw new ArgumentException(
                    $"Date range cannot exceed 7 days. Requested end date {endDate:yyyy-MM-dd} exceeds allowed end date {maxAllowedEnd:yyyy-MM-dd}.");

            return (normalizedStart, normalizedEnd);
        }
    }
}
