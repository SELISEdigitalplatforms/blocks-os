using Blocks.Extensions.DependencyInjection;
using Blocks.Genesis;
using Blocks.Secrets;
using BlocksOs.Api;
using BlocksOs.Api.Middleware;
using BlocksOs.Api.Security;
using Cloud.DomainService.Utilities;
using Cloud.LmtService.Utilities;
using Configuration.DomainService.Shared.Utilities;
using DomainService.Access;
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

services.AddKnownForwardedHeaders(builder.Configuration);

services.AddHealthChecks();

ApplicationConfigurations.ConfigureApi(services, serviceName);

builder.Services.Configure<MvcOptions>(options =>
{
    options.Conventions.Insert(0, new GlobalApiRoutePrefixConvention("api"));

    // Turns secret-domain exceptions into status codes. Registered here rather than inside
    // Blocks.Secrets so the package stays usable from workers with no HTTP pipeline.
    options.Filters.Add<SecretExceptionFilter>();

    // Project access grants. An action filter, so it always runs after the authorization
    // middleware has applied [Authorize]/[ProtectedEndPoint] — owner passes, contributor is
    // checked against what the owner granted them. An endpoint without [ProjectPolicy] is
    // simply not project-scoped and passes straight through.
    options.Filters.Add<ProjectPolicyFilter>();
});

var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);

ProgramStartup.ApplyFrontendRuntimeSettings(builder.Configuration, wwwrootPath);

services.AddApplicationServices();
services.AddCloudDomainServices();
services.AddCloudLmtServices();
services.AddConfigurationServices();

// Scoped internally: these read the request-scoped BlocksContext, so the old singleton
// registration would have served the first caller's tenant to everyone afterwards.
services.AddBlocksSecrets();
await services.RegisterBlocksReleaseServicesAsync(vaultType);


var app = builder.Build();

// Only configured ingress proxies may supply a client address; without configuration this
// preserves ASP.NET's default trusted-proxy behavior and remote-address semantics.
app.UseForwardedHeaders();

// Built once: the policy is derived from configuration, which does not change per request.
var contentSecurityPolicy = ContentSecurityPolicy.Build(app.Configuration);
var styleNonces = StyleNonce.CreateWithRandomKey();

// Browser-facing security headers for the SPA and static assets (ZAP DAST bar: 0 alerts).
app.UseSecurityHeaders(contentSecurityPolicy, styleNonces);

var indexHtml = Path.Combine(app.Environment.WebRootPath ?? "", "index.html");
// Read after ApplyFrontendRuntimeSettings has filled the runtime placeholders.
var indexHtmlTemplate = File.Exists(indexHtml) ? await File.ReadAllTextAsync(indexHtml) : null;

async Task WriteSpaShell(HttpContext context)
{
    var nonce = (string)context.Items[ProgramStartup.StyleNonceItemKey]!;
    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.WriteAsync(ContentSecurityPolicy.RenderIndex(indexHtmlTemplate!, nonce));
}

if (indexHtmlTemplate is not null)
{
    // "/" and "/index.html" would otherwise be served verbatim by the static file
    // middleware, with the nonce placeholder still in them.
    app.Use(async (context, next) =>
    {
        if (ProgramStartup.IsSpaShellRequest(context.Request))
        {
            await WriteSpaShell(context);
            return;
        }

        await next();
    });
}

app.UseDefaultFiles();
app.UseStaticFiles();

if (indexHtmlTemplate is not null)
{
    // SPA fallback must not 200 for VCS / backup probes — MapFallbackToFile would
    // serve index.html for /BitKeeper, /.git, etc. and OWASP ZAP flags "Hidden File Found".
    app.MapFallback(async context =>
    {
        if (SpaFallbackGuard.IsHiddenOrVcsProbe(context.Request.Path.Value))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        await WriteSpaShell(context);
    });
}


// IAM access cookie is named after the OIDC redirect host; JwtBearer needs Authorization.
app.UseMiddleware<HostAccessCookieBearerMiddleware>();

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
