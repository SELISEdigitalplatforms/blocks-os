using System.Text.Json.Serialization;

namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// The shape of a maintenance schedule's Payload.
    /// <para>
    /// The scheduler sends one message type - PublishScheduleCommand - to every queue it drives,
    /// and Blocks.Genesis picks a consumer from that type name alone, never from the queue name. So
    /// three schedules on three queues arrive indistinguishable unless the schedule row says which
    /// job it wants. This is that discriminator, and it is the same approach workflow schedules
    /// already use (see SchedulerTriggerConsumer in blocks-logic).
    /// </para>
    /// <para>
    /// Payload is an opaque string end to end: the scheduler never parses it, so adding a task here
    /// needs no change to Scheduler.DomainService and no scheduler redeploy - only a Mongo row.
    /// </para>
    /// </summary>
    /// <example><code>{ "task": "hydration-check" }</code></example>
    public sealed class ScheduledMaintenancePayload
    {
        [JsonPropertyName("task")]
        public string? Task { get; set; }
    }

    /// <summary>Task names recognised in a schedule row's Payload. Compared lower-cased and trimmed.</summary>
    public static class MaintenanceTasks
    {
        public const string Backup = "backup";
        public const string Cleanup = "cleanup";
        public const string HydrationCheck = "hydration-check";

        public static readonly string[] All = [Backup, Cleanup, HydrationCheck];
    }
}
