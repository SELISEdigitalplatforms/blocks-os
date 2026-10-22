namespace Configuration.DomainService.Notification.Propagation
{
    public interface INotificationConfigurationPropagator
    {
        Task<NotificationPropagationSummary> PropagateAsync(BuiltInNotificationConfigurationChangedEvent change);
    }
}
