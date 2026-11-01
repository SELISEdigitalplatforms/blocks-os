namespace Configuration.DomainService.Notification.Propagation
{
    public enum NotificationPropagationOutcome
    {
        Inserted,
        Updated,
        Deleted,
        NotPresent,
        Conflict,
        Failed,

        /// <summary>Root made the built-in Console-only, but the project chose to keep its copy (own Scope, disabled or Audience).</summary>
        Kept,
    }

    public class NotificationPropagationResult
    {
        public string TargetId { get; set; } = string.Empty;
        public NotificationPropagationOutcome Outcome { get; set; }
        public string? ErrorType { get; set; }
    }

    public class NotificationPropagationSummary
    {
        public string Name { get; set; } = string.Empty;
        public NotificationConfigurationChangeAction Action { get; set; }

        /// <summary>Why nothing was attempted, when nothing was. Null when targets were processed.</summary>
        public string? SkippedReason { get; set; }

        public List<NotificationPropagationResult> Results { get; set; } = new();

        public int Count(NotificationPropagationOutcome outcome) => Results.Count(r => r.Outcome == outcome);
    }
}
