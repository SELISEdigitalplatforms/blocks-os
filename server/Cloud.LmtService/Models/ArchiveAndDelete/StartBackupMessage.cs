namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// The command the scheduler publishes for every queue schedule it drives. Blocks.Genesis
    /// routes on the message type <em>name</em> only, so this local declaration deliberately is not
    /// the scheduler's own class - it just has to share the name. Properties present on the wire
    /// but absent here are ignored by System.Text.Json.
    /// </summary>
    public class PublishScheduleCommand
    {
        /// <summary>
        /// Opaque JSON copied straight through from the schedule row. Because every queue receives
        /// this same command type, the payload is the only thing that can say which maintenance job
        /// was actually meant - see <see cref="ScheduledMaintenancePayload"/>. Absent payloads mean
        /// "back up", which is what this command meant before the other jobs existed.
        /// </summary>
        public string Payload { get; set; } = string.Empty;
    }
}
