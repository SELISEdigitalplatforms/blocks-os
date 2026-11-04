using Blocks.Genesis;
using Configuration.DomainService.Notification.Propagation;

namespace Worker.Consumers.Notification
{
    /// <summary>Copies a root built-in notification config change to the seed database and every other tenant.</summary>
    public class BuiltInNotificationConfigurationConsumer : IConsumer<BuiltInNotificationConfigurationChangedEvent>
    {
        private readonly INotificationConfigurationPropagator _propagator;

        public BuiltInNotificationConfigurationConsumer(INotificationConfigurationPropagator propagator)
        {
            _propagator = propagator;
        }

        // No local catch: a tenant-registry failure propagates to the Blocks.Genesis dispatcher, which logs it.
        // Per-tenant failures are handled and summarised inside the propagator.
        public async Task Consume(BuiltInNotificationConfigurationChangedEvent context)
        {
            await _propagator.PropagateAsync(context);
        }
    }
}
