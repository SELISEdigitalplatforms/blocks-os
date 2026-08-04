using System;
using System.Collections.Generic;
using Blocks.Genesis;

namespace XUnitTest.TestSupport
{
    /// <summary>
    /// Helper for setting the ambient <see cref="BlocksContext"/> that domain
    /// services read via <c>BlocksContext.GetContext()</c>. Dispose clears it so
    /// tests do not leak context into one another.
    /// </summary>
    public sealed class BlocksTestContext : IDisposable
    {
        public BlocksTestContext(
            string tenantId = "tenant-1",
            string userId = "user-1",
            string userName = "user@blocks.com",
            bool impersonated = false,
            string? originalTenantId = null)
        {
            var context = BlocksContext.Create(
                tenantId: tenantId,
                roles: new List<string>(),
                userId: userId,
                isAuthenticated: true,
                requestUri: "https://console.blocks.com/test",
                organizationId: "org-1",
                expireOn: DateTime.UtcNow.AddHours(1),
                email: userName,
                permissions: new List<string>(),
                userName: userName,
                phoneNumber: "0000000000",
                displayName: "Test User",
                oauthToken: string.Empty,
                originalTenantId: originalTenantId ?? tenantId,
                impersonated: impersonated);

            BlocksContext.SetContext(context);
        }

        public void Dispose()
        {
            BlocksContext.ClearContext();
        }
    }
}
