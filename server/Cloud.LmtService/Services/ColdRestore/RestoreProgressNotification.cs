using System;
using System.Collections.Generic;
using System.Globalization;
using Blocks.Genesis;
using Os.DataAccess.Notifications;

namespace Cloud.LmtService.Services.ColdRestore
{
    /// <summary>
    /// Builds the <c>os-lmt-restore-progress</c> notifications. The final state keeps using the
    /// tenant's <c>lmt-restore-status</c> configuration; this covers the steps before and after it.
    /// </summary>
    internal static class RestoreProgressNotification
    {
        public static BuiltInNotification Accepted(string requestId, string sourceType, string? userId, string tenantId) => new()
        {
            ConfigurationName = BuiltInNotificationNames.LmtRestoreProgress,
            Event = "restore-accepted",
            Title = "Restore request accepted",
            Description = "Your log and trace restore was accepted and is being prepared.",
            Ids = new Dictionary<string, string?>
            {
                ["requestId"] = requestId,
                ["sourceType"] = sourceType
            },
            UserIds = [userId],
            TenantId = TenantFor(tenantId),
            ConnectionId = requestId
        };

        public static BuiltInNotification RetentionExtended(string requestId, string sourceType, string? userId, string tenantId, DateTime expireAt) => new()
        {
            ConfigurationName = BuiltInNotificationNames.LmtRestoreProgress,
            Event = "restore-retention-extended",
            Title = "Restored data kept longer",
            Description = "Your restored logs and traces are kept until the date shown.",
            Ids = new Dictionary<string, string?>
            {
                ["requestId"] = requestId,
                ["sourceType"] = sourceType,
                ["expireAt"] = expireAt.ToString("O", CultureInfo.InvariantCulture)
            },
            UserIds = [userId],
            TenantId = TenantFor(tenantId),
            ConnectionId = requestId
        };

        /// <summary>
        /// Same choice as the <c>lmt-restore-status</c> send: the caller's original tenant, else the
        /// tenant stored on the request (a queue consumer may have no context).
        /// </summary>
        private static string TenantFor(string recordTenantId)
        {
            var original = BlocksContext.GetContext()?.OriginalTenantId;
            return string.IsNullOrWhiteSpace(original) ? recordTenantId : original;
        }
    }
}
