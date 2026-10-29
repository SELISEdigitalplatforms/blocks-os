namespace Configuration.DomainService.Notification.Services
{
    /// <summary>Size limits of a notification configuration. The client form shows the same numbers (LIMITS).</summary>
    public static class NotificationLimits
    {
        public const int UserIds = 500;
        public const int Roles = 50;
        public const int Permissions = 50;
        public const int Filters = 20;
        public const int ItemLength = 200;
        public const int RateLimitMax = 600;
    }
}
