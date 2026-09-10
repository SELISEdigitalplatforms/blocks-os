using Blocks.Genesis;

namespace Cloud.LmtService.Utilities
{
    public static class Constants
    {
        // ── External message queues (scheduler + restore triggers only) ──────────
        public const string StartBackupQueue = "start_backup_queue";
        public const string ColdRestoreQueue = "blocks-cold-restore-queue";
        public const string ArchiveRestoreQueue = "blocks-archive-restore-queue";

        /// <summary>Expired-data cleanup. Scheduled separately from the backup so a cleanup failure cannot force a whole backup retry.</summary>
        public const string LmtCleanupQueue = "lmt-cleanup-queue";

        /// <summary>
        /// Rehydration polling. Wants a much tighter interval than the daily backup (15-30 min):
        /// this poll is what turns a finished rehydration into restored data, so its period is the
        /// tail latency of every archive restore.
        /// </summary>
        public const string LmtHydrationCheckQueue = "lmt-hydration-check-queue";

        /// <summary>
        /// How long a blob may stay in the Archive tier after rehydration was requested before the
        /// job is failed. Azure standard-priority rehydration is documented at up to 15 hours; this
        /// leaves headroom and still bounds the request.
        /// </summary>
        public static readonly TimeSpan MaxHydrationWait = TimeSpan.FromHours(24);

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
            new()
            {
                RabbitMqConfiguration = new RabbitMqConfiguration
                {
                    ConsumerSubscriptions = [ConsumerSubscription.BindToQueue(StartBackupQueue),
                                             ConsumerSubscription.BindToQueue(ColdRestoreQueue),
                                             ConsumerSubscription.BindToQueue(ArchiveRestoreQueue),
                                             ConsumerSubscription.BindToQueue(LmtCleanupQueue),
                                             ConsumerSubscription.BindToQueue(LmtHydrationCheckQueue)],
                }
            };

        private static MessageConfiguration CreateAzureServiceBusConfiguration() =>
            new()
            {
                AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                {
                    Queues = [StartBackupQueue, ColdRestoreQueue, ArchiveRestoreQueue, LmtCleanupQueue, LmtHydrationCheckQueue],
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

            // How wide a range may be is a per-tier question answered by RestoreWindow.MaxSpanDays,
            // which derives it from configuration. It used to be a flat seven days here, which the
            // cold tier could not honour: its window is only ColdToArchiveLifeCycleInDays + 1 wide.
            return (DateTime.SpecifyKind(startDate.Date, DateTimeKind.Utc),
                    DateTime.SpecifyKind(endDate.Date, DateTimeKind.Utc));
        }
    }
}
