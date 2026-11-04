using Microsoft.Extensions.Configuration;

namespace Blocks.Secrets;

/// <summary>Resolves and validates service origins supplied through frontend runtime configuration.</summary>
public static class FrontendRuntimeUrl
{
    public static string ResolveIamBaseUrl(IConfiguration configuration, string missingConfigurationMessage)
    {
        var raw = Environment.GetEnvironmentVariable("FrontendRuntime__BLOCKS_IAM_BASE_URL");
        if (string.IsNullOrEmpty(raw)) raw = configuration["FrontendRuntime:BLOCKS_IAM_BASE_URL"];
        if (string.IsNullOrWhiteSpace(raw)) throw new InvalidOperationException(missingConfigurationMessage);

        raw = raw.Trim();
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment))
        {
            throw new InvalidOperationException(
                "FrontendRuntime:BLOCKS_IAM_BASE_URL must be an absolute http or https URL without query or fragment.");
        }

        return raw;
    }
}
