using Blocks.Extensions.DependencyInjection;
using Blocks.Genesis;
using Blocks.Secrets;
using BlocksOs.Api;
using Cloud.DomainService.Utilities;
using Cloud.LmtService.Utilities;
using Configuration.DomainService.Shared.Utilities;
using DomainService.Shared;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using SeliseBlocks.ConfigurationDriver;

var builder = WebApplication.CreateBuilder(args);
ApplicationConfigurations.ConfigureApiEnv(builder, args);

var serviceName = "blocks-os";
var vaultType = ApplicationConfigurations.ResolveVaultType();
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(serviceName, vaultType);

ApplicationConfigurations.ConfigureServices(builder.Services, IdentifierConstants.GetMessageConfiguration(secret.MessageConnectionString));

builder.Configuration.AddMongoDbConfiguration(options =>
{
    options.ConnectionString = secret.DatabaseConnectionString;
    options.DatabaseName = secret.RootDatabaseName;
    options.CollectionName = "Secrets";
    options.SecretKey = "blocks-secret-os";
});
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 15 * 1024 * 1024; // 15 MB
});

var services = builder.Services;

services.AddHealthChecks();

ApplicationConfigurations.ConfigureApi(services, serviceName);

builder.Services.Configure<MvcOptions>(options =>
{
    options.Conventions.Insert(0, new GlobalApiRoutePrefixConvention("api"));

    // Turns secret-domain exceptions into status codes. Registered here rather than inside
    // Blocks.Secrets so the package stays usable from workers with no HTTP pipeline.
    options.Filters.Add<SecretExceptionFilter>();
});

var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);

ApplyFrontendRuntimeSettings(builder.Configuration, wwwrootPath);

services.AddApplicationServices();
services.AddCloudDomainServices();
services.AddCloudLmtServices();
services.AddConfigurationServices();

// Scoped internally: these read the request-scoped BlocksContext, so the old singleton
// registration would have served the first caller's tenant to everyone afterwards.
services.AddBlocksSecrets();
await services.RegisterBlocksReleaseServicesAsync(vaultType);


var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

var indexHtml = Path.Combine(app.Environment.WebRootPath ?? "", "index.html");

if (File.Exists(indexHtml))
{
    app.MapFallbackToFile("/index.html");
}


ApplicationConfigurations.ConfigureMiddleware(app);


await app.RunAsync();

//static VaultType ResolveVaultType()
//{
//    var configuredVaultType = Environment.GetEnvironmentVariable("BLOCKS_VAULT_TYPE");
//    if (!string.IsNullOrWhiteSpace(configuredVaultType) &&
//        Enum.TryParse<VaultType>(configuredVaultType, true, out var parsedVaultType))
//    {
//        return parsedVaultType;
//    }

//    var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ??
//                      Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

//    return string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
//        ? VaultType.OnPrem
//        : VaultType.Azure;
//}


