using BlocksOs.Api.Security;
using FluentAssertions;
using Microsoft.Extensions.Configuration;

namespace XUnitTest.Api;

/// <summary>
/// The SPA's CSP. Two things went wrong with the first version of this policy and both are
/// pinned here: the host list was hardcoded to <c>dev-*</c>, and <c>style-src 'self'</c>
/// blocked the inline <c>&lt;style&gt;</c> elements the UI libraries inject at runtime, which
/// left the login page rendering unusable.
/// </summary>
public class ContentSecurityPolicyTests
{
    private static IConfiguration Config(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    // ---------- Origins follow configuration, not the code ----------

    [Fact]
    public void Build_UsesTheConfiguredEnvironmentsHosts()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://iam.example.com",
            ["FrontendRuntime:BLOCKS_API_BASE_URL"] = "https://api.example.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://os.example.com",
        }));

        policy.Should().Contain("https://iam.example.com");
        policy.Should().Contain("https://api.example.com");
        policy.Should().Contain("https://os.example.com");
    }

    [Fact]
    public void Build_NamesNoEnvironmentItWasNotConfiguredWith()
    {
        // The regression this class exists for. A hardcoded dev host list meant the policy was
        // right on dev and would have stopped the SPA reaching its own IAM on stg and prod.
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://stg-iam.blocksdevelopers.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://stg-os.blocksdevelopers.com",
        }));

        policy.Should().Contain("https://stg-iam.blocksdevelopers.com");
        policy.Should().NotContain("dev-iam");
        policy.Should().NotContain("dev-os");
    }

    [Fact]
    public void Build_RestrictsFormActionToTheIdentityAndAppHosts()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://iam.example.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://os.example.com",
            ["FrontendRuntime:BLOCKS_DATA_BASE_URL"] = "https://data.example.com",
        }));

        var formAction = Directive(policy, "form-action");
        formAction.Should().Contain("https://iam.example.com");
        formAction.Should().Contain("https://os.example.com");
        // A login POST has no business going to the data service.
        formAction.Should().NotContain("https://data.example.com");
    }

    [Fact]
    public void Build_CarriesOriginsNoRuntimeKeyDescribes()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:ExtraConnectSrc"] = "https://code.example.com https://extra.example.com",
            ["Csp:ExtraImgSrc"] = "https://cdn.example.com",
        }));

        Directive(policy, "connect-src").Should().Contain("https://code.example.com")
            .And.Contain("https://extra.example.com");
        Directive(policy, "img-src").Should().Contain("https://cdn.example.com");
    }

    [Fact]
    public void Build_WithNoConfiguration_StillProducesASelfOnlyPolicy()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()));

        policy.Should().Contain("default-src 'self';");
        policy.Should().Contain("connect-src 'self';");
    }

    // ---------- Inline styles ----------

    [Fact]
    public void Policy_AllowsInlineStyles()
    {
        // Measured, not assumed: under style-src 'self' the built bundle raised three
        // style-src-elem violations in Chromium and the login page rendered 2809px tall
        // instead of 900px. Radix/vaul/sonner/cmdk inject <style> elements at runtime.
        var policy = ContentSecurityPolicy.BuildPolicy([], [], []);

        policy.Should().Contain("style-src 'self' 'unsafe-inline';");
    }

    [Fact]
    public void Policy_DoesNotSplitStyleSrcIntoAStricterElementRule()
    {
        // Relaxing only style-src-attr was tried and does not work -- the injected elements
        // are what gets blocked. A style-src-elem 'self' here would silently reintroduce the
        // outage, because the fallback style-src would no longer govern them.
        var policy = ContentSecurityPolicy.BuildPolicy([], [], []);

        policy.Should().NotContain("style-src-elem 'self';");
    }

    [Fact]
    public void Policy_NeverRelaxesScripts()
    {
        // The inline bootstrap was moved to /runtime-config.js precisely so this can stay
        // strict. Script injection is the risk that matters; style injection is not the same.
        var policy = ContentSecurityPolicy.BuildPolicy([], [], []);

        policy.Should().Contain("script-src 'self';");
        Directive(policy, "script-src").Should().NotContain("unsafe-inline");
        policy.Should().NotContain("unsafe-eval");
    }

    [Fact]
    public void Policy_KeepsTheFramingAndBaseUriHardening()
    {
        var policy = ContentSecurityPolicy.BuildPolicy([], [], []);

        policy.Should().Contain("frame-ancestors 'none';");
        policy.Should().Contain("base-uri 'self';");
    }

    // ---------- Origin normalisation ----------

    [Theory]
    [InlineData("https://iam.example.com", "https://iam.example.com")]
    [InlineData("https://iam.example.com/", "https://iam.example.com")]
    [InlineData("https://iam.example.com/auth/callback", "https://iam.example.com")]
    [InlineData("  https://iam.example.com  ", "https://iam.example.com")]
    [InlineData("http://localhost:5000", "http://localhost:5000")]
    public void ToOrigin_ReducesAUrlToItsOrigin(string value, string expected) =>
        ContentSecurityPolicy.ToOrigin(value).Should().Be(expected);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("__BLOCKS_IAM_BASE_URL__")]   // an unreplaced placeholder
    [InlineData("not a url")]
    [InlineData("javascript:alert(1)")]
    [InlineData("'unsafe-inline'")]
    public void ToOrigin_DropsAnythingThatIsNotAnHttpOrigin(string? value)
    {
        // A malformed or hostile secret must not be able to append a source expression -- or
        // a whole directive -- to the policy.
        ContentSecurityPolicy.ToOrigin(value).Should().BeNull();
    }

    [Fact]
    public void Build_DeduplicatesOriginsThatSeveralKeysShare()
    {
        // BLOCKS_OS_BASE_URL and BLOCKS_OS_URL routinely name the same host.
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://os.example.com",
            ["FrontendRuntime:BLOCKS_OS_URL"] = "https://os.example.com/",
        }));

        Occurrences(Directive(policy, "connect-src"), "https://os.example.com").Should().Be(1);
    }

    // ---------- The shipped configuration ----------

    [Fact]
    public void ShippedAppSettings_ParseAndCarryTheNonDerivableOrigins()
    {
        // appsettings.json is JSON-with-comments; this also proves the config provider accepts
        // it, which no other test would catch before startup.
        var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        if (!File.Exists(path)) return;

        var policy = ContentSecurityPolicy.Build(
            new ConfigurationBuilder().AddJsonFile(path).Build());

        Directive(policy, "connect-src").Should().Contain("https://code.selise.biz");
        Directive(policy, "img-src").Should().Contain("https://az-cdn.selise.biz");
    }

    private static string Directive(string policy, string name) =>
        policy
            .Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Single(part => part.Split(' ')[0] == name);

    private static int Occurrences(string haystack, string needle)
    {
        var count = 0;
        for (var i = haystack.IndexOf(needle, StringComparison.Ordinal); i >= 0;
             i = haystack.IndexOf(needle, i + needle.Length, StringComparison.Ordinal))
        {
            count++;
        }
        return count;
    }
}
