using BlocksOs.Api.Middleware;
using FluentAssertions;
using Xunit;

namespace XUnitTest.Middleware;

public class SpaFallbackGuardTests
{
    [Theory]
    [InlineData("/BitKeeper")]
    [InlineData("/.git")]
    [InlineData("/.git/config")]
    [InlineData("/.env")]
    [InlineData("/CVS/Root")]
    [InlineData("/appsettings.json")]
    [InlineData("/.hidden")]
    [InlineData("/backup~")]
    public void RejectsVcsAndHiddenProbes(string path)
    {
        SpaFallbackGuard.IsHiddenOrVcsProbe(path).Should().BeTrue();
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/app/console")]
    [InlineData("/login/callback")]
    [InlineData("/assets/index.js")]
    public void AllowsNormalSpaRoutes(string path)
    {
        SpaFallbackGuard.IsHiddenOrVcsProbe(path).Should().BeFalse();
    }
}