static void ApplyFrontendRuntimeSettings(IConfiguration configuration, string webRootPath)
{
    // ACTIVE path: read frontend runtime values from the "FrontendRuntime" section. These
    // are supplied at deploy time from the Mongo "Secrets" document (SecretKey
    // "blocks-secret-os") via AddMongoDbConfiguration, using keys prefixed
    // "FrontendRuntime:BLOCKS_*". Standard .NET config layering still applies, so env vars
    // named "FrontendRuntime__BLOCKS_*" override individual keys.
    var section = configuration.GetSection("FrontendRuntime");

    // The Mongo configuration source is added after the environment-variable source, so it
    // wins standard layering and a "FrontendRuntime__BLOCKS_*" env var would otherwise be
    // ignored. Read the env var first so the documented per-key override actually applies.
    // Scoped to these tokens on purpose: it must not reshuffle global config precedence.
    string? Resolve(string key) =>
        Environment.GetEnvironmentVariable($"FrontendRuntime__{key}") is { Length: > 0 } fromEnv
            ? fromEnv
            : section[key];

    var replacements = new Dictionary<string, string?>
    {
        ["__BLOCKS_API_BASE_URL__"] = Resolve("BLOCKS_API_BASE_URL"),
        ["__BLOCKS_X_BLOCKS_KEY__"] = Resolve("BLOCKS_X_BLOCKS_KEY"),
        ["__BLOCKS_GOOGLE_SITE_KEY__"] = Resolve("BLOCKS_GOOGLE_SITE_KEY"),
        ["__BLOCKS_CONSTRUCT_URL__"] = Resolve("BLOCKS_CONSTRUCT_URL"),
        ["__BLOCKS_GITHUB_SSO_CLIENT_ID__"] = Resolve("BLOCKS_GITHUB_SSO_CLIENT_ID"),
        ["__BLOCKS_APP_URL__"] = Resolve("BLOCKS_APP_URL"),
        ["__BLOCKS_IDP_BASE_URL__"] = Resolve("BLOCKS_IDP_BASE_URL"),
        ["__BLOCKS_OS_URL__"] = Resolve("BLOCKS_OS_URL"),
        ["__BLOCKS_OIDC_CLIENT_ID__"] = Resolve("BLOCKS_OIDC_CLIENT_ID"),
        ["__BLOCKS_BASE_DOMAIN__"] = Resolve("BLOCKS_BASE_DOMAIN"),
        ["__BLOCKS_IAM_BASE_URL__"] = Resolve("BLOCKS_IAM_BASE_URL"),
        ["__BLOCKS_IAM_CALLBACK_URL__"] = Resolve("BLOCKS_IAM_CALLBACK_URL"),
        ["__BLOCKS_LOCALIZATION_BASE_URL__"] = Resolve("BLOCKS_LOCALIZATION_BASE_URL"),
        ["__BLOCKS_LOCALIZATION_CALLBACK_URL__"] = Resolve("BLOCKS_LOCALIZATION_CALLBACK_URL"),
        ["__BLOCKS_AGENTS_BASE_URL__"] = Resolve("BLOCKS_AGENTS_BASE_URL"),
        ["__BLOCKS_AGENTS_CALLBACK_URL__"] = Resolve("BLOCKS_AGENTS_CALLBACK_URL"),
        ["__BLOCKS_DATA_BASE_URL__"] = Resolve("BLOCKS_DATA_BASE_URL"),
        ["__BLOCKS_DATA_CALLBACK_URL__"] = Resolve("BLOCKS_DATA_CALLBACK_URL"),
        ["__BLOCKS_OS_BASE_URL__"] = Resolve("BLOCKS_OS_BASE_URL"),
        ["__BLOCKS_OS_CALLBACK_URL__"] = Resolve("BLOCKS_OS_CALLBACK_URL"),
        ["__BLOCKS_UTILITIES_BASE_URL__"] = Resolve("BLOCKS_UTILITIES_BASE_URL"),
        ["__BLOCKS_UTILITIES_CALLBACK_URL__"] = Resolve("BLOCKS_UTILITIES_CALLBACK_URL"),
        ["__BLOCKS_LOGIC_BASE_URL__"] = Resolve("BLOCKS_LOGIC_BASE_URL"),
        ["__BLOCKS_LOGIC_CALLBACK_URL__"] = Resolve("BLOCKS_LOGIC_CALLBACK_URL"),
        ["__BLOCKS_MONITOR_BASE_URL__"] = Resolve("BLOCKS_MONITOR_BASE_URL"),
        ["__BLOCKS_MONITOR_CALLBACK_URL__"] = Resolve("BLOCKS_MONITOR_CALLBACK_URL"),
        ["__BLOCKS_RELEASE_BASE_URL__"] = Resolve("BLOCKS_RELEASE_BASE_URL"),
        ["__BLOCKS_RELEASE_CALLBACK_URL__"] = Resolve("BLOCKS_RELEASE_CALLBACK_URL"),
        ["__BLOCKS_STUDIO_BASE_URL__"] = Resolve("BLOCKS_STUDIO_BASE_URL"),
        ["__BLOCKS_STUDIO_CALLBACK_URL__"] = Resolve("BLOCKS_STUDIO_CALLBACK_URL"),
        ["__BLOCKS_IAM_CLIENT_ID__"] = Resolve("BLOCKS_IAM_CLIENT_ID"),
        ["__BLOCKS_DATA_CLIENT_ID__"] = Resolve("BLOCKS_DATA_CLIENT_ID"),
        ["__BLOCKS_LOCALIZATION_CLIENT_ID__"] = Resolve("BLOCKS_LOCALIZATION_CLIENT_ID"),
        ["__BLOCKS_AGENTS_CLIENT_ID__"] = Resolve("BLOCKS_AGENTS_CLIENT_ID"),
        ["__BLOCKS_OS_CLIENT_ID__"] = Resolve("BLOCKS_OS_CLIENT_ID"),
        ["__BLOCKS_UTILITIES_CLIENT_ID__"] = Resolve("BLOCKS_UTILITIES_CLIENT_ID"),
        ["__BLOCKS_LOGIC_CLIENT_ID__"] = Resolve("BLOCKS_LOGIC_CLIENT_ID"),
        ["__BLOCKS_MONITOR_CLIENT_ID__"] = Resolve("BLOCKS_MONITOR_CLIENT_ID"),
        ["__BLOCKS_RELEASE_CLIENT_ID__"] = Resolve("BLOCKS_RELEASE_CLIENT_ID"),
        ["__BLOCKS_STUDIO_CLIENT_ID__"] = Resolve("BLOCKS_STUDIO_CLIENT_ID"),
        ["__BLOCKS_CNAME_BASE_URL__"] = Resolve("BLOCKS_CNAME_BASE_URL"),
        ["__BLOCKS_ALLOWED_SERVICES__"] = Resolve("BLOCKS_ALLOWED_SERVICES"),
        ["__BLOCKS_ROLLBAR_CLIENT_TOKEN__"] = Resolve("BLOCKS_ROLLBAR_CLIENT_TOKEN"),
        ["__BLOCKS_ROLLBAR_ENV__"] = Resolve("BLOCKS_ROLLBAR_ENV"),
    };

    var files = Directory.EnumerateFiles(webRootPath, "*", SearchOption.AllDirectories)
        .Where(path =>
        {
            var ext = Path.GetExtension(path);
            return ext.Equals(".html", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".js", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".css", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".json", StringComparison.OrdinalIgnoreCase);
        });

    foreach (var filePath in files)
    {
        var content = File.ReadAllText(filePath);
        var updated = content;

        foreach (var (token, value) in replacements)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                updated = updated.Replace(token, value, StringComparison.Ordinal);
            }
        }

        if (!ReferenceEquals(content, updated) && !content.Equals(updated, StringComparison.Ordinal))
        {
            File.WriteAllText(filePath, updated);
        }
    }
}
