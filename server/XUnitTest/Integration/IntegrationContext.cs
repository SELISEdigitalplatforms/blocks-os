using System;
using System.Collections.Generic;
using Blocks.Genesis;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Sets the ambient <see cref="BlocksContext"/> for a single test with a
    /// caller supplied tenant id. Integration tests share one throwaway Mongo
    /// database, so a unique tenant id per test keeps tenant scoped collections
    /// and filters from colliding. Dispose clears the context.
    /// </summary>
    public sealed class IntegrationContext : IDisposable
    {
        public IntegrationContext(string tenantId, string userName = "it@blocks.com", string? userId = null)
        {
            var context = BlocksContext.Create(
                tenantId: tenantId,
                roles: new List<string>(),
                userId: userId ?? "user-" + tenantId,
                isAuthenticated: true,
                requestUri: "https://console.blocks.com/it",
                organizationId: "org-" + tenantId,
                expireOn: DateTime.UtcNow.AddHours(1),
                email: userName,
                permissions: new List<string>(),
                userName: userName,
                phoneNumber: "0000000000",
                displayName: "IT User",
                oauthToken: string.Empty,
                originalTenantId: tenantId);

            BlocksContext.SetContext(context);
        }

        public void Dispose() => BlocksContext.ClearContext();
    }
}
