using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Notification.Propagation
{
    public enum NotificationConfigurationChangeAction
    {
        Upsert = 0,
        Delete = 1,
    }

    /// <summary>
    /// Published after the root tenant saves or deletes a built-in notification config. The worker copies the
    /// change to the seed database and to every other tenant database.
    /// </summary>
    /// <remarks>
    /// The worker applies the root tenant's current record for <see cref="Name"/>, not <see cref="Snapshot"/>,
    /// so messages that arrive late, twice, or out of order all end in the latest state. <see cref="Snapshot"/>
    /// is the state at publish time, kept for diagnostics.
    /// </remarks>
    public class BuiltInNotificationConfigurationChangedEvent
    {
        public NotificationConfigurationChangeAction Action { get; set; }
        public string Name { get; set; } = string.Empty;

        /// <summary>The tenant that made the change. The worker acts only when this is the root tenant.</summary>
        public string SourceTenantId { get; set; } = string.Empty;

        public NotificationConfiguration? Snapshot { get; set; }
    }
}
