using System.Text.Json;
using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Microsoft.Extensions.Logging;

namespace LmtColdArchiveRestoreWorker.Consumers.Maintenance
{
    /// <summary>
    /// The single entry point for everything the scheduler publishes to this worker.
    /// <para>
    /// Blocks.Genesis routes a message by its type name alone - the queue it arrived on is never
    /// consulted - and the scheduler sends PublishScheduleCommand to every queue it drives. So the
    /// backup, cleanup and hydration-check schedules all land here, indistinguishable, and the
    /// schedule's Payload is what tells them apart. Without this router the first registered
    /// consumer silently won them all.
    /// </para>
    /// </summary>
    public class ScheduledMaintenanceRouter : IConsumer<PublishScheduleCommand>
    {
        private static readonly JsonSerializerOptions PayloadSerializerOptions = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        private readonly IConsumer<RunBackupCommand> _backup;
        private readonly IConsumer<RunCleanupCommand> _cleanup;
        private readonly IConsumer<RunHydrationCheckCommand> _hydrationCheck;
        private readonly ILogger<ScheduledMaintenanceRouter> _logger;

        public ScheduledMaintenanceRouter(
            IConsumer<RunBackupCommand> backup,
            IConsumer<RunCleanupCommand> cleanup,
            IConsumer<RunHydrationCheckCommand> hydrationCheck,
            ILogger<ScheduledMaintenanceRouter> logger)
        {
            _backup = backup;
            _cleanup = cleanup;
            _hydrationCheck = hydrationCheck;
            _logger = logger;
        }

        public async Task Consume(PublishScheduleCommand message)
        {
            var task = ResolveTask(message?.Payload);

            switch (task)
            {
                case MaintenanceTasks.Backup:
                    await _backup.Consume(new RunBackupCommand());
                    return;

                case MaintenanceTasks.Cleanup:
                    await _cleanup.Consume(new RunCleanupCommand());
                    return;

                case MaintenanceTasks.HydrationCheck:
                    await _hydrationCheck.Consume(new RunHydrationCheckCommand());
                    return;

                default:
                    // Deliberately not falling back to the backup: an unroutable payload running a
                    // full archive-and-delete pass is the exact failure this router removes.
                    _logger.LogWarning(
                        "ScheduledMaintenanceRouter - Ignoring schedule with unroutable payload {Payload}. Expected task to be one of: {KnownTasks}.",
                        message?.Payload, string.Join(", ", MaintenanceTasks.All));
                    return;
            }
        }

        /// <summary>
        /// Returns the task named by the payload, or null when the payload cannot name one.
        /// Never throws: a malformed payload is a configuration mistake, and redelivering the
        /// message cannot fix it, so it must not be turned into an endless retry.
        /// </summary>
        private string? ResolveTask(string? payload)
        {
            // No payload is the contract that predates this router: the daily backup row carries
            // Payload "" and the on-demand endpoint sends an empty command. Both mean "back up",
            // so a half-applied config change is never worse than the behaviour it replaces.
            if (string.IsNullOrWhiteSpace(payload))
            {
                return MaintenanceTasks.Backup;
            }

            ScheduledMaintenancePayload? parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<ScheduledMaintenancePayload>(payload, PayloadSerializerOptions);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "ScheduledMaintenanceRouter - Payload is not valid JSON: {Payload}", payload);
                return null;
            }

            var task = parsed?.Task?.Trim().ToLowerInvariant();

            return string.IsNullOrEmpty(task) ? null : task;
        }
    }
}
